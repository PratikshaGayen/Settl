// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * SettlEscrow — single deployed contract keyed by invoiceId.
 *
 * State machine per invoice:
 *   DRAFT ──fund()──► FUNDED ──(all milestones resolved)──► COMPLETED
 *     │                  │
 *     │                  ├──(timeout, AUTO_REFUND)──► REFUNDED
 *     └──cancel()──► CANCELLED   (only before funding)
 *
 * Milestone states: LOCKED ──approve(i)──► RELEASED
 *                   LOCKED ──claimTimeout(i)──► RELEASED | REFUNDED
 *
 * Only the recorded payer can approve. The contract never moves funds
 * without either payer approval or an elapsed timeout. Non-custodial.
 */
contract SettlEscrow {
    // ─────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────

    enum InvoiceStatus  { DRAFT, FUNDED, COMPLETED, CANCELLED, REFUNDED }
    enum MilestoneStatus { LOCKED, RELEASED, REFUNDED }
    enum TimeoutDefault  { AUTO_RELEASE, AUTO_REFUND }

    struct Milestone {
        uint256 amount;
        MilestoneStatus status;
    }

    struct Invoice {
        address payee;
        address payer;          // set at fund() time (first funder)
        InvoiceStatus status;
        TimeoutDefault timeoutDefault;
        uint256 timeoutSeconds;
        uint256 fundedAt;
        uint8 milestoneCount;
        mapping(uint8 => Milestone) milestones;
    }

    // ─────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────

    IERC20 public immutable usdc;

    mapping(bytes32 => Invoice) private _invoices;

    // ─────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────

    event Funded(
        bytes32 indexed invoiceId,
        address payer,
        address payee,
        uint256 total,
        uint256 milestoneCount
    );
    event MilestoneReleased(
        bytes32 indexed invoiceId,
        uint8 milestoneIndex,
        uint256 amount,
        address payee,
        bool viaTimeout
    );
    event MilestoneRefunded(
        bytes32 indexed invoiceId,
        uint8 milestoneIndex,
        uint256 amount,
        address payer
    );
    event Cancelled(bytes32 indexed invoiceId);

    // ─────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────

    constructor(address _usdc) {
        require(_usdc != address(0), "Invalid USDC address");
        usdc = IERC20(_usdc);
    }

    // ─────────────────────────────────────────────────────────────
    // Write functions
    // ─────────────────────────────────────────────────────────────

    /**
     * Register an invoice on-chain. Called by the Settl backend (or payer) before funding.
     * `milestoneAmounts` must have at least 1 entry; their sum equals the total deposit.
     */
    function createInvoice(
        bytes32 invoiceId,
        address payee,
        uint256[] calldata milestoneAmounts,
        uint256 timeoutSeconds,
        TimeoutDefault timeoutDefault
    ) external {
        require(_invoices[invoiceId].milestoneCount == 0, "Invoice already exists");
        require(milestoneAmounts.length > 0 && milestoneAmounts.length <= 10, "Invalid milestone count");
        require(payee != address(0), "Invalid payee");

        Invoice storage inv = _invoices[invoiceId];
        inv.payee = payee;
        inv.timeoutDefault = timeoutDefault;
        inv.timeoutSeconds = timeoutSeconds;
        inv.status = InvoiceStatus.DRAFT;
        inv.milestoneCount = uint8(milestoneAmounts.length);

        for (uint8 i = 0; i < uint8(milestoneAmounts.length); i++) {
            inv.milestones[i] = Milestone({ amount: milestoneAmounts[i], status: MilestoneStatus.LOCKED });
        }
    }

    /**
     * Fund the invoice. Caller becomes the recorded payer.
     * Requires a prior ERC-20 approval: USDC.approve(escrow, total).
     */
    function fund(bytes32 invoiceId) external {
        Invoice storage inv = _invoices[invoiceId];
        require(inv.milestoneCount > 0, "Invoice not found");
        require(inv.status == InvoiceStatus.DRAFT, "Invoice not in DRAFT");

        uint256 total = 0;
        for (uint8 i = 0; i < inv.milestoneCount; i++) {
            total += inv.milestones[i].amount;
        }

        inv.payer = msg.sender;
        inv.status = InvoiceStatus.FUNDED;
        inv.fundedAt = block.timestamp;

        require(usdc.transferFrom(msg.sender, address(this), total), "USDC transfer failed");

        emit Funded(invoiceId, msg.sender, inv.payee, total, inv.milestoneCount);
    }

    /**
     * Approve a milestone: releases its USDC to the payee. Only the recorded payer can call.
     * Irreversible. Triggers COMPLETED if all milestones are resolved.
     */
    function approve(bytes32 invoiceId, uint8 milestoneIndex) external {
        Invoice storage inv = _invoices[invoiceId];
        require(inv.status == InvoiceStatus.FUNDED, "Invoice not FUNDED");
        require(msg.sender == inv.payer, "Only payer can approve");
        require(milestoneIndex < inv.milestoneCount, "Invalid milestone index");

        Milestone storage ms = inv.milestones[milestoneIndex];
        require(ms.status == MilestoneStatus.LOCKED, "Milestone not LOCKED");

        uint256 amount = ms.amount;
        ms.status = MilestoneStatus.RELEASED;

        require(usdc.transfer(inv.payee, amount), "USDC transfer failed");

        emit MilestoneReleased(invoiceId, milestoneIndex, amount, inv.payee, false);

        _checkCompletion(invoiceId, inv);
    }

    /**
     * Claim a timeout on a specific milestone. Permissionless — anyone can call.
     * Requires: invoice FUNDED, milestone LOCKED, and the timeout window elapsed from fundedAt.
     *
     * AUTO_RELEASE: sends USDC to payee (freelancer gets paid without explicit approval).
     * AUTO_REFUND:  returns USDC to payer.
     */
    function claimTimeout(bytes32 invoiceId, uint8 milestoneIndex) external {
        Invoice storage inv = _invoices[invoiceId];
        require(inv.status == InvoiceStatus.FUNDED, "Invoice not FUNDED");
        require(milestoneIndex < inv.milestoneCount, "Invalid milestone index");
        require(block.timestamp >= inv.fundedAt + inv.timeoutSeconds, "Timeout not elapsed");

        Milestone storage ms = inv.milestones[milestoneIndex];
        require(ms.status == MilestoneStatus.LOCKED, "Milestone not LOCKED");

        uint256 amount = ms.amount;

        if (inv.timeoutDefault == TimeoutDefault.AUTO_RELEASE) {
            ms.status = MilestoneStatus.RELEASED;
            require(usdc.transfer(inv.payee, amount), "USDC transfer failed");
            emit MilestoneReleased(invoiceId, milestoneIndex, amount, inv.payee, true);
        } else {
            ms.status = MilestoneStatus.REFUNDED;
            require(usdc.transfer(inv.payer, amount), "USDC transfer failed");
            emit MilestoneRefunded(invoiceId, milestoneIndex, amount, inv.payer);
        }

        _checkCompletion(invoiceId, inv);
    }

    /**
     * Cancel an invoice before it has been funded. Only payee can cancel (payer is not set yet).
     */
    function cancel(bytes32 invoiceId) external {
        Invoice storage inv = _invoices[invoiceId];
        require(inv.milestoneCount > 0, "Invoice not found");
        require(inv.status == InvoiceStatus.DRAFT, "Can only cancel DRAFT invoices");
        require(msg.sender == inv.payee, "Only payee can cancel before funding");

        inv.status = InvoiceStatus.CANCELLED;
        emit Cancelled(invoiceId);
    }

    // ─────────────────────────────────────────────────────────────
    // View functions
    // ─────────────────────────────────────────────────────────────

    function getInvoiceStatus(bytes32 invoiceId) external view returns (InvoiceStatus) {
        return _invoices[invoiceId].status;
    }

    function getMilestoneStatus(bytes32 invoiceId, uint8 index) external view returns (MilestoneStatus) {
        return _invoices[invoiceId].milestones[index].status;
    }

    function getMilestoneAmount(bytes32 invoiceId, uint8 index) external view returns (uint256) {
        return _invoices[invoiceId].milestones[index].amount;
    }

    function getPayer(bytes32 invoiceId) external view returns (address) {
        return _invoices[invoiceId].payer;
    }

    function getPayee(bytes32 invoiceId) external view returns (address) {
        return _invoices[invoiceId].payee;
    }

    // ─────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────

    function _checkCompletion(bytes32 invoiceId, Invoice storage inv) internal {
        for (uint8 i = 0; i < inv.milestoneCount; i++) {
            if (inv.milestones[i].status == MilestoneStatus.LOCKED) return;
        }
        inv.status = InvoiceStatus.COMPLETED;
    }
}

import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import type { SettlEscrow, MockUSDC } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const USDC = (n: number) => BigInt(n) * 10n ** 6n; // 6 decimals

function invoiceId(label: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(label));
}

describe("SettlEscrow", () => {
  let escrow: SettlEscrow;
  let usdc: MockUSDC;
  let backend: HardhatEthersSigner;
  let payer: HardhatEthersSigner;
  let payee: HardhatEthersSigner;
  let stranger: HardhatEthersSigner;

  const TIMEOUT = 7 * 24 * 60 * 60; // 7 days in seconds
  const AUTO_RELEASE = 0;
  const AUTO_REFUND = 1;

  const M0 = USDC(600);
  const M1 = USDC(600);
  const TOTAL = M0 + M1;

  beforeEach(async () => {
    [backend, payer, payee, stranger] = await ethers.getSigners();

    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    usdc = (await MockUSDCFactory.deploy()) as MockUSDC;
    await usdc.waitForDeployment();

    const EscrowFactory = await ethers.getContractFactory("SettlEscrow");
    escrow = (await EscrowFactory.deploy(await usdc.getAddress())) as SettlEscrow;
    await escrow.waitForDeployment();

    // Fund payer with USDC
    await usdc.mint(payer.address, USDC(10_000));
  });

  // ─────────────────────────────────────────────────────────────
  // createInvoice
  // ─────────────────────────────────────────────────────────────

  it("createInvoice with 2 milestones: state DRAFT", async () => {
    const id = invoiceId("inv-1");
    await escrow.createInvoice(id, payee.address, [M0, M1], TIMEOUT, AUTO_RELEASE);
    expect(await escrow.getInvoiceStatus(id)).to.equal(0); // DRAFT
  });

  it("createInvoice duplicate: reverts", async () => {
    const id = invoiceId("inv-dup");
    await escrow.createInvoice(id, payee.address, [M0, M1], TIMEOUT, AUTO_RELEASE);
    await expect(
      escrow.createInvoice(id, payee.address, [M0], TIMEOUT, AUTO_RELEASE),
    ).to.be.revertedWith("Invoice already exists");
  });

  // ─────────────────────────────────────────────────────────────
  // fund
  // ─────────────────────────────────────────────────────────────

  it("fund by payer: pulls USDC, invoice FUNDED, both milestones LOCKED, Funded emitted", async () => {
    const id = invoiceId("inv-fund");
    await escrow.createInvoice(id, payee.address, [M0, M1], TIMEOUT, AUTO_RELEASE);

    await usdc.connect(payer).approve(await escrow.getAddress(), TOTAL);

    await expect(escrow.connect(payer).fund(id))
      .to.emit(escrow, "Funded")
      .withArgs(id, payer.address, payee.address, TOTAL, 2n);

    expect(await escrow.getInvoiceStatus(id)).to.equal(1); // FUNDED
    expect(await escrow.getMilestoneStatus(id, 0)).to.equal(0); // LOCKED
    expect(await escrow.getMilestoneStatus(id, 1)).to.equal(0); // LOCKED
    expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(TOTAL);
  });

  it("fund before createInvoice: reverts", async () => {
    const id = invoiceId("inv-no-create");
    await expect(escrow.connect(payer).fund(id)).to.be.revertedWith("Invoice not found");
  });

  it("fund twice: reverts", async () => {
    const id = invoiceId("inv-fund2");
    await escrow.createInvoice(id, payee.address, [M0, M1], TIMEOUT, AUTO_RELEASE);
    await usdc.connect(payer).approve(await escrow.getAddress(), TOTAL * 2n);
    await escrow.connect(payer).fund(id);
    await expect(escrow.connect(payer).fund(id)).to.be.revertedWith("Invoice not in DRAFT");
  });

  // ─────────────────────────────────────────────────────────────
  // approve
  // ─────────────────────────────────────────────────────────────

  it("approve M0 by payer: USDC → payee, RELEASED, event emitted", async () => {
    const id = invoiceId("inv-approve");
    await escrow.createInvoice(id, payee.address, [M0, M1], TIMEOUT, AUTO_RELEASE);
    await usdc.connect(payer).approve(await escrow.getAddress(), TOTAL);
    await escrow.connect(payer).fund(id);

    const before = await usdc.balanceOf(payee.address);

    await expect(escrow.connect(payer).approve(id, 0))
      .to.emit(escrow, "MilestoneReleased")
      .withArgs(id, 0, M0, payee.address, false);

    expect(await escrow.getMilestoneStatus(id, 0)).to.equal(1); // RELEASED
    expect(await usdc.balanceOf(payee.address)).to.equal(before + M0);
  });

  it("approve M0 by payee (not payer): reverts", async () => {
    const id = invoiceId("inv-approve-wrong");
    await escrow.createInvoice(id, payee.address, [M0, M1], TIMEOUT, AUTO_RELEASE);
    await usdc.connect(payer).approve(await escrow.getAddress(), TOTAL);
    await escrow.connect(payer).fund(id);

    await expect(escrow.connect(payee).approve(id, 0)).to.be.revertedWith("Only payer can approve");
  });

  it("approve already-released milestone: reverts", async () => {
    const id = invoiceId("inv-double-approve");
    await escrow.createInvoice(id, payee.address, [M0, M1], TIMEOUT, AUTO_RELEASE);
    await usdc.connect(payer).approve(await escrow.getAddress(), TOTAL);
    await escrow.connect(payer).fund(id);
    await escrow.connect(payer).approve(id, 0);

    await expect(escrow.connect(payer).approve(id, 0)).to.be.revertedWith("Milestone not LOCKED");
  });

  it("approve before fund: reverts", async () => {
    const id = invoiceId("inv-approve-prefund");
    await escrow.createInvoice(id, payee.address, [M0, M1], TIMEOUT, AUTO_RELEASE);
    await expect(escrow.connect(payer).approve(id, 0)).to.be.revertedWith("Invoice not FUNDED");
  });

  it("approve both milestones: invoice COMPLETED", async () => {
    const id = invoiceId("inv-complete");
    await escrow.createInvoice(id, payee.address, [M0, M1], TIMEOUT, AUTO_RELEASE);
    await usdc.connect(payer).approve(await escrow.getAddress(), TOTAL);
    await escrow.connect(payer).fund(id);
    await escrow.connect(payer).approve(id, 0);
    await escrow.connect(payer).approve(id, 1);

    expect(await escrow.getInvoiceStatus(id)).to.equal(2); // COMPLETED
    expect(await usdc.balanceOf(payee.address)).to.equal(TOTAL);
  });

  // ─────────────────────────────────────────────────────────────
  // claimTimeout
  // ─────────────────────────────────────────────────────────────

  it("claimTimeout before window: reverts", async () => {
    const id = invoiceId("inv-timeout-early");
    await escrow.createInvoice(id, payee.address, [M0, M1], TIMEOUT, AUTO_RELEASE);
    await usdc.connect(payer).approve(await escrow.getAddress(), TOTAL);
    await escrow.connect(payer).fund(id);

    await expect(escrow.claimTimeout(id, 0)).to.be.revertedWith("Timeout not elapsed");
  });

  it("claimTimeout after window, AUTO_RELEASE: releases to payee", async () => {
    const id = invoiceId("inv-timeout-release");
    await escrow.createInvoice(id, payee.address, [M0, M1], TIMEOUT, AUTO_RELEASE);
    await usdc.connect(payer).approve(await escrow.getAddress(), TOTAL);
    await escrow.connect(payer).fund(id);

    await time.increase(TIMEOUT + 1);

    const before = await usdc.balanceOf(payee.address);
    await expect(escrow.claimTimeout(id, 0))
      .to.emit(escrow, "MilestoneReleased")
      .withArgs(id, 0, M0, payee.address, true);

    expect(await usdc.balanceOf(payee.address)).to.equal(before + M0);
    expect(await escrow.getMilestoneStatus(id, 0)).to.equal(1); // RELEASED
  });

  it("claimTimeout after window, AUTO_REFUND: refunds to payer", async () => {
    const id = invoiceId("inv-timeout-refund");
    await escrow.createInvoice(id, payee.address, [M0, M1], TIMEOUT, AUTO_REFUND);
    await usdc.connect(payer).approve(await escrow.getAddress(), TOTAL);
    await escrow.connect(payer).fund(id);

    const before = await usdc.balanceOf(payer.address);
    await time.increase(TIMEOUT + 1);

    await expect(escrow.claimTimeout(id, 0))
      .to.emit(escrow, "MilestoneRefunded")
      .withArgs(id, 0, M0, payer.address);

    expect(await usdc.balanceOf(payer.address)).to.equal(before + M0);
    expect(await escrow.getMilestoneStatus(id, 0)).to.equal(2); // REFUNDED
  });

  // ─────────────────────────────────────────────────────────────
  // cancel
  // ─────────────────────────────────────────────────────────────

  it("cancel before fund: CANCELLED", async () => {
    const id = invoiceId("inv-cancel");
    await escrow.createInvoice(id, payee.address, [M0, M1], TIMEOUT, AUTO_RELEASE);

    await expect(escrow.connect(payee).cancel(id))
      .to.emit(escrow, "Cancelled")
      .withArgs(id);

    expect(await escrow.getInvoiceStatus(id)).to.equal(3); // CANCELLED
  });

  it("cancel after fund: reverts", async () => {
    const id = invoiceId("inv-cancel-funded");
    await escrow.createInvoice(id, payee.address, [M0, M1], TIMEOUT, AUTO_RELEASE);
    await usdc.connect(payer).approve(await escrow.getAddress(), TOTAL);
    await escrow.connect(payer).fund(id);

    await expect(escrow.connect(payee).cancel(id)).to.be.revertedWith(
      "Can only cancel DRAFT invoices",
    );
  });
});

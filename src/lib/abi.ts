// Minimal ABIs for the deployed SettlEscrow + USDC, as viem const tuples.
// SettlEscrow surface mirrors contracts/contracts/SettlEscrow.sol.

export const SETTL_ESCROW_ABI = [
  {
    type: "function",
    name: "createInvoice",
    stateMutability: "nonpayable",
    inputs: [
      { name: "invoiceId", type: "bytes32" },
      { name: "payee", type: "address" },
      { name: "milestoneAmounts", type: "uint256[]" },
      { name: "timeoutSeconds", type: "uint256" },
      { name: "timeoutDefault", type: "uint8" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "fund",
    stateMutability: "nonpayable",
    inputs: [{ name: "invoiceId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "invoiceId", type: "bytes32" },
      { name: "milestoneIndex", type: "uint8" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "claimTimeout",
    stateMutability: "nonpayable",
    inputs: [
      { name: "invoiceId", type: "bytes32" },
      { name: "milestoneIndex", type: "uint8" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "cancel",
    stateMutability: "nonpayable",
    inputs: [{ name: "invoiceId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "event",
    name: "Funded",
    inputs: [
      { name: "invoiceId", type: "bytes32", indexed: true },
      { name: "payer", type: "address", indexed: false },
      { name: "payee", type: "address", indexed: false },
      { name: "total", type: "uint256", indexed: false },
      { name: "milestoneCount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "MilestoneReleased",
    inputs: [
      { name: "invoiceId", type: "bytes32", indexed: true },
      { name: "milestoneIndex", type: "uint8", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "payee", type: "address", indexed: false },
      { name: "viaTimeout", type: "bool", indexed: false },
    ],
  },
  {
    type: "event",
    name: "MilestoneRefunded",
    inputs: [
      { name: "invoiceId", type: "bytes32", indexed: true },
      { name: "milestoneIndex", type: "uint8", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "payer", type: "address", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Cancelled",
    inputs: [{ name: "invoiceId", type: "bytes32", indexed: true }],
  },
] as const;

export const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

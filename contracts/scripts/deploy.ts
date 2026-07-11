import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const usdcAddress = process.env.USDC_ADDRESS;
  if (!usdcAddress) {
    throw new Error("USDC_ADDRESS env var is required. Set it in ../.env");
  }

  console.log(`Deploying SettlEscrow on network: ${network.name}`);
  console.log(`  USDC: ${usdcAddress}`);

  const [deployer] = await ethers.getSigners();
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);

  const EscrowFactory = await ethers.getContractFactory("SettlEscrow");
  const escrow = await EscrowFactory.deploy(usdcAddress);
  await escrow.waitForDeployment();

  const address = await escrow.getAddress();
  console.log(`\nSettlEscrow deployed to: ${address}`);

  // Write the address back to a deploy-output.json for easy reference.
  const output = {
    network: network.name,
    escrowAddress: address,
    usdcAddress,
    deployedAt: new Date().toISOString(),
  };
  const outPath = path.join(__dirname, "..", "deploy-output.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\nSaved to: ${outPath}`);
  console.log("\nNext steps:");
  console.log(`  1. Add to ../.env:  ESCROW_ADDRESS=${address}`);
  console.log(`  2. Add to ../.env:  NEXT_PUBLIC_ESCROW_ADDRESS=${address}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

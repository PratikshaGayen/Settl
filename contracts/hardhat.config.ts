import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const deployerKey = process.env.DEPLOYER_PRIVATE_KEY;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    arc: {
      url: process.env.ARC_RPC_URL ?? "",
      chainId: Number(process.env.ARC_CHAIN_ID ?? "0"),
      accounts: deployerKey ? [deployerKey] : [],
    },
  },
};

export default config;

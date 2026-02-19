require("@nomicfoundation/hardhat-toolbox");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hedera: {
      url: process.env.HEDERA_NETWORK === "mainnet" 
        ? "https://mainnet.hashio.io/api" 
        : "https://testnet.hashio.io/api",
      accounts: process.env.HEDERA_PRIVATE_KEY ? [process.env.HEDERA_PRIVATE_KEY] : [],
      chainId: process.env.HEDERA_NETWORK === "mainnet" ? 295 : 296,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

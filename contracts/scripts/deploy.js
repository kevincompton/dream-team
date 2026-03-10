const hre = require("hardhat");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

const HASHSCAN_BASE =
  process.env.HEDERA_NETWORK === "mainnet"
    ? "https://hashscan.io/mainnet"
    : "https://hashscan.io/testnet";

function hashscanUrl(value) {
  return `${HASHSCAN_BASE}/contract/${encodeURIComponent(value)}`;
}

async function main() {
  console.log("Deploying KnowledgePool on Hedera...");
  const HBAR_DECIMALS = 8;

  const rewardProposer = hre.ethers.parseUnits(process.env.REWARD_PROPOSER_HBAR || "0.001", HBAR_DECIMALS);
  const rewardValidator = hre.ethers.parseUnits(process.env.REWARD_VALIDATOR_HBAR || "0.001", HBAR_DECIMALS);
  const rewardExecutor = hre.ethers.parseUnits(process.env.REWARD_EXECUTOR_HBAR || "0.001", HBAR_DECIMALS);

  const INITIAL_HBAR = process.env.DEPLOY_FUND_HBAR || "5";

  const KnowledgePool = await hre.ethers.getContractFactory("KnowledgePool");
  const knowledgePool = await KnowledgePool.deploy(rewardProposer, rewardValidator, rewardExecutor, {
    value: hre.ethers.parseEther(INITIAL_HBAR),
  });

  await knowledgePool.waitForDeployment();
  const address = await knowledgePool.getAddress();
  const balance = await hre.ethers.provider.getBalance(address);

  console.log("KnowledgePool deployed at:", address);
  console.log("HashScan:", hashscanUrl(address));
  console.log("Contract balance:", hre.ethers.formatEther(balance), "HBAR");
  console.log(
    "Rewards per task (HBAR) — Proposer:",
    hre.ethers.formatUnits(rewardProposer, HBAR_DECIMALS),
    "Validator:",
    hre.ethers.formatUnits(rewardValidator, HBAR_DECIMALS),
    "Executor:",
    hre.ethers.formatUnits(rewardExecutor, HBAR_DECIMALS)
  );
  console.log("\nAdd to .env:");
  console.log(`KNOWLEDGE_POOL_CONTRACT_ADDRESS=${address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

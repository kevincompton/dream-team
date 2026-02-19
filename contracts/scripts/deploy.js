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
  console.log("Desplegando KnowledgePool en Hedera...");
  const HBAR_DECIMALS = 8;

  // Recompensas por tarea (configuradas en HBAR, convertidas internamente a wei)
  const rewardProposer = hre.ethers.parseUnits(process.env.REWARD_PROPOSER_HBAR || "0.001", HBAR_DECIMALS);
  const rewardValidator = hre.ethers.parseUnits(process.env.REWARD_VALIDATOR_HBAR || "0.001", HBAR_DECIMALS);
  const rewardExecutor = hre.ethers.parseUnits(process.env.REWARD_EXECUTOR_HBAR || "0.001", HBAR_DECIMALS);

  const KnowledgePool = await hre.ethers.getContractFactory("KnowledgePool");
  const knowledgePool = await KnowledgePool.deploy(rewardProposer, rewardValidator, rewardExecutor);

  await knowledgePool.waitForDeployment();
  const address = await knowledgePool.getAddress();

  console.log("KnowledgePool desplegado en:", address);
  console.log("HashScan contrato:", hashscanUrl(address));
  console.log(
    "Recompensas por tarea (HBAR) - Proposer:",
    hre.ethers.formatUnits(rewardProposer, HBAR_DECIMALS),
    "Validator:",
    hre.ethers.formatUnits(rewardValidator, HBAR_DECIMALS),
    "Executor:",
    hre.ethers.formatUnits(rewardExecutor, HBAR_DECIMALS)
  );
  console.log("Guarda esta dirección en tu archivo .env como KNOWLEDGE_POOL_CONTRACT_ADDRESS");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

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

  // Recompensas por tarea (en wei; 1e15 = 0.001 HBAR). Ajustar según red.
  const rewardProposer = process.env.REWARD_PROPOSER_WEI || hre.ethers.parseEther("0.001");
  const rewardValidator = process.env.REWARD_VALIDATOR_WEI || hre.ethers.parseEther("0.001");
  const rewardExecutor = process.env.REWARD_EXECUTOR_WEI || hre.ethers.parseEther("0.001");

  const KnowledgePool = await hre.ethers.getContractFactory("KnowledgePool");
  const knowledgePool = await KnowledgePool.deploy(rewardProposer, rewardValidator, rewardExecutor);

  await knowledgePool.waitForDeployment();
  const address = await knowledgePool.getAddress();

  console.log("KnowledgePool desplegado en:", address);
  console.log("HashScan contrato:", hashscanUrl(address));
  console.log("Recompensas por tarea - Proposer:", rewardProposer.toString(), "Validator:", rewardValidator.toString(), "Executor:", rewardExecutor.toString());
  console.log("Guarda esta dirección en tu archivo .env como KNOWLEDGE_POOL_CONTRACT_ADDRESS");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

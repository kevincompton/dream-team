import dotenv from "dotenv";
import { ethers } from "ethers";

dotenv.config();

const HBAR_DECIMALS = 8;

const CONTRACT_ABI = [
  "function knowledgeCount() public view returns (uint256)",
  "function poolBalance() public view returns (uint256)",
  "function totalRewardPerTask() public view returns (uint256)",
  "function getKnowledge(uint256 id) public view returns (address, string memory, uint256, bool, bool, address, address)",
];

function shortAddress(value) {
  if (!value || value.length < 12) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

async function main() {
  if (!process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS) {
    throw new Error("KNOWLEDGE_POOL_CONTRACT_ADDRESS no está definido en .env");
  }

  const provider = new ethers.JsonRpcProvider(
    process.env.HEDERA_NETWORK === "mainnet"
      ? "https://mainnet.hashio.io/api"
      : "https://testnet.hashio.io/api"
  );

  const contract = new ethers.Contract(
    process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS,
    CONTRACT_ABI,
    provider
  );

  const knowledgeCount = Number(await contract.knowledgeCount());
  const poolBalance = await contract.poolBalance();
  const totalRewardPerTask = await contract.totalRewardPerTask();

  console.log("\n=== HIVE CHAIN STATE ===");
  console.log(`Contrato: ${process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS}`);
  console.log(`Knowledge Count: ${knowledgeCount}`);
  console.log(`Pool Balance: ${ethers.formatUnits(poolBalance, HBAR_DECIMALS)} HBAR`);
  console.log(`Reward/Task: ${ethers.formatUnits(totalRewardPerTask, HBAR_DECIMALS)} HBAR`);

  if (knowledgeCount === 0) {
    console.log("No hay knowledge items todavía.");
    return;
  }

  const fromId = Math.max(1, knowledgeCount - 4);
  console.log(`\nÚltimos items (${fromId}..${knowledgeCount}):`);

  const counters = {
    proposedOnly: 0,
    validatedPendingExecution: 0,
    executedPendingValidation: 0,
    completed: 0,
  };

  for (let id = 1; id <= knowledgeCount; id += 1) {
    const [, , , validated, executed] = await contract.getKnowledge(id);
    if (!validated && !executed) counters.proposedOnly += 1;
    else if (validated && !executed) counters.validatedPendingExecution += 1;
    else if (!validated && executed) counters.executedPendingValidation += 1;
    else if (validated && executed) counters.completed += 1;
  }

  console.log("\nResumen de estados:");
  console.log(`- Proposed only (V:N E:N): ${counters.proposedOnly}`);
  console.log(`- Pending execution (V:Y E:N): ${counters.validatedPendingExecution}`);
  console.log(`- Pending validation (V:N E:Y): ${counters.executedPendingValidation}`);
  console.log(`- Completed (V:Y E:Y): ${counters.completed}`);

  for (let id = fromId; id <= knowledgeCount; id += 1) {
    const [proposer, content, timestamp, validated, executed, validator, executor] = await contract.getKnowledge(id);
    console.log(
      `#${id} | V:${validated ? "Y" : "N"} E:${executed ? "Y" : "N"} | proposer:${shortAddress(
        proposer
      )} validator:${shortAddress(validator)} executor:${shortAddress(executor)} | ts:${timestamp.toString()}`
    );
    console.log(`   ${String(content).slice(0, 110)}${String(content).length > 110 ? "..." : ""}`);
  }

  console.log("========================\n");
}

main().catch((error) => {
  console.error("Error leyendo estado on-chain:", error.message || error);
  process.exit(1);
});

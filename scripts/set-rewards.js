import dotenv from "dotenv";
import { ethers } from "ethers";

dotenv.config();

const HBAR_DECIMALS = 8;
const HASHSCAN_BASE =
  process.env.HEDERA_NETWORK === "mainnet"
    ? "https://hashscan.io/mainnet"
    : "https://hashscan.io/testnet";

function hashscanTxUrl(value) {
  return `${HASHSCAN_BASE}/tx/${encodeURIComponent(value)}`;
}

function hashscanContractUrl(value) {
  return `${HASHSCAN_BASE}/contract/${encodeURIComponent(value)}`;
}

const CONTRACT_ABI = [
  "function setRewards(uint256 _rewardProposer, uint256 _rewardValidator, uint256 _rewardExecutor) external",
  "function totalRewardPerTask() public view returns (uint256)",
  "function rewardProposer() public view returns (uint256)",
  "function rewardValidator() public view returns (uint256)",
  "function rewardExecutor() public view returns (uint256)",
];

async function setRewards() {
  if (!process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS) {
    throw new Error("KNOWLEDGE_POOL_CONTRACT_ADDRESS no está definido en .env");
  }

  const provider = new ethers.JsonRpcProvider(
    process.env.HEDERA_NETWORK === "mainnet"
      ? "https://mainnet.hashio.io/api"
      : "https://testnet.hashio.io/api"
  );

  const wallet = new ethers.Wallet(process.env.HEDERA_PRIVATE_KEY, provider);
  const contract = new ethers.Contract(process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

  const proposer = process.env.REWARD_PROPOSER_HBAR
    ? ethers.parseUnits(process.env.REWARD_PROPOSER_HBAR, HBAR_DECIMALS)
    : ethers.parseUnits("0.001", HBAR_DECIMALS);
  const validator = process.env.REWARD_VALIDATOR_HBAR
    ? ethers.parseUnits(process.env.REWARD_VALIDATOR_HBAR, HBAR_DECIMALS)
    : ethers.parseUnits("0.001", HBAR_DECIMALS);
  const executor = process.env.REWARD_EXECUTOR_HBAR
    ? ethers.parseUnits(process.env.REWARD_EXECUTOR_HBAR, HBAR_DECIMALS)
    : ethers.parseUnits("0.001", HBAR_DECIMALS);

  console.log("Configurando recompensas...");
  console.log(`Proposer: ${ethers.formatUnits(proposer, HBAR_DECIMALS)} HBAR`);
  console.log(`Validator: ${ethers.formatUnits(validator, HBAR_DECIMALS)} HBAR`);
  console.log(`Executor: ${ethers.formatUnits(executor, HBAR_DECIMALS)} HBAR`);

  const tx = await contract.setRewards(proposer, validator, executor);
  console.log(`TX enviada: ${tx.hash}`);
  console.log(`HashScan TX: ${hashscanTxUrl(tx.hash)}`);
  const receipt = await tx.wait();
  console.log(`✓ Recompensas actualizadas. TX: ${receipt.hash}`);
  console.log(`HashScan recibo: ${hashscanTxUrl(receipt.hash)}`);
  console.log(`HashScan contrato: ${hashscanContractUrl(process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS)}`);

  const totalReward = await contract.totalRewardPerTask();
  console.log(`Recompensa total por tarea: ${ethers.formatUnits(totalReward, HBAR_DECIMALS)} HBAR`);
}

setRewards().catch(console.error);
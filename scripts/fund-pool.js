import dotenv from "dotenv";
import { ethers } from "ethers";

dotenv.config();

/** EVM uses wei (18 decimals); Hedera min non-zero value is 10^10 wei (1 tinybar) */
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
  "function fundPool() external payable",
  "function poolBalance() public view returns (uint256)",
  "function totalRewardPerTask() public view returns (uint256)"
];

async function fundPool() {
  if (!process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS) {
    throw new Error("KNOWLEDGE_POOL_CONTRACT_ADDRESS no está definido en .env");
  }

  const provider = new ethers.JsonRpcProvider(
    process.env.HEDERA_NETWORK === "mainnet"
      ? "https://mainnet.hashio.io/api"
      : "https://testnet.hashio.io/api"
  );
  const wallet = new ethers.Wallet(process.env.HEDERA_PRIVATE_KEY, provider);
  const contract = new ethers.Contract(
    process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS,
    CONTRACT_ABI,
    wallet
  );

  const totalReward = await contract.totalRewardPerTask();

  const amount = process.env.FUND_AMOUNT
    ? BigInt(process.env.FUND_AMOUNT)
    : process.env.FUND_AMOUNT_HBAR
      ? ethers.parseEther(process.env.FUND_AMOUNT_HBAR)
      : ethers.parseEther("0.1");

  if (amount <= 0n) {
    throw new Error("FUND_AMOUNT/FUND_AMOUNT_HBAR debe ser mayor que 0");
  }

  const minWei = 10n ** 10n; // Hedera min non-zero value
  if (amount > 0n && amount < minWei) {
    throw new Error(`FUND_AMOUNT debe ser >= 1 tinybar (10^10 wei). Recibido: ${amount.toString()} wei`);
  }

  console.log(`Financiando pool con ${ethers.formatEther(amount)} HBAR...`);
  console.log(`Recompensa total por tarea: ${ethers.formatEther(totalReward)} HBAR`);
  const tasksPossible = totalReward > 0n ? amount / totalReward : 0n;
  console.log(`Tareas posibles con este fondo: ~${tasksPossible.toString()}`);

  const tx = await contract.fundPool({ value: amount });
  console.log(`TX enviada: ${tx.hash}`);
  console.log(`HashScan TX: ${hashscanTxUrl(tx.hash)}`);
  const receipt = await tx.wait();
  console.log(`✓ Pool financiado exitosamente. TX: ${receipt.hash}`);
  console.log(`HashScan recibo: ${hashscanTxUrl(receipt.hash)}`);
  console.log(`HashScan contrato: ${hashscanContractUrl(process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS)}`);

  const balance = await contract.poolBalance();
  console.log(`Balance actual del pool: ${ethers.formatEther(balance)} HBAR`);
}

fundPool().catch(console.error);

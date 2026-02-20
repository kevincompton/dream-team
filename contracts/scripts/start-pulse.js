const hre = require("hardhat");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

const KNOWLEDGE_POOL_ABI = [
  "function startPulse(uint256 intervalSeconds) external",
  "function stopPulse() external",
  "function pulseInterval() public view returns (uint256)",
  "function nextPulseId() public view returns (uint256)",
  "event PulseScheduled(address scheduleAddress, uint256 pulseId, uint256 time)",
];

async function main() {
  const contractAddress = process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS;
  if (!contractAddress) {
    console.error("Set KNOWLEDGE_POOL_CONTRACT_ADDRESS in .env");
    process.exit(1);
  }

  const action = process.env.PULSE_ACTION || process.argv[2] || "start";
  const interval = Number(process.env.PULSE_INTERVAL_SECONDS || 30);

  const [signer] = await hre.ethers.getSigners();
  const contract = new hre.ethers.Contract(contractAddress, KNOWLEDGE_POOL_ABI, signer);

  if (action === "stop") {
    console.log("[PULSE] Stopping pulse...");
    const tx = await contract.stopPulse();
    await tx.wait();
    console.log("[PULSE] Pulse stopped. TX:", tx.hash);
    return;
  }

  const currentInterval = await contract.pulseInterval();
  if (currentInterval > 0n) {
    console.log(`[PULSE] Pulse already running with ${currentInterval}s interval.`);
    console.log("[PULSE] Run with 'stop' arg first to restart with a different interval.");
    return;
  }

  console.log(`[PULSE] Starting — every ${interval}s`);
  console.log(`[PULSE] Signer: ${signer.address}`);
  console.log(`[PULSE] Contract: ${contractAddress}`);

  const tx = await contract.startPulse(interval);
  const receipt = await tx.wait();
  console.log("[PULSE] TX:", tx.hash);

  for (const log of receipt.logs) {
    try {
      const iface = new hre.ethers.Interface(KNOWLEDGE_POOL_ABI);
      const parsed = iface.parseLog(log);
      if (parsed?.name === "PulseScheduled") {
        const fireTime = new Date(Number(parsed.args[2]) * 1000).toISOString();
        console.log(`[PULSE] First pulse scheduled for ${fireTime}`);
        console.log(`[PULSE] Schedule address: ${parsed.args[0]}`);
      }
    } catch {
      // skip
    }
  }

  console.log(`[PULSE] Active — every ${interval}s (alternates servo on/off with sensor)`);
  console.log("[PULSE] The contract will auto-call pulse() via the Hedera Schedule Service.");
  console.log("[PULSE] Monitor events: https://hashscan.io/testnet/contract/" + contractAddress + "/events");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[PULSE] Error:", error.message || error);
    process.exit(1);
  });

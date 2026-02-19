#!/usr/bin/env node
/**
 * HIVE Research CLI — called by the OpenClaw skill
 * Usage: node ask-hive.js "your question"
 */

const question = process.argv.slice(2).join(" ").trim();

if (!question) {
  console.error("Usage: node ask-hive.js \"your question\"");
  process.exit(1);
}

const MCP_URL = process.env.HIVE_MCP_URL || "http://localhost:3001";

console.log(`Submitting to HIVE Protocol: "${question}"`);
console.log("Waiting for autonomous agents to research and verify on Hedera...\n");

try {
  const res = await fetch(`${MCP_URL}/research`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, userId: "openclaw" }),
  });

  const data = await res.json();

  if (data.status === "completed") {
    console.log(`✅ HIVE Answer:\n${data.content}`);
    console.log(`\n🔗 Verified on Hedera: https://hashscan.io/testnet/tx/${data.txHash}`);
    if (data.topicId) {
      console.log(`📚 Knowledge Topic: https://hashscan.io/testnet/topic/${data.topicId}`);
    }
  } else if (data.status === "timeout") {
    console.log(`⏳ HIVE agents are still processing knowledge #${data.knowledgeId}.`);
    console.log(`Ask again in a moment or check status at ${MCP_URL}/status`);
    console.log(`TX submitted: https://hashscan.io/testnet/tx/${data.txHash}`);
  } else if (data.status === "accepted") {
    console.log(`📨 Submitted to HIVE. ${data.message}`);
    if (data.txHash) {
      console.log(`🔗 TX: https://hashscan.io/testnet/tx/${data.txHash}`);
    }
  } else {
    console.log(`HIVE response: ${JSON.stringify(data, null, 2)}`);
  }
} catch (err) {
  console.error(`❌ Could not reach HIVE MCP at ${MCP_URL}`);
  console.error(`Make sure "npm run mcp" is running. Error: ${err.message}`);
  process.exit(1);
}

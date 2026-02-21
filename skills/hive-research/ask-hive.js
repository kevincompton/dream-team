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
const RETRY_ON_TIMEOUT = String(process.env.HIVE_RETRY_ON_TIMEOUT || "true").toLowerCase() !== "false";
const RETRY_DELAY_MS = Math.max(5_000, Number(process.env.HIVE_RETRY_DELAY_MS || 20_000));
const OUTPUT_MODE = (process.env.HIVE_OUTPUT_MODE || "clean").toLowerCase();
const VERBOSE = OUTPUT_MODE === "verbose";

function info(message) {
  if (VERBOSE) console.log(message);
}

async function callResearch(question) {
  // Write a dot to stderr every 10s so OpenClaw's no-output watchdog doesn't kill
  // this process while we wait for the blockchain pipeline to complete (~40-60s).
  const heartbeat = setInterval(() => process.stderr.write("."), 10_000);
  try {
    const res = await fetch(`${MCP_URL}/research`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, userId: "openclaw" }),
    });
    return res.json();
  } finally {
    clearInterval(heartbeat);
  }
}

function printCompleted(data) {
  if (OUTPUT_MODE === "clean") {
    console.log(String(data.content || "").trim());
  } else {
    console.log(`✅ HIVE Answer:\n${data.content}`);
  }

  if (data.reused) {
    info(`\n♻️ Reused existing knowledge #${data.knowledgeId}. No new on-chain proposal was created.`);
  }
  if (data.txHash) {
    console.log(`\n🔗 Verified on Hedera: https://hashscan.io/testnet/tx/${data.txHash}`);
  }
  if (data.topicId) {
    console.log(`📚 Topic: https://hashscan.io/testnet/topic/${data.topicId}`);
  }
}

info(`Submitting to HIVE Protocol: "${question}"`);
info("Waiting for autonomous agents to research and verify on Hedera...\n");

try {
  const data = await callResearch(question);

  if (data.status === "completed") {
    printCompleted(data);
  } else if (data.status === "timeout") {
    if (RETRY_ON_TIMEOUT) {
      info(`⏳ Still processing knowledge #${data.knowledgeId}. Retrying once in ${Math.floor(RETRY_DELAY_MS / 1000)}s...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      const retry = await callResearch(question);
      if (retry.status === "completed") {
        printCompleted(retry);
      } else {
        console.log(`⏳ Processing knowledge #${data.knowledgeId}. Try again shortly.`);
        if (data.txHash) {
          console.log(`TX submitted: https://hashscan.io/testnet/tx/${data.txHash}`);
        }
      }
    } else {
      console.log(`⏳ Processing knowledge #${data.knowledgeId}. Try again shortly.`);
      if (data.txHash) {
        console.log(`TX submitted: https://hashscan.io/testnet/tx/${data.txHash}`);
      }
    }
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

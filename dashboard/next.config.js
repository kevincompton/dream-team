const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    HEDERA_NETWORK: process.env.HEDERA_NETWORK,
    KNOWLEDGE_POOL_CONTRACT_ADDRESS: process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS,
    NEXT_PUBLIC_KNOWLEDGE_POOL_CONTRACT_ADDRESS:
      process.env.NEXT_PUBLIC_KNOWLEDGE_POOL_CONTRACT_ADDRESS || process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS,
    NEXT_PUBLIC_USE_MOCK_DATA: process.env.NEXT_PUBLIC_USE_MOCK_DATA,
    NEXT_PUBLIC_HCS_TOPIC_ID: process.env.NEXT_PUBLIC_HCS_TOPIC_ID,
    NEXT_PUBLIC_HIP991_TOPICS: process.env.NEXT_PUBLIC_HIP991_TOPICS || process.env.HIP991_TOPICS || "[]",
    NEXT_PUBLIC_AGENT_ACCOUNT_IDS: process.env.NEXT_PUBLIC_AGENT_ACCOUNT_IDS,
    NEXT_PUBLIC_DASHBOARD_DEBUG: process.env.NEXT_PUBLIC_DASHBOARD_DEBUG,
    NEXT_PUBLIC_USER_WALLET: process.env.NEXT_PUBLIC_USER_WALLET,
  },
};

module.exports = nextConfig;

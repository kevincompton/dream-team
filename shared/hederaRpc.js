import { ethers } from "ethers";

function getHederaNetwork() {
  const network = String(process.env.HEDERA_NETWORK || "testnet").toLowerCase();
  if (network !== "testnet" && network !== "mainnet") {
    throw new Error(`HEDERA_NETWORK inválido: ${network}. Usa testnet o mainnet.`);
  }
  return network;
}

function getHederaChainId() {
  const raw = process.env.HEDERA_EVM_CHAIN_ID;
  if (!raw) {
    throw new Error("HEDERA_EVM_CHAIN_ID no está definido en .env");
  }

  const chainId = Number(raw);
  if (!Number.isFinite(chainId) || chainId <= 0) {
    throw new Error(`HEDERA_EVM_CHAIN_ID inválido: ${raw}`);
  }

  return chainId;
}

export function getHederaRpcUrl() {
  const rpcUrl = process.env.HEDERA_EVM_RPC_URL;
  if (!rpcUrl) {
    throw new Error("HEDERA_EVM_RPC_URL no está definido en .env");
  }
  return rpcUrl;
}

export function getHederaRpcUrls() {
  const rawUrls = process.env.HEDERA_EVM_RPC_URLS;
  if (!rawUrls) {
    return [getHederaRpcUrl()];
  }

  const urls = rawUrls
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (urls.length === 0) {
    throw new Error("HEDERA_EVM_RPC_URLS está definido pero vacío");
  }

  return urls;
}

export function createHederaEvmProvider() {
  const network = getHederaNetwork();
  const chainId = getHederaChainId();
  const rpcUrls = getHederaRpcUrls();
  const providerOptions = { staticNetwork: true };
  const networkInfo = { name: `hedera-${network}`, chainId };

  if (rpcUrls.length === 1) {
    return new ethers.JsonRpcProvider(rpcUrls[0], networkInfo, providerOptions);
  }

  const providers = rpcUrls.map((rpcUrl, index) => ({
    provider: new ethers.JsonRpcProvider(rpcUrl, networkInfo, providerOptions),
    priority: index + 1,
    weight: 1,
    stallTimeout: 1500,
  }));

  return new ethers.FallbackProvider(providers, networkInfo, { quorum: 1 });
}

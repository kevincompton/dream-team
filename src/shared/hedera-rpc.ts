import { ethers } from 'ethers';

function getHederaNetwork(): string {
  const network = String(process.env.HEDERA_NETWORK || 'testnet').toLowerCase();
  if (network !== 'testnet' && network !== 'mainnet') {
    throw new Error(`HEDERA_NETWORK invalid: ${network}. Use testnet or mainnet.`);
  }
  return network;
}

function getHederaChainId(): number {
  const raw = process.env.HEDERA_EVM_CHAIN_ID;
  if (!raw) {
    throw new Error('HEDERA_EVM_CHAIN_ID is not defined in .env');
  }
  const chainId = Number(raw);
  if (!Number.isFinite(chainId) || chainId <= 0) {
    throw new Error(`HEDERA_EVM_CHAIN_ID invalid: ${raw}`);
  }
  return chainId;
}

export function getHederaRpcUrl(): string {
  const rpcUrl = process.env.HEDERA_EVM_RPC_URL;
  if (!rpcUrl) {
    throw new Error('HEDERA_EVM_RPC_URL is not defined in .env');
  }
  return rpcUrl;
}

export function getHederaRpcUrls(): string[] {
  const rawUrls = process.env.HEDERA_EVM_RPC_URLS;
  if (!rawUrls) {
    return [getHederaRpcUrl()];
  }
  const urls = rawUrls
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  if (urls.length === 0) {
    throw new Error('HEDERA_EVM_RPC_URLS is defined but empty');
  }
  return urls;
}

export function createHederaEvmProvider(): ethers.JsonRpcProvider | ethers.FallbackProvider {
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

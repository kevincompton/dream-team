import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function truncateAddress(address: string, left = 6, right = 4) {
  if (!address) return "0x0000...0000";
  if (address.length <= left + right) return address;
  return `${address.slice(0, left)}...${address.slice(-right)}`;
}

export function formatRelativeTime(timestamp: number) {
  const diff = Math.max(0, Date.now() - timestamp);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function formatNumber(value: number, maxFractionDigits = 0) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: maxFractionDigits,
  }).format(value);
}

export function randomHash(seed = "") {
  const alphabet = "abcdef0123456789";
  const random = Array.from({ length: 56 })
    .map(() => alphabet[Math.floor(Math.random() * alphabet.length)])
    .join("");
  return `0x${seed.slice(0, 4)}${random.slice(0, 60)}`;
}

function getHashscanNetwork() {
  const network = (process.env.HEDERA_NETWORK || "testnet").toLowerCase();
  return network === "mainnet" ? "mainnet" : "testnet";
}

export function hashscanTxUrl(transactionLoc: string) {
  return `https://hashscan.io/${getHashscanNetwork()}/tx/${encodeURIComponent(transactionLoc)}`;
}

export function hashscanContractUrl(contractId: string) {
  return `https://hashscan.io/${getHashscanNetwork()}/contract/${encodeURIComponent(contractId)}`;
}

export function hashscanTopicUrl(topicId: string) {
  return `https://hashscan.io/${getHashscanNetwork()}/topic/${encodeURIComponent(topicId)}`;
}

export function hashscanSearchUrl(query: string) {
  return hashscanTxUrl(query);
}
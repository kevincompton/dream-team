export const HBAR_DECIMALS = 8;
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export function getHashscanBase(network?: string): string {
  return network === 'mainnet'
    ? 'https://hashscan.io/mainnet'
    : 'https://hashscan.io/testnet';
}

export function hashscanTxUrl(txHash: string, network?: string): string {
  return `${getHashscanBase(network)}/tx/${encodeURIComponent(txHash)}`;
}

export function hashscanContractUrl(address: string, network?: string): string {
  return `${getHashscanBase(network)}/contract/${encodeURIComponent(address)}`;
}

export function hashscanTopicUrl(topicId: string, network?: string): string {
  return `${getHashscanBase(network)}/topic/${topicId}`;
}

export function isRpcRateLimited(error: unknown): boolean {
  const err = error as Record<string, unknown> | null;
  const raw = [
    (err as any)?.shortMessage,
    (err as any)?.message,
    (err as any)?.info?.responseBody,
    (err as any)?.info?.responseStatus,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    raw.includes('error code: 1015') ||
    raw.includes('429') ||
    raw.includes('exceeded maximum retry limit')
  );
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function shortAddress(value: string): string {
  if (!value || value.length < 12) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

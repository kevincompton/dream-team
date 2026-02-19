import type { LiveStats } from "@/types/dashboard";

interface BottomStatusBarProps {
  liveStats: LiveStats;
}

export function BottomStatusBar({ liveStats }: BottomStatusBarProps) {
  return (
    <footer className="border-t border-hive-border bg-hive-bg/95 px-6 py-2 text-xs text-hive-muted">
      <div className="mx-auto grid min-w-[1280px] grid-cols-3 items-center">
        <div className="font-mono text-left">
          Last block: #{liveStats.lastBlock.toLocaleString()} | Last HCS msg: {liveStats.lastHcsMessageAgo}
        </div>
        <div className="text-center">HIVE Protocol v1.0.0 | Hedera Testnet | HIP-991 Active ✅</div>
        <div className="font-mono text-right">Uptime: {liveStats.uptime} | Total Knowledge Artifacts: {liveStats.totalArtifacts}</div>
      </div>
    </footer>
  );
}
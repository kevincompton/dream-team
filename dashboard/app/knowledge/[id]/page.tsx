"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Panel } from "@/components/ui/panel";
import { useDashboardData } from "@/hooks/useDashboardData";
import { hashscanSearchUrl, hashscanTopicUrl, truncateAddress } from "@/lib/utils";

export default function KnowledgeDetailPage() {
  const params = useParams<{ id: string }>();
  const { snapshot } = useDashboardData();
  const knowledgeId = Number(params.id);
  const request = snapshot.requests.find((item) => item.id === knowledgeId) ?? snapshot.requests[0];

  if (!request) {
    return (
      <main className="min-h-screen bg-hive-bg p-6 text-hive-text">
        <p>Knowledge not found.</p>
      </main>
    );
  }

  const explorerUrl = hashscanTopicUrl(request.topicId);

  return (
    <main className="min-h-screen bg-hive-bg px-6 py-6 text-hive-text">
      <div className="mx-auto min-w-[1280px] space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Knowledge Detail #{request.id}</h1>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/" className="text-hive-secondary hover:text-hive-primary">
              ← Back to Dashboard
            </Link>
            <Link href="/agents" className="text-hive-secondary hover:text-hive-primary">
              Agent Detail →
            </Link>
          </div>
        </div>

        <Panel title="Full Question">
          <p className="text-sm leading-6 text-hive-text">{request.question}</p>
        </Panel>

        <Panel title="Complete Result">
          <p className="text-sm leading-6 text-hive-muted">{request.result}</p>
        </Panel>

        <div className="grid grid-cols-2 gap-4">
          <Panel title="HCS Attestation Messages">
            <div className="max-h-[260px] space-y-2 overflow-auto rounded-md border border-hive-border/70 bg-hive-bg/40 p-3 text-xs">
              {snapshot.hcsFeed.map((message) => (
                <div key={message.id} className="border-b border-hive-border/60 pb-2">
                  <p className="font-mono text-hive-muted">{new Date(message.timestamp).toLocaleString()}</p>
                  <p className="text-hive-text">[{message.agent}] {message.action}</p>
                  <a
                    href={hashscanSearchUrl(message.hash)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-hive-secondary underline decoration-dotted"
                  >
                    {truncateAddress(message.hash, 12, 8)}
                  </a>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Funders">
            <div className="space-y-2 text-sm">
              {request.funders.map((funder) => (
                <div key={`${request.id}-${funder.wallet}`} className="flex items-center justify-between rounded-md border border-hive-border/60 bg-hive-bg/40 px-3 py-2">
                  <span className="font-mono text-hive-muted">{funder.wallet}</span>
                  <span className="font-mono text-hive-primary">{funder.amount.toFixed(2)} HBAR</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <Panel title="Artifact Metadata">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="rounded-md border border-hive-border/60 bg-hive-bg/40 p-3">
              <p className="text-hive-muted">HIP-991 Topic ID</p>
              <a href={explorerUrl} target="_blank" rel="noreferrer" className="font-mono text-hive-secondary hover:text-hive-primary">
                {request.topicId}
              </a>
            </div>
            <div className="rounded-md border border-hive-border/60 bg-hive-bg/40 p-3">
              <p className="text-hive-muted">Access Fee</p>
              <p className="font-mono text-hive-primary">{request.accessFee.toFixed(2)} HBAR</p>
            </div>
            <div className="rounded-md border border-hive-border/60 bg-hive-bg/40 p-3">
              <p className="text-hive-muted">Times Accessed</p>
              <p className="font-mono text-hive-text">{request.timesAccessed}</p>
            </div>
          </div>
        </Panel>
      </div>
    </main>
  );
}
"use client";

import { motion } from "framer-motion";
import type { KnowledgeRequest } from "@/types/dashboard";
import { Panel } from "@/components/ui/panel";
import { formatRelativeTime, truncateAddress } from "@/lib/utils";

interface UserHistoryPanelProps {
  requests: KnowledgeRequest[];
}

function toAction(status: KnowledgeRequest["status"]) {
  if (status === "PROPOSED") return "Solicitud creada";
  if (status === "FUNDED") return "Solicitud financiada";
  if (status === "EXECUTING") return "En ejecución";
  if (status === "ATTESTED") return "Atestación completada";
  return "Liquidada";
}

export function UserHistoryPanel({ requests }: UserHistoryPanelProps) {
  const userWallet = process.env.NEXT_PUBLIC_USER_WALLET;
  const normalizedUser = userWallet?.trim().toLowerCase();

  const history = requests
    .slice(0, 8)
    .map((request) => {
      const relatedWallets = [request.proposer, request.validator, request.executor].filter(Boolean).map((value) => value!.toLowerCase());
      const isUserRelated = normalizedUser ? relatedWallets.includes(normalizedUser) : false;

      return {
        id: request.id,
        action: toAction(request.status),
        amount: request.pool,
        when: formatRelativeTime(request.createdAt),
        topicId: request.topicId,
        proposer: request.proposer,
        validator: request.validator,
        executor: request.executor,
        highlighted: isUserRelated,
      };
    })
    .filter((entry) => (normalizedUser ? entry.highlighted : true));

  return (
    <Panel
      title="Historial de Usuario"
      className="h-full"
      rightSlot={<span className="font-mono text-[10px] text-hive-secondary">{userWallet || "NEXT_PUBLIC_USER_WALLET no definido"}</span>}
    >
      <div className="space-y-2">
        {history.length === 0 && (
          <div className="rounded-md border border-hive-border/70 bg-hive-bg/40 px-3 py-3 text-xs text-hive-muted">
            No hay interacciones para la cuenta configurada.
          </div>
        )}

        {history.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-md border px-3 py-2 text-xs ${
              item.highlighted
                ? "border-hive-primary/60 bg-hive-primary/10"
                : "border-hive-border/70 bg-hive-bg/40"
            }`}
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="font-mono text-hive-secondary">KR-{item.id}</span>
              <span className="text-hive-muted">{item.when}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-hive-text">{item.action}</span>
              <span className="font-mono text-hive-primary">{item.amount.toFixed(2)} HBAR</span>
            </div>
            <p className="mt-1 font-mono text-[10px] text-hive-muted">Topic: {truncateAddress(item.topicId, 8, 4)}</p>
            <p className="mt-1 font-mono text-[10px] text-hive-muted">
              P: {truncateAddress(item.proposer || "-", 8, 4)} | V: {truncateAddress(item.validator || "-", 8, 4)} | E: {truncateAddress(item.executor || "-", 8, 4)}
            </p>
          </motion.div>
        ))}
      </div>
    </Panel>
  );
}

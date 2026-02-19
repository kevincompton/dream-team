"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import type { HcsMessage } from "@/types/dashboard";
import { Panel } from "@/components/ui/panel";
import { hashscanSearchUrl, truncateAddress } from "@/lib/utils";

const styles = {
  success: "text-hive-primary",
  request: "text-hive-secondary",
  executor: "text-hive-warning",
  general: "text-slate-100",
};

interface HcsFeedPanelProps {
  messages: HcsMessage[];
}

export function HcsFeedPanel({ messages }: HcsFeedPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [messages]);

  return (
    <Panel title="Live HCS Feed" className="h-full min-h-0" contentClassName="min-h-0">
      <div
        ref={containerRef}
        className="h-full overflow-y-auto rounded-md border border-hive-border/60 bg-hive-terminal p-3 font-mono text-xs"
      >
        <div className="space-y-2">
          {messages
            .slice(0, 50)
            .reverse()
            .map((message, index) => (
              <motion.div
                key={message.id}
                className={styles[message.type]}
                style={{ opacity: Math.max(0.35, 1 - index * 0.02) }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                [{new Date(message.timestamp).toLocaleTimeString()}] [{message.agent}] <span title={message.action}>{message.action}</span>{" "}
                <a
                  href={hashscanSearchUrl(message.hash)}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-dotted"
                >
                  {truncateAddress(message.hash, 10, 6)}
                </a>
              </motion.div>
            ))}
        </div>
      </div>
    </Panel>
  );
}
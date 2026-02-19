"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { TransferEvent } from "@/types/dashboard";

interface TransferAnimationOverlayProps {
  transfer?: TransferEvent;
}

export function TransferAnimationOverlay({ transfer }: TransferAnimationOverlayProps) {
  return (
    <AnimatePresence>
      {transfer && (
        <motion.div
          key={transfer.id}
          className="pointer-events-none absolute left-[24%] top-[42%] z-20"
          initial={{ x: 0, opacity: 0 }}
          animate={{ x: 460, opacity: [0, 1, 1, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
        >
          <div className="rounded-full border border-hive-primary/50 bg-hive-primary/20 px-3 py-1 font-mono text-xs text-hive-primary shadow-glow">
            💸 +{transfer.amount.toFixed(2)} HBAR
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
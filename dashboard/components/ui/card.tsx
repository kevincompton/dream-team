import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-hive-border bg-hive-card/90 backdrop-blur-sm",
        className,
      )}
      {...props}
    />
  );
}
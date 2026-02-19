import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface PanelProps {
  title: string;
  rightSlot?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function Panel({ title, rightSlot, children, className, contentClassName }: PanelProps) {
  return (
    <Card className={cn("flex h-full min-h-0 flex-col overflow-hidden p-4", className)}>
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <h3 className="text-sm font-semibold tracking-wide text-hive-text">{title}</h3>
        {rightSlot}
      </div>
      <div className={cn("min-h-0 flex-1", contentClassName)}>{children}</div>
    </Card>
  );
}
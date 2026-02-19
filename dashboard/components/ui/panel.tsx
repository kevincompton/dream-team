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
    <Card className={cn("p-4", className)}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-wide text-hive-text">{title}</h3>
        {rightSlot}
      </div>
      <div className={contentClassName}>{children}</div>
    </Card>
  );
}
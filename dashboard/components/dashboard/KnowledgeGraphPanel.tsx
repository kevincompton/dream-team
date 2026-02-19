"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GraphNode, GraphLink } from "@/types/dashboard";
import { Panel } from "@/components/ui/panel";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

interface KnowledgeGraphPanelProps {
  nodes: GraphNode[];
  links: GraphLink[];
}

export function KnowledgeGraphPanel({ nodes, links }: KnowledgeGraphPanelProps) {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [graphWidth, setGraphWidth] = useState(320);
  const graphHeight = 176;

  const graphData = useMemo(() => ({ nodes, links }), [links, nodes]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const syncWidth = () => {
      const width = Math.max(220, Math.floor(element.clientWidth));
      setGraphWidth(width);
    };

    syncWidth();
    const observer = new ResizeObserver(syncWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <Panel title="Knowledge Graph" className="h-full" contentClassName="space-y-2">
      <div ref={containerRef} className="h-44 overflow-hidden rounded-md border border-hive-border/70 bg-hive-bg/40">
        <ForceGraph2D
          graphData={graphData}
          width={graphWidth}
          height={graphHeight}
          cooldownTicks={80}
          nodeRelSize={5}
          backgroundColor="#050508"
          nodeColor={() => "#00FFA3"}
          linkColor={() => "rgba(0, 212, 255, 0.35)"}
          onNodeClick={(node) => setSelectedNode(node as GraphNode)}
          nodeCanvasObject={(node, ctx) => {
            const graphNode = node as GraphNode;
            ctx.fillStyle = "#00FFA3";
            ctx.beginPath();
            ctx.arc(graphNode.x || 0, graphNode.y || 0, Math.max(3, graphNode.val), 0, 2 * Math.PI);
            ctx.fill();
          }}
        />
      </div>

      <div className="rounded-md border border-hive-border/70 bg-hive-bg/50 p-2 text-xs">
        {selectedNode ? (
          <>
            <p className="mb-1 font-semibold text-hive-text">{selectedNode.name}</p>
            <p className="line-clamp-2 text-hive-muted">{selectedNode.question}</p>
            <p className="mt-1 font-mono text-hive-secondary">Topic: {selectedNode.topicId}</p>
          </>
        ) : (
          <p className="text-hive-muted">Click a node to inspect question and HCS topic ID.</p>
        )}
      </div>
    </Panel>
  );
}
"use client";

import { Preloaded, usePreloadedQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { Badge } from "@/components/ui/badge";

type StatsOverviewProps = {
  preloadedStats: Preloaded<typeof api.projects.getProjectStats>;
};

const STAT_CONFIG = [
  { label: "Total", key: null, color: null },
  { label: "Ideas", key: "idea", color: "bg-blue-500 hover:bg-blue-600" },
  { label: "Active", key: "active", color: "bg-green-500 hover:bg-green-600" },
  { label: "Paused", key: "paused", color: "bg-yellow-500 hover:bg-yellow-600" },
  { label: "Archived", key: "archived", color: "bg-gray-500 hover:bg-gray-600" },
] as const;

export function StatsOverview({ preloadedStats }: StatsOverviewProps) {
  const stats = usePreloadedQuery(preloadedStats);

  if (!stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {STAT_CONFIG.map((config) => (
          <div key={config.label} className="rounded-lg border bg-card p-4 animate-pulse">
            <div className="h-4 bg-muted rounded w-16 mb-2" />
            <div className="h-8 bg-muted rounded w-12" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {STAT_CONFIG.map((config) => {
        const value = config.key ? stats.byStatus[config.key] : stats.total;
        return (
          <div key={config.label} className="rounded-lg border bg-card p-4">
            {config.color ? (
              <Badge className={`mb-2 ${config.color}`}>{config.label}</Badge>
            ) : (
              <p className="text-sm font-medium text-muted-foreground mb-2">{config.label}</p>
            )}
            <p className="text-3xl font-bold">{value}</p>
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { Preloaded } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { ProjectList } from "@/components/project-list";
import { DetailPanel } from "@/components/detail-panel";
import { StatsOverview } from "@/components/stats-overview";
import { SearchBar } from "@/components/search-bar";
import { StatusFilter } from "@/components/status-filter";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Id } from "@/../convex/_generated/dataModel";

type DashboardClientProps = {
  preloadedProjects: Preloaded<typeof api.projects.listProjects>;
  preloadedStats: Preloaded<typeof api.projects.getProjectStats>;
  selectedProjectId?: Id<"projects">;
};

export function DashboardClient({
  preloadedProjects,
  preloadedStats,
  selectedProjectId,
}: DashboardClientProps) {
  const router = useRouter();

  const handleCloseDetail = () => {
    router.push("/");
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Powder</h1>
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link href="/names">Names</Link>
              </Button>
              <Button asChild>
                <Link href="/projects/new">Add Project</Link>
              </Button>
            </div>
          </div>

          <StatsOverview preloadedStats={preloadedStats} />

          <div className="flex gap-4 mt-4">
            <SearchBar />
            <StatusFilter />
          </div>
        </div>
      </div>

      {/* Two-pane layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar: Project list */}
        <aside className="w-80 border-r flex flex-col bg-muted/20">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-sm text-muted-foreground">
              Projects
            </h2>
          </div>
          <ProjectList
            preloadedProjects={preloadedProjects}
            selectedProjectId={selectedProjectId}
          />
        </aside>

        {/* Right pane: Detail panel or empty state */}
        <main className="flex-1 flex flex-col">
          {selectedProjectId ? (
            <DetailPanel projectId={selectedProjectId} onClose={handleCloseDetail} />
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center">
              <div>
                <p className="text-lg font-medium text-muted-foreground mb-2">
                  Select a project to view details
                </p>
                <p className="text-sm text-muted-foreground">
                  Or press <kbd className="px-2 py-1 bg-muted rounded border">Cmd+N</kbd> to create a new one
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

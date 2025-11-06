import { preloadQuery } from "convex/nextjs";
import { api } from "@/../convex/_generated/api";
import { DashboardClient } from "@/components/dashboard-client";
import type { Id } from "@/../convex/_generated/dataModel";

type PageProps = {
  searchParams: Promise<{
    status?: "idea" | "active" | "paused" | "archived";
    search?: string;
    project?: string;
  }>;
};

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const preloadedProjects = await preloadQuery(api.projects.listProjects, {
    status: params.status,
    search: params.search,
    sortBy: "updatedAt",
    sortOrder: "desc",
  });

  const preloadedStats = await preloadQuery(api.projects.getProjectStats, {});

  // Parse project ID from URL
  const selectedProjectId = params.project as Id<"projects"> | undefined;

  return (
    <DashboardClient
      preloadedProjects={preloadedProjects}
      preloadedStats={preloadedStats}
      selectedProjectId={selectedProjectId}
    />
  );
}

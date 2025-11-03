import { preloadQuery } from "convex/nextjs";
import { api } from "@/../convex/_generated/api";
import { ProjectTable } from "@/components/project-table";
import { StatusFilter } from "@/components/status-filter";
import { SearchBar } from "@/components/search-bar";
import { StatsOverview } from "@/components/stats-overview";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type PageProps = {
  searchParams: {
    status?: "idea" | "active" | "paused" | "archived";
    search?: string;
    sortBy?: "createdAt" | "updatedAt" | "name";
    sortOrder?: "asc" | "desc";
  };
};

export default async function DashboardPage({ searchParams }: PageProps) {
  const preloadedProjects = await preloadQuery(api.projects.listProjects, {
    status: searchParams.status,
    search: searchParams.search,
    sortBy: searchParams.sortBy || "updatedAt",
    sortOrder: searchParams.sortOrder || "desc",
  });

  const preloadedStats = await preloadQuery(api.projects.getProjectStats, {});

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Projects</h1>
        <Button asChild>
          <Link href="/projects/new">Add Project</Link>
        </Button>
      </div>

      <StatsOverview preloadedStats={preloadedStats} />

      <div className="flex gap-4 mb-6 mt-6">
        <SearchBar />
        <StatusFilter />
      </div>

      <ProjectTable preloadedProjects={preloadedProjects} />
    </div>
  );
}

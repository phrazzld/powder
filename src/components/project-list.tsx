"use client";

import { Preloaded, usePreloadedQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Hammer, Pause, Archive, ChevronDown, ChevronRight } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { getProjectDisplayName } from "@/lib/project-display";
import type { Id } from "@/../convex/_generated/dataModel";

type ProjectListProps = {
  preloadedProjects: Preloaded<typeof api.projects.listProjects>;
  selectedProjectId?: Id<"projects">;
};

const STATUS_CONFIG = {
  active: {
    icon: Hammer,
    label: "Active",
    color: "text-green-500",
    bgColor: "bg-green-500/10 hover:bg-green-500/20",
  },
  idea: {
    icon: Lightbulb,
    label: "Ideas",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10 hover:bg-blue-500/20",
  },
  paused: {
    icon: Pause,
    label: "Paused",
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10 hover:bg-yellow-500/20",
  },
  archived: {
    icon: Archive,
    label: "Archived",
    color: "text-gray-500",
    bgColor: "bg-gray-500/10 hover:bg-gray-500/20",
  },
};

export function ProjectList({ preloadedProjects, selectedProjectId }: ProjectListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projects = usePreloadedQuery(preloadedProjects);

  // Group projects by status
  const groupedProjects = projects.reduce((acc, project) => {
    if (!acc[project.status]) {
      acc[project.status] = [];
    }
    acc[project.status].push(project);
    return acc;
  }, {} as Record<string, typeof projects>);

  // Collapsed state for each section
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Focus management for keyboard navigation
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const projectRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Flatten projects for keyboard navigation
  const flatProjects = Object.entries(groupedProjects)
    .flatMap(([, projs]) => projs);

  const toggleSection = (status: string) => {
    setCollapsed(prev => ({ ...prev, [status]: !prev[status] }));
  };

  const handleProjectClick = (projectId: Id<"projects">) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("project", projectId);
    router.push(`/?${params.toString()}`);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (flatProjects.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex(prev => Math.min(prev + 1, flatProjects.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && focusedIndex >= 0) {
        e.preventDefault();
        handleProjectClick(flatProjects[focusedIndex]._id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusedIndex, flatProjects]);

  // Auto-focus selected project or first project
  useEffect(() => {
    if (selectedProjectId) {
      const index = flatProjects.findIndex(p => p._id === selectedProjectId);
      if (index >= 0) {
        setFocusedIndex(index);
        projectRefs.current.get(selectedProjectId)?.focus();
      }
    } else if (focusedIndex < 0 && flatProjects.length > 0) {
      setFocusedIndex(0);
    }
  }, [selectedProjectId, flatProjects]);

  if (projects.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div>
          <Lightbulb className="mx-auto size-12 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">No projects yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {(["active", "idea", "paused", "archived"] as const).map(status => {
        const statusProjects = groupedProjects[status] || [];
        if (statusProjects.length === 0) return null;

        const config = STATUS_CONFIG[status];
        const Icon = config.icon;
        const isCollapsed = collapsed[status];

        return (
          <div key={status} className="mb-4">
            <button
              onClick={() => toggleSection(status)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-muted/50 rounded-md transition-colors"
            >
              {isCollapsed ? (
                <ChevronRight className="size-4" />
              ) : (
                <ChevronDown className="size-4" />
              )}
              <Icon className={cn("size-4", config.color)} />
              <span>{config.label}</span>
              <span className="ml-auto text-muted-foreground">
                {statusProjects.length}
              </span>
            </button>

            {!isCollapsed && (
              <div className="space-y-1 mt-1">
                {statusProjects.map(project => {
                  const isSelected = project._id === selectedProjectId;
                  const isFocused = flatProjects[focusedIndex]?._id === project._id;

                  const label = getProjectDisplayName(project);

                  return (
                    <button
                      key={project._id}
                      ref={el => {
                        if (el) {
                          projectRefs.current.set(project._id, el);
                        }
                      }}
                      onClick={() => handleProjectClick(project._id)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-md transition-colors",
                        config.bgColor,
                        isSelected && "ring-2 ring-primary",
                        isFocused && "ring-2 ring-muted-foreground"
                      )}
                    >
                      <div className="font-medium text-sm truncate">
                        {label ? (
                          label
                        ) : (
                          <span className="text-muted-foreground italic">Unnamed</span>
                        )}
                      </div>
                      {project.description && (
                        <div className="text-xs text-muted-foreground truncate mt-1">
                          {project.description}
                        </div>
                      )}
                      {project.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {project.tags.slice(0, 3).map(tag => (
                            <Badge
                              key={tag}
                              variant="outline"
                              className="text-xs px-1.5 py-0"
                            >
                              {tag}
                            </Badge>
                          ))}
                          {project.tags.length > 3 && (
                            <Badge
                              variant="outline"
                              className="text-xs px-1.5 py-0"
                            >
                              +{project.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

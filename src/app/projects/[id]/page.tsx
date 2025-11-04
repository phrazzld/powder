"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { ProjectForm } from "@/components/project-form";
import { Loader2 } from "lucide-react";

type PageProps = {
  params: { id: string };
};

export default function EditProjectPage({ params }: PageProps) {
  const router = useRouter();
  const projectId = params.id as Id<"projects">;
  const project = useQuery(api.projects.getProject, { projectId });

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-2xl mx-auto">
        {project === undefined && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {project === null && (
          <>
            <h1 className="text-3xl font-bold mb-4">Project Not Found</h1>
            <p className="text-muted-foreground mb-6">
              The project you're looking for doesn't exist or has been deleted.
            </p>
            <button
              onClick={() => router.push("/")}
              className="text-primary hover:underline"
            >
              ← Back to Dashboard
            </button>
          </>
        )}

        {project && (
          <>
            <h1 className="text-3xl font-bold mb-6">Edit Project</h1>
            <ProjectForm
              projectId={projectId}
              onSuccess={() => router.push("/")}
              onCancel={() => router.push("/")}
            />
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { ProjectForm } from "@/components/project-form";

export default function AddProjectPage() {
  const router = useRouter();
  const navigateHome = () => router.push("/");

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Add Project</h1>
        <ProjectForm onSuccess={navigateHome} onCancel={navigateHome} />
      </div>
    </div>
  );
}

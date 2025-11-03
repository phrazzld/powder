"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

type ProjectStatus = "idea" | "active" | "paused" | "archived";

const STATUS_OPTIONS: { value: ProjectStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "idea", label: "Ideas" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "archived", label: "Archived" },
];

export function StatusFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeStatus = searchParams.get("status") || "all";

  const handleStatusChange = (status: string) => {
    const params = new URLSearchParams(searchParams);

    if (status === "all") {
      params.delete("status");
    } else {
      params.set("status", status);
    }

    router.push(`/?${params.toString()}`);
  };

  return (
    <div className="flex gap-2 flex-wrap">
      {STATUS_OPTIONS.map((option) => (
        <Button
          key={option.value}
          variant={activeStatus === option.value ? "default" : "outline"}
          size="sm"
          onClick={() => handleStatusChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

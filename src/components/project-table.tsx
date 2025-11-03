"use client";

import { Preloaded, usePreloadedQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { useRouter } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, ArrowUpDown } from "lucide-react";

type ProjectTableProps = {
  preloadedProjects: Preloaded<typeof api.projects.listProjects>;
  onDelete?: (projectId: string) => void;
};

type ProjectRow = {
  _id: string;
  name?: string;
  description?: string;
  status: "idea" | "active" | "paused" | "archived";
  tags: string[];
  githubRepo?: string;
  productionUrl?: string;
};

const STATUS_COLORS = {
  idea: "bg-blue-500 hover:bg-blue-600",
  active: "bg-green-500 hover:bg-green-600",
  paused: "bg-yellow-500 hover:bg-yellow-600",
  archived: "bg-gray-500 hover:bg-gray-600",
};

export function ProjectTable({
  preloadedProjects,
  onDelete,
}: ProjectTableProps) {
  const router = useRouter();
  const projects = usePreloadedQuery(preloadedProjects);
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns: ColumnDef<ProjectRow>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-auto p-0 hover:bg-transparent"
        >
          Name
          <ArrowUpDown className="ml-2 size-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("name") || "(unnamed)"}</div>
      ),
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => {
        const description = row.getValue("description") as string | undefined;
        return (
          <div className="max-w-md truncate text-muted-foreground">
            {description || "—"}
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as ProjectRow["status"];
        return (
          <Badge className={`${STATUS_COLORS[status]} capitalize`}>
            {status}
          </Badge>
        );
      },
    },
    {
      accessorKey: "tags",
      header: "Tags",
      cell: ({ row }) => {
        const tags = row.getValue("tags") as string[];
        if (!tags.length) return <span className="text-muted-foreground">—</span>;
        return (
          <div className="flex gap-1 flex-wrap">
            {tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{tags.length - 3}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "githubRepo",
      header: "GitHub",
      cell: ({ row }) => {
        const repo = row.getValue("githubRepo") as string | undefined;
        if (!repo) return <span className="text-muted-foreground">—</span>;
        return (
          <a
            href={`https://github.com/${repo}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {repo}
          </a>
        );
      },
    },
    {
      accessorKey: "productionUrl",
      header: "Production",
      cell: ({ row }) => {
        const url = row.getValue("productionUrl") as string | undefined;
        if (!url) return <span className="text-muted-foreground">—</span>;
        const hostname = url.replace(/^https?:\/\//, "").split("/")[0];
        return (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {hostname}
          </a>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const project = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/projects/${project._id}`);
                }}
              >
                <Pencil className="mr-2 size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.(project._id);
                }}
                className="text-destructive"
              >
                <Trash2 className="mr-2 size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const table = useReactTable({
    data: projects || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  });

  if (!projects) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {[...Array(7)].map((_, i) => (
              <TableHead key={i}>
                <div className="h-4 bg-muted rounded w-20 animate-pulse" />
              </TableHead>
            ))}
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                {[...Array(7)].map((_, j) => (
                  <TableCell key={j}>
                    <div className="h-4 bg-muted rounded w-full animate-pulse" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="rounded-md border p-12 text-center">
        <p className="text-lg font-medium text-muted-foreground mb-2">
          No projects yet
        </p>
        <p className="text-sm text-muted-foreground">
          Create your first project to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              onClick={() => router.push(`/projects/${row.original._id}`)}
              className="cursor-pointer"
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

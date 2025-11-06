"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Preloaded, usePreloadedQuery, useMutation } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowUpDown, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";

type NamesClientProps = {
  preloadedNames: Preloaded<typeof api.names.listNames>;
};

const STATUS_CONFIG = {
  available: { label: "Available", color: "bg-green-500/20 text-green-700 dark:text-green-400" },
  assigned: { label: "Assigned", color: "bg-blue-500/20 text-blue-700 dark:text-blue-400" },
  considering: { label: "Considering", color: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400" },
};

export function NamesClient({ preloadedNames }: NamesClientProps) {
  const names = usePreloadedQuery(preloadedNames);
  const createName = useMutation(api.names.createName);
  const updateName = useMutation(api.names.updateName);
  const deleteNameMutation = useMutation(api.names.deleteName);

  const [newNameInput, setNewNameInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filter, setFilter] = useState<"all" | "available" | "assigned" | "considering">("all");
  const [sortBy, setSortBy] = useState<"name" | "createdAt">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement | null>(null);
  const [deletingNameId, setDeletingNameId] = useState<string | null>(null);

  const sortedNames = useMemo(() => {
    const copy = [...names];
    copy.sort((a, b) => {
      let comparison: number;
      if (sortBy === "name") {
        comparison = a.name.localeCompare(b.name);
      } else {
        comparison = a._creationTime - b._creationTime;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
    return copy;
  }, [names, sortBy, sortOrder]);

  const filteredNames = useMemo(() => {
    if (filter === "all") {
      return sortedNames;
    }
    return sortedNames.filter((name) => name.status === filter);
  }, [sortedNames, filter]);

  const stats = useMemo(() => {
    return {
      total: names.length,
      available: names.filter((n) => n.status === "available").length,
      assigned: names.filter((n) => n.status === "assigned").length,
      considering: names.filter((n) => n.status === "considering").length,
    };
  }, [names]);

  const handleAddName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNameInput.trim()) return;

    setIsSubmitting(true);
    try {
      await createName({ name: newNameInput.trim() });
      toast.success("Name added successfully");
      setNewNameInput("");
      inputRef.current?.focus();
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to add name");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (editingNameId) {
      const input = editInputRef.current;
      if (input) {
        input.focus();
        input.select();
      }
    }
  }, [editingNameId]);

  const handleStartEditing = (nameId: string, currentName: string) => {
    setEditingNameId(nameId);
    setEditValue(currentName);
    setIsRenaming(false);
  };

  const handleCancelEdit = () => {
    setEditingNameId(null);
    setEditValue("");
    setIsRenaming(false);
    editInputRef.current = null;
  };

  const handleRename = async (nameId: string, originalName: string) => {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === originalName) {
      handleCancelEdit();
      return;
    }

    setIsRenaming(true);
    try {
      await updateName({ nameId, name: trimmed });
      toast.success("Name updated");
      handleCancelEdit();
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to update name");
      setIsRenaming(false);
    }
  };

  const handleDelete = async (nameId: string) => {
    const target = names.find((name) => name._id === nameId);
    if (!target) return;

    const inUse =
      Boolean(target.assignedTo) || (target.consideringProjectIds?.length ?? 0) > 0;
    if (inUse) {
      toast.error("Cannot delete a name that is assigned or being considered.");
      return;
    }

    if (!window.confirm(`Delete "${target.name}"? This cannot be undone.`)) {
      return;
    }

    setDeletingNameId(nameId);
    try {
      await deleteNameMutation({ nameId });
      toast.success("Name deleted");
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to delete name");
    } finally {
      setDeletingNameId(null);
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Names</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {stats.total} names • {stats.available} available • {stats.assigned} assigned • {stats.considering} considering
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/">Back to Projects</Link>
        </Button>
      </div>

      {/* Quick Add */}
      <form onSubmit={handleAddName} className="flex gap-2 mb-6">
        <Input
          ref={inputRef}
          placeholder="Add a new name..."
          value={newNameInput}
          onChange={(e) => setNewNameInput(e.target.value)}
          disabled={isSubmitting}
          className="flex-1"
        />
        <Button type="submit" disabled={isSubmitting || !newNameInput.trim()}>
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              <Plus className="size-4 mr-2" />
              Add Name
            </>
          )}
        </Button>
      </form>

      {/* Filters & Sorting */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            All ({stats.total})
          </Button>
          <Button
            variant={filter === "available" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("available")}
          >
            Available ({stats.available})
          </Button>
          <Button
            variant={filter === "assigned" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("assigned")}
          >
            Assigned ({stats.assigned})
          </Button>
          <Button
            variant={filter === "considering" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("considering")}
          >
            Considering ({stats.considering})
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={sortBy}
            onValueChange={(value) => setSortBy(value as "name" | "createdAt")}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name (A–Z)</SelectItem>
              <SelectItem value="createdAt">Created</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            className="flex items-center gap-2"
          >
            <ArrowUpDown className="size-4" />
            {sortBy === "name"
              ? sortOrder === "asc"
                ? "A → Z"
                : "Z → A"
              : sortOrder === "asc"
              ? "Oldest first"
              : "Newest first"}
          </Button>
        </div>
      </div>

      {/* Table */}
      {filteredNames.length === 0 ? (
        <div className="rounded-md border p-12 text-center">
          <p className="text-lg font-medium mb-2">No names found</p>
          <p className="text-sm text-muted-foreground">
            {filter === "all"
              ? "Add your first name above to get started"
              : `No ${filter} names yet`}
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead className="text-right">Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredNames.map((name) => (
                <TableRow key={name._id}>
                  <TableCell className="font-medium">
                    {editingNameId === name._id ? (
                      <Input
                        ref={(el) => {
                          if (editingNameId === name._id) {
                            editInputRef.current = el;
                          }
                        }}
                        value={editValue}
                        onChange={(event) => setEditValue(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void handleRename(name._id, name.name);
                          }
                          if (event.key === "Escape") {
                            event.preventDefault();
                            handleCancelEdit();
                          }
                        }}
                        className="h-8 w-56"
                        disabled={isRenaming}
                      />
                    ) : (
                      name.name
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_CONFIG[name.status].color}>
                      {STATUS_CONFIG[name.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {name.assignedTo ? (
                      <Link
                        href={`/?project=${name.assignedTo}`}
                        className="text-sm text-primary hover:underline"
                      >
                        View project
                      </Link>
                    ) : name.status === "considering" ? (
                      <span className="text-sm text-muted-foreground">
                        {name.consideringProjectIds?.length ?? 0}{" "}
                        {(name.consideringProjectIds?.length ?? 0) === 1 ? "idea" : "ideas"} considering
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {new Date(name._creationTime).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {(() => {
                      const inUse =
                        Boolean(name.assignedTo) ||
                        (name.consideringProjectIds?.length ?? 0) > 0;

                      if (editingNameId === name._id) {
                        return (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => void handleRename(name._id, name.name)}
                              disabled={
                                isRenaming ||
                                editValue.trim().length === 0 ||
                                editValue.trim() === name.name
                              }
                            >
                              {isRenaming ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                "Save"
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleCancelEdit}
                              disabled={isRenaming}
                            >
                              Cancel
                            </Button>
                          </div>
                        );
                      }

                      return (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleStartEditing(name._id, name.name)}
                          >
                            <Pencil className="mr-2 size-4" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => void handleDelete(name._id)}
                            disabled={inUse || deletingNameId === name._id}
                            title={
                              inUse
                                ? "Cannot delete while assigned or under consideration"
                                : undefined
                            }
                          >
                            {deletingNameId === name._id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <>
                                <Trash2 className="mr-2 size-4" />
                                Delete
                              </>
                            )}
                          </Button>
                        </div>
                      );
                    })()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

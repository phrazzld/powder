"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createEmptyProjectFormValues,
  ensureStringArray,
  hydrateProjectFormValues,
  parseTagsInput,
  prepareProjectPayload,
} from "@/lib/project-form-model";
import { getProjectDisplayName } from "@/lib/project-display";
import { projectFormSchema, type ProjectFormValues } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import type { Id } from "@/../convex/_generated/dataModel";
import { ProjectNamePicker, type ProjectNameOption } from "@/components/project-name-picker";

type DetailPanelProps = {
  projectId: Id<"projects">;
  onClose: () => void;
};

export function DetailPanel({ projectId, onClose }: DetailPanelProps) {
  const project = useQuery(api.projects.getProject, { projectId });
  const updateProject = useMutation(api.projects.updateProject);
  const deleteProject = useMutation(api.projects.deleteProject);
  const availableNames = useQuery(api.names.getAvailableNames, {});

  const [tagsInput, setTagsInput] = useState<string>("");

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: createEmptyProjectFormValues(),
  });

  // Reset to defaults whenever we switch projects to avoid showing stale values
  useEffect(() => {
    form.reset(createEmptyProjectFormValues());
    setTagsInput("");
  }, [form, projectId]);

  // Hydrate form when project loads
  useEffect(() => {
    if (!project) return;

    form.reset(hydrateProjectFormValues(project));

    setTagsInput((project.tags ?? []).join(", "));
  }, [project, form]);

  const status = form.watch("status");

  // Clear fields when status changes
  useEffect(() => {
    if (status === "idea" && form.getValues("nameId")) {
      form.setValue("nameId", undefined, { shouldDirty: true });
    }

    const currentConsidering = ensureStringArray(form.getValues("consideringNameIds"));
    if (status !== "idea" && currentConsidering.length > 0) {
      form.setValue("consideringNameIds", [], { shouldDirty: true });
    }
  }, [form, status]);

  // Build name options (available + current)
  const nameOptions: ProjectNameOption[] = useMemo(() => {
    const optionMap = new Map<string, string>();

    availableNames?.forEach(name => {
      optionMap.set(name._id, name.name);
    });

    if (project) {
      if (project.nameId && project.name) {
        optionMap.set(project.nameId, project.name);
      }

      project.consideringNameIds.forEach((id, index) => {
        const label = project.consideringNames?.[index];
        if (label) {
          optionMap.set(id, label);
        }
      });
    }

    return Array.from(optionMap.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [availableNames, project]);

  const handleTagsChange = (value: string) => {
    setTagsInput(value);
    form.setValue("tags", parseTagsInput(value), {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const onSubmit = form.handleSubmit(async (values) => {
    const payload = prepareProjectPayload(values);

    try {
      await updateProject({ projectId, ...payload });
      toast.success("Project updated successfully");
      form.reset(hydrateProjectFormValues(values));
      setTagsInput(values.tags.join(", "));
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to update project");
    }
  });

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this project?")) return;

    try {
      await deleteProject({ projectId, releaseNames: true });
      toast.success("Project deleted successfully");
      onClose();
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to delete project");
    }
  };

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const displayName = getProjectDisplayName(project);

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">
          {displayName ? (
            displayName
          ) : (
            <span className="text-muted-foreground italic">Unnamed Project</span>
          )}
        </h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-4">
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-6">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="idea">Idea</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {status === "idea" ? (
              <FormField
                control={form.control}
                name="consideringNameIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Considering Names</FormLabel>
                    <FormDescription className="text-xs">
                      Names you might assign later (optional).
                    </FormDescription>
                    <ProjectNamePicker
                      multiple
                      options={nameOptions}
                      placeholder={
                        nameOptions.length
                          ? "Search and select names"
                          : "No available names"
                      }
                      value={ensureStringArray(field.value)}
                      onChange={field.onChange}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <FormField
                control={form.control}
                name="nameId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigned Name</FormLabel>
                    <ProjectNamePicker
                      options={nameOptions}
                      placeholder={
                        nameOptions.length
                          ? "Search and select a project name"
                          : "No available names"
                      }
                      value={typeof field.value === "string" ? field.value : undefined}
                      onChange={field.onChange}
                      disabled={nameOptions.length === 0}
                    />
                    <FormDescription className="text-xs">
                      Required for active, paused, or archived projects.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Why does this project matter?"
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {status !== "idea" && (
              <>
                <FormField
                  control={form.control}
                  name="githubRepo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>GitHub Repository</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="owner/repo"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Format: owner/repo (e.g., vercel/next.js)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="productionUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Production URL</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://app.example.com"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="internal, beta"
                      value={tagsInput}
                      onChange={e => handleTagsChange(e.target.value)}
                      onBlur={() => {
                        field.onChange(parseTagsInput(tagsInput));
                        field.onBlur();
                      }}
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Comma-separated tags
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-2 p-4 border-t">
        <Button
          variant="destructive"
          onClick={handleDelete}
          disabled={form.formState.isSubmitting}
        >
          Delete
        </Button>
        <Button
          onClick={onSubmit}
          disabled={!form.formState.isDirty || form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </div>
    </div>
  );
}

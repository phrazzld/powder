"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import type { Id } from "@/../convex/_generated/dataModel";
import { api } from "@/../convex/_generated/api";
import { Loader2 } from "lucide-react";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { projectFormSchema, type ProjectFormValues } from "@/lib/validation";

type ProjectFormProps = {
  projectId?: Id<"projects">;
  onSuccess?: () => void;
  onCancel?: () => void;
};

type NameOption = {
  value: string;
  label: string;
};

const getEmptyFormValues = (): ProjectFormValues => ({
  status: "idea",
  nameId: undefined,
  consideringNameIds: [],
  description: "",
  githubRepo: "",
  productionUrl: "",
  tags: [],
});

function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag, index, all) => tag.length > 0 && all.indexOf(tag) === index);
}

export function ProjectForm({ projectId, onSuccess, onCancel }: ProjectFormProps) {
  const createProject = useMutation(api.projects.createProject);
  const updateProject = useMutation(api.projects.updateProject);
  const availableNames = useQuery(api.names.getAvailableNames, {});
  const existingProject = useQuery(
    api.projects.getProject,
    projectId ? { projectId } : "skip"
  );

  const [tagsInput, setTagsInput] = useState<string>("");

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: getEmptyFormValues(),
  });

  useEffect(() => {
    if (!projectId) {
      form.reset(getEmptyFormValues());
      setTagsInput("");
      setSubmitError(null);
      return;
    }

    if (existingProject === undefined) {
      return;
    }

    if (existingProject === null) {
      setSubmitError("Project not found.");
      return;
    }

    const hydratedValues: ProjectFormValues = {
      status: existingProject.status,
      nameId: existingProject.nameId ?? undefined,
      consideringNameIds: existingProject.consideringNameIds ?? [],
      description: existingProject.description ?? "",
      githubRepo: existingProject.githubRepo ?? "",
      productionUrl: existingProject.productionUrl ?? "",
      tags: existingProject.tags ?? [],
    };

    form.reset(hydratedValues);
    setTagsInput((existingProject.tags ?? []).join(", "));
    setSubmitError(null);
  }, [existingProject, form, projectId]);

  const status = form.watch("status");

  useEffect(() => {
    if (status === "idea" && form.getValues("nameId")) {
      form.setValue("nameId", undefined, { shouldDirty: true });
    }

    if (status !== "idea" && form.getValues("consideringNameIds").length) {
      form.setValue("consideringNameIds", [], { shouldDirty: true });
    }
  }, [form, status]);

  const nameOptions: NameOption[] = useMemo(() => {
    const optionMap = new Map<string, string>();

    availableNames?.forEach((name) => {
      optionMap.set(name._id, name.name);
    });

    if (existingProject && existingProject !== null) {
      if (existingProject.nameId && existingProject.name) {
        optionMap.set(existingProject.nameId, existingProject.name);
      }

      existingProject.consideringNameIds.forEach((id, index) => {
        const label = existingProject.consideringNames?.[index];
        if (label) {
          optionMap.set(id, label);
        }
      });
    }

    return Array.from(optionMap.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [availableNames, existingProject]);

  const handleTagsChange = (value: string) => {
    setTagsInput(value);
    form.setValue("tags", parseTags(value), {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const isLoadingProject = Boolean(projectId) && existingProject === undefined;

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);

    const payload = {
      status: values.status,
      nameId: values.status === "idea" ? undefined : values.nameId ?? undefined,
      consideringNameIds:
        values.status === "idea" ? values.consideringNameIds : [],
      description: values.description?.trim()
        ? values.description.trim()
        : undefined,
      githubRepo: values.githubRepo?.trim()
        ? values.githubRepo.trim()
        : undefined,
      productionUrl: values.productionUrl?.trim()
        ? values.productionUrl.trim()
        : undefined,
      tags: values.tags,
    };

    try {
      if (projectId) {
        await updateProject({ projectId, ...payload });
      } else {
        await createProject(payload);
        form.reset(getEmptyFormValues());
        setTagsInput("");
      }

      toast.success(projectId ? "Project updated successfully" : "Project created successfully");
      onSuccess?.();
    } catch (error: any) {
      toast.error(error?.message ?? "Something went wrong while saving the project.");
    }
  });

  if (projectId && existingProject === null) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        Unable to load project. It may have been removed.
      </div>
    );
  }

  if (isLoadingProject) {
    return (
      <div className="rounded-md border bg-muted/10 p-4 text-sm text-muted-foreground">
        Loading project details…
      </div>
    );
  }

  return (
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
                    <SelectValue placeholder="Select project status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="idea">Idea</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                Set the current lifecycle state for this project.
              </FormDescription>
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
                <FormDescription>
                  Select names you might assign later (optional).
                </FormDescription>
                <div className="space-y-2">
                  {nameOptions.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No available names to consider right now.
                    </p>
                  )}
                  {nameOptions.map((option) => {
                    const checked = field.value.includes(option.value);
                    const checkboxId = `consider-name-${option.value}`;
                    return (
                      <div
                        key={option.value}
                        className="flex items-center space-x-2 rounded-md border border-border/60 p-2"
                      >
                        <Checkbox
                          id={checkboxId}
                          checked={checked}
                          onCheckedChange={(next) => {
                            const isChecked = next === true;
                            if (isChecked && !checked) {
                              field.onChange([...field.value, option.value]);
                            } else if (!isChecked && checked) {
                              field.onChange(
                                field.value.filter((id) => id !== option.value)
                              );
                            }
                          }}
                        />
                        <Label htmlFor={checkboxId} className="text-sm">
                          {option.label}
                        </Label>
                      </div>
                    );
                  })}
                </div>
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
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                  disabled={nameOptions.length === 0}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a project name" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {nameOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Required for active, paused, or archived projects.
                  {nameOptions.length === 0 &&
                    " Add a name in the pool before assigning it here."}
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
                  className="min-h-[120px]"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Optional short summary to give downstream teams context.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

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
              <FormDescription>
                Format: owner/repo (e.g., vercel/next.js). Leave blank if none.
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
              <FormDescription>
                Public URL for the deployed application (optional).
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

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
                  onChange={(event) => handleTagsChange(event.target.value)}
                  onBlur={() => {
                    field.onChange(parseTags(tagsInput));
                    field.onBlur();
                  }}
                />
              </FormControl>
              <FormDescription>
                Comma-separated tags help filter projects later.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Button type="submit" disabled={form.formState.isSubmitting} className="w-full sm:w-auto">
            {form.formState.isSubmitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onCancel?.()}
            disabled={form.formState.isSubmitting}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}

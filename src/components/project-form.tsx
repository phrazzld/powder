"use client";

import { useEffect, useMemo, useState } from "react";
import { type FieldErrors, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import type { Id } from "@/../convex/_generated/dataModel";
import { api } from "@/../convex/_generated/api";
import { ChevronDown, ChevronRight, Loader2, Plus, X } from "lucide-react";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProjectNamePicker, type ProjectNameOption } from "@/components/project-name-picker";
import {
  createEmptyProjectFormValues,
  ensureStringArray,
  hydrateProjectFormValues,
  parseTagsInput,
  prepareProjectPayload,
} from "@/lib/project-form-model";
import { projectFormSchema, type ProjectFormValues } from "@/lib/validation";

type ProjectFormProps = {
  projectId?: Id<"projects">;
  onSuccess?: () => void;
  onCancel?: () => void;
};

export function ProjectForm({ projectId, onSuccess, onCancel }: ProjectFormProps) {
  const createProject = useMutation(api.projects.createProject);
  const updateProject = useMutation(api.projects.updateProject);
  const createName = useMutation(api.names.createName);
  const availableNames = useQuery(api.names.getAvailableNames, {});
  const existingProject = useQuery(
    api.projects.getProject,
    projectId ? { projectId } : "skip"
  );

  const [tagsInput, setTagsInput] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [isCreatingName, setIsCreatingName] = useState<boolean>(false);
  const [newNameInput, setNewNameInput] = useState<string>("");
  const [isSubmittingName, setIsSubmittingName] = useState<boolean>(false);
  const [localNameOptions, setLocalNameOptions] = useState<ProjectNameOption[]>([]);

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    shouldUnregister: false,
    defaultValues: createEmptyProjectFormValues(),
  });

  useEffect(() => {
    if (!projectId) {
      form.reset(createEmptyProjectFormValues());
      setTagsInput("");
      return;
    }

    if (existingProject === undefined) {
      return;
    }

    if (existingProject === null) {
      return;
    }

    form.reset(hydrateProjectFormValues(existingProject));
    setTagsInput((existingProject.tags ?? []).join(", "));
  }, [existingProject, form, projectId]);

  const status = form.watch("status");
  const advancedLabel =
    status === "idea" ? "Advanced (Tags)" : "Advanced (GitHub, Production URL, Tags)";

  useEffect(() => {
    const currentConsideringNameIds = ensureStringArray(form.getValues("consideringNameIds"));
    if (status !== "idea" && currentConsideringNameIds.length > 0) {
      form.setValue("consideringNameIds", [], { shouldDirty: true });
    }
  }, [form, status]);

  const nameOptions: ProjectNameOption[] = useMemo(() => {
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

    localNameOptions.forEach((option) => {
      optionMap.set(option.value, option.label);
    });

    return Array.from(optionMap.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [availableNames, existingProject, localNameOptions]);

  const handleTagsChange = (value: string) => {
    setTagsInput(value);
    form.setValue("tags", parseTagsInput(value), {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const handleCreateName = async (): Promise<Id<"names"> | null> => {
    const trimmedName = newNameInput.trim();
    if (!trimmedName || isSubmittingName) {
      return null;
    }

    setIsSubmittingName(true);
    try {
      const nameId = await createName({ name: trimmedName });
      toast.success("Name created successfully");
      form.setValue("nameId", nameId, {
        shouldDirty: true,
        shouldValidate: true,
      });
      await form.trigger("nameId");
      setLocalNameOptions((prev) => {
        const withoutCurrent = prev.filter((option) => option.value !== nameId);
        return [...withoutCurrent, { value: nameId, label: trimmedName }];
      });
      setNewNameInput("");
      setIsCreatingName(false);
      return nameId;
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to create name");
      return null;
    } finally {
      setIsSubmittingName(false);
    }
  };

  const isLoadingProject = Boolean(projectId) && existingProject === undefined;

  const handleValidSubmit = async (values: ProjectFormValues) => {
    const payload = prepareProjectPayload(values);

    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.log("[ProjectForm] submit", {
        values,
        payload,
      });
    }

    try {
      if (projectId) {
        await updateProject({ projectId, ...payload });
      } else {
        await createProject(payload);
        form.reset(createEmptyProjectFormValues());
        setTagsInput("");
        setLocalNameOptions([]);
      }

      toast.success(projectId ? "Project updated successfully" : "Project created successfully");
      onSuccess?.();
    } catch (error: any) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.error("[ProjectForm] mutation failed", {
          payload,
          error,
        });
      }
      toast.error(error?.message ?? "Something went wrong while saving the project.");
    }
  };

  const handleInvalidSubmit = (errors: FieldErrors<ProjectFormValues>) => {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn("[ProjectForm] invalid submit", errors);
    }
    const firstErrorMessage =
      errors.nameId?.message ??
      errors.status?.message ??
      errors.githubRepo?.message ??
      errors.productionUrl?.message ??
      Object.values(errors)[0]?.message ??
      null;

    if (firstErrorMessage) {
      toast.error(firstErrorMessage);
    } else {
      toast.error("Please fix the highlighted fields and try again.");
    }
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (form.formState.isSubmitting) {
      return;
    }

    if (status !== "idea" && !form.getValues("nameId") && newNameInput.trim()) {
      const createdNameId = await handleCreateName();
      if (!createdNameId) {
        return;
      }
    }

    const runSubmit = form.handleSubmit(handleValidSubmit, handleInvalidSubmit);
    await runSubmit(event);
  };

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
                <ProjectNamePicker
                  multiple
                  options={nameOptions}
                  placeholder={
                    nameOptions.length
                      ? "Search and select names to consider"
                      : "No available names"
                  }
                  value={ensureStringArray(field.value)}
                  onChange={(next) => field.onChange(next)}
                />
                <FormDescription>
                  Select names you might assign later (optional).
                </FormDescription>
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
                  value={
                    typeof field.value === "string" ? field.value : undefined
                  }
                  onChange={(next) => field.onChange(next ?? undefined)}
                  disabled={nameOptions.length === 0 || isCreatingName}
                />

                {!isCreatingName ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCreatingName(true)}
                    className="mt-2"
                  >
                    <Plus className="size-4 mr-2" />
                    Create New Name
                  </Button>
                ) : (
                  <div className="mt-2 space-y-2 rounded-md border p-3">
                    <Input
                      placeholder="Enter new name..."
                      value={newNameInput}
                      onChange={(e) => setNewNameInput(e.target.value)}
                      disabled={isSubmittingName}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleCreateName();
                      }
                      if (e.key === "Escape") {
                        setIsCreatingName(false);
                        setNewNameInput("");
                      }
                      }}
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          void handleCreateName();
                        }}
                        disabled={!newNameInput.trim() || isSubmittingName}
                      >
                        {isSubmittingName ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          "Create"
                        )}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setIsCreatingName(false);
                          setNewNameInput("");
                        }}
                        disabled={isSubmittingName}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  </div>
                )}

                <FormDescription>
                  Required for active, paused, or archived projects. Select an existing name or create a new one before saving.
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

        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            {showAdvanced ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
            {advancedLabel}
          </button>

          {showAdvanced && (
            <div className="space-y-6">
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
                        <FormDescription>
                          Format: owner/repo (e.g., vercel/next.js).
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
                          Public URL for the deployed application.
                        </FormDescription>
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
                        onChange={(event) => handleTagsChange(event.target.value)}
                        onBlur={() => {
                          field.onChange(parseTagsInput(tagsInput));
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
            </div>
          )}
        </div>

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

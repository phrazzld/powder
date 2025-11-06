import { buildProjectPayload } from "@/lib/project-payload";
import type { ProjectFormValues } from "@/lib/validation";

type ProjectLike = {
  status?: ProjectFormValues["status"] | null;
  nameId?: string | null;
  consideringNameIds?: string[] | null;
  description?: string | null;
  githubRepo?: string | null;
  productionUrl?: string | null;
  tags?: string[] | null;
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
};

export const createEmptyProjectFormValues = (): ProjectFormValues => ({
  status: "idea",
  nameId: undefined,
  consideringNameIds: [],
  description: "",
  githubRepo: "",
  productionUrl: "",
  tags: [],
});

export const hydrateProjectFormValues = (project: ProjectLike | null | undefined): ProjectFormValues => {
  if (!project) {
    return createEmptyProjectFormValues();
  }

  return {
    status: project.status ?? "idea",
    nameId: project.nameId ?? undefined,
    consideringNameIds: toStringArray(project.consideringNameIds),
    description: project.description ?? "",
    githubRepo: project.githubRepo ?? "",
    productionUrl: project.productionUrl ?? "",
    tags: toStringArray(project.tags),
  };
};

export const ensureStringArray = (value: unknown): string[] => {
  return toStringArray(value);
};

export const parseTagsInput = (value: string): string[] => {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag, index, all) => tag.length > 0 && all.indexOf(tag) === index);
};

export const prepareProjectPayload = (values: ProjectFormValues) => {
  return buildProjectPayload(values);
};

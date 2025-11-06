import type { Id } from "@/../convex/_generated/dataModel";
import type { ProjectFormValues } from "@/lib/validation";

export type ProjectInputPayload = {
  status: ProjectFormValues["status"];
  nameId?: Id<"names">;
  consideringNameIds: Id<"names">[];
  description?: string;
  githubRepo?: string;
  productionUrl?: string;
  tags: string[];
};

const trimOrUndefined = (value?: string | null) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
};

const normalizeIdArray = (value: unknown): Id<"names">[] => {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Id<"names"> => typeof item === "string" && item.length > 0
  );
};

export function buildProjectPayload(values: ProjectFormValues): ProjectInputPayload {
  const consideringCandidates = normalizeIdArray(values.consideringNameIds);
  const tags = normalizeStringArray(values.tags);
  const githubRepo = trimOrUndefined(values.githubRepo);
  const productionUrl = trimOrUndefined(values.productionUrl);

  return {
    status: values.status,
    nameId:
      values.status === "idea"
        ? undefined
        : (values.nameId as Id<"names"> | undefined) ?? undefined,
    consideringNameIds: values.status === "idea" ? consideringCandidates : [],
    description: trimOrUndefined(values.description),
    githubRepo: values.status === "idea" ? undefined : githubRepo,
    productionUrl: values.status === "idea" ? undefined : productionUrl,
    tags,
  };
}

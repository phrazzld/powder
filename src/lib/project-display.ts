type DisplayableProject = {
  name?: string | null;
  consideringNames?: (string | null | undefined)[] | null;
  description?: string | null;
};

const TRUNCATION_LIMIT = 64;

const truncate = (value: string): string => {
  if (value.length <= TRUNCATION_LIMIT) {
    return value;
  }
  return `${value.slice(0, TRUNCATION_LIMIT)}…`;
};

export const getProjectDisplayName = (project: DisplayableProject): string | null => {
  const assignedName = project.name?.trim();
  if (assignedName) {
    return assignedName;
  }

  const firstConsidering = project.consideringNames?.find(
    (candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0
  );
  if (firstConsidering) {
    return firstConsidering.trim();
  }

  const description = project.description?.trim();
  if (description) {
    return truncate(description);
  }

  return null;
};

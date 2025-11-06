import { preloadQuery } from "convex/nextjs";
import { api } from "@/../convex/_generated/api";
import { NamesClient } from "@/components/names-client";

export default async function NamesPage() {
  const preloadedNames = await preloadQuery(api.names.listNames, {
    sortBy: "name",
    sortOrder: "asc",
  });

  return <NamesClient preloadedNames={preloadedNames} />;
}

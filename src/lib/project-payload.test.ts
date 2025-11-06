import { describe, expect, it } from "vitest";

import type { ProjectFormValues } from "@/lib/validation";
import { buildProjectPayload } from "./project-payload";

const makeFormValues = (overrides: Partial<ProjectFormValues> = {}): ProjectFormValues => ({
  status: "idea",
  nameId: undefined,
  consideringNameIds: [],
  description: "",
  githubRepo: "",
  productionUrl: "",
  tags: [],
  ...overrides,
});

describe("buildProjectPayload", () => {
  it("produces empty arrays by default", () => {
    const values = makeFormValues({ status: "active", nameId: "n1" as any, description: "Test" });
    const payload = buildProjectPayload(values);

    expect(payload.consideringNameIds).toEqual([]);
    expect(payload.tags).toEqual([]);
    expect(payload.nameId).toBe("n1");
    expect(payload.description).toBe("Test");
  });

  it("keeps considering names when status is idea", () => {
    const values = makeFormValues({
      status: "idea",
      consideringNameIds: ["n1", "n2"] as any,
    });

    const payload = buildProjectPayload(values);
    expect(payload.consideringNameIds).toEqual(["n1", "n2"]);
  });

  it("drops deployment metadata for ideas", () => {
    const values = makeFormValues({
      status: "idea",
      githubRepo: "owner/repo",
      productionUrl: "https://example.com",
    });

    const payload = buildProjectPayload(values);
    expect(payload.githubRepo).toBeUndefined();
    expect(payload.productionUrl).toBeUndefined();
  });

  it("trims optional strings and drops empty entries", () => {
    const values = makeFormValues({
      status: "active",
      nameId: "n1" as any,
      description: "  Keep me ",
      githubRepo: "  ",
      productionUrl: "",
      tags: ["alpha", " ", "beta"],
    });

    const payload = buildProjectPayload(values);
    expect(payload.description).toBe("Keep me");
    expect(payload.githubRepo).toBeUndefined();
    expect(payload.productionUrl).toBeUndefined();
    expect(payload.tags).toEqual(["alpha", "beta"]);
  });
});

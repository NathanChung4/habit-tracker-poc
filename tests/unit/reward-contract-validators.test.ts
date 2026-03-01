import { describe, expect, it } from "vitest";
import { rewardContractCreateSchema, rewardContractPatchSchema } from "../../lib/validators";

describe("reward contract validators", () => {
  it("accepts valid create payload", () => {
    const result = rewardContractCreateSchema.parse({
      title: "Watch an episode",
      threshold: 0.9,
      isActive: true
    });

    expect(result).toEqual({
      title: "Watch an episode",
      threshold: 0.9,
      isActive: true
    });
  });

  it("rejects create payload with out-of-range threshold", () => {
    const result = rewardContractCreateSchema.safeParse({
      title: "Gaming",
      threshold: 1.2,
      isActive: true
    });

    expect(result.success).toBe(false);
  });

  it("requires at least one field on patch", () => {
    const result = rewardContractPatchSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts partial patch payload", () => {
    const result = rewardContractPatchSchema.parse({
      isActive: false
    });

    expect(result).toEqual({
      isActive: false
    });
  });
});

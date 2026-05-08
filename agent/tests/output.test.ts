import { describe, expect, it } from "vitest";
import { extractJsonObject } from "../src/agents/output.js";

describe("extractJsonObject", () => {
  it("extracts the first balanced JSON object instead of greedily merging objects", () => {
    const text = 'prefix {"a":"brace } inside string","b":1} trailing {"c":2}';
    expect(extractJsonObject(text)).toBe('{"a":"brace } inside string","b":1}');
  });

  it("uses the first right brace for malformed candidates", () => {
    const text = 'prefix {"a":{"broken":1} trailing {"other":2}';
    expect(extractJsonObject(text)).toBe('{"a":{"broken":1}');
  });
});

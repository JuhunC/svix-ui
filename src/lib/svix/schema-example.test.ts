import { describe, it, expect } from "vitest";
import { exampleFromSchema } from "./schema-example";

describe("exampleFromSchema", () => {
  it("returns null for non-object input", () => {
    expect(exampleFromSchema(undefined)).toBeNull();
    expect(exampleFromSchema(null)).toBeNull();
    expect(exampleFromSchema("string")).toBeNull();
    expect(exampleFromSchema(42)).toBeNull();
    expect(exampleFromSchema(true)).toBeNull();
    expect(exampleFromSchema([{ type: "string" }])).toBeNull();
  });

  it("passes through an explicit example, taking priority over everything", () => {
    expect(exampleFromSchema({ example: "hello", type: "string" })).toBe("hello");
    // example wins over default and enum
    expect(
      exampleFromSchema({ example: "ex", default: "def", enum: ["en"] }),
    ).toBe("ex");
    // a falsy example value is still passed through
    expect(exampleFromSchema({ example: 0, type: "string" })).toBe(0);
  });

  it("passes through a default when there is no example", () => {
    expect(exampleFromSchema({ default: 42, type: "integer" })).toBe(42);
    // default wins over enum
    expect(exampleFromSchema({ default: "def", enum: ["en"] })).toBe("def");
  });

  it("uses the first enum value when there is no example or default", () => {
    expect(exampleFromSchema({ enum: ["first", "second"] })).toBe("first");
    // an empty enum is ignored and falls through to the type handling
    expect(exampleFromSchema({ enum: [], type: "string" })).toBe("string");
  });

  it("synthesizes scalar types", () => {
    expect(exampleFromSchema({ type: "string" })).toBe("string");
    expect(exampleFromSchema({ type: "integer" })).toBe(0);
    expect(exampleFromSchema({ type: "number" })).toBe(0);
    expect(exampleFromSchema({ type: "boolean" })).toBe(true);
    expect(exampleFromSchema({ type: "null" })).toBeNull();
  });

  it("uses a placeholder timestamp for format:date-time strings", () => {
    expect(exampleFromSchema({ type: "string", format: "date-time" })).toBe(
      "2026-01-01T00:00:00Z",
    );
    // other formats stay generic
    expect(exampleFromSchema({ type: "string", format: "email" })).toBe("string");
  });

  it("uses the first entry when type is an array of types", () => {
    expect(exampleFromSchema({ type: ["string", "null"] })).toBe("string");
    expect(exampleFromSchema({ type: ["integer", "null"] })).toBe(0);
  });

  it("returns null for an unknown type", () => {
    expect(exampleFromSchema({ type: "mystery" })).toBeNull();
  });

  it("builds an object from its properties", () => {
    expect(
      exampleFromSchema({
        type: "object",
        properties: {
          name: { type: "string" },
          count: { type: "integer" },
          active: { type: "boolean" },
        },
      }),
    ).toEqual({ name: "string", count: 0, active: true });
  });

  it("treats a schema with properties but no type as an object", () => {
    expect(
      exampleFromSchema({ properties: { id: { type: "string" } } }),
    ).toEqual({ id: "string" });
  });

  it("builds a single-element array from items", () => {
    expect(
      exampleFromSchema({ type: "array", items: { type: "string" } }),
    ).toEqual(["string"]);
  });

  it("defaults array items to an empty schema, yielding [null]", () => {
    expect(exampleFromSchema({ type: "array" })).toEqual([null]);
  });

  it("recurses through nested objects and arrays", () => {
    expect(
      exampleFromSchema({
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: {
              id: { type: "string" },
              roles: { type: "array", items: { type: "string" } },
            },
          },
          created_at: { type: "string", format: "date-time" },
        },
      }),
    ).toEqual({
      user: { id: "string", roles: ["string"] },
      created_at: "2026-01-01T00:00:00Z",
    });
  });

  it("guards against runaway recursion beyond depth 6", () => {
    // The boundary: depth 6 still resolves, depth 7 short-circuits to null.
    expect(exampleFromSchema({ type: "string" }, 6)).toBe("string");
    expect(exampleFromSchema({ type: "string" }, 7)).toBeNull();
  });

  it("truncates deeply nested schemas to null at the depth limit", () => {
    // Nest objects 8 levels deep; the leaf sits past depth 6 and becomes null.
    let schema: Record<string, unknown> = { type: "string" };
    for (let i = 0; i < 8; i++) {
      schema = { type: "object", properties: { child: schema } };
    }
    const result = exampleFromSchema(schema) as Record<string, unknown>;
    // Walk down and confirm the deepest branch was cut off.
    let node: unknown = result;
    for (let i = 0; i < 7; i++) {
      node = (node as Record<string, unknown>).child;
    }
    expect(node).toBeNull();
  });
});

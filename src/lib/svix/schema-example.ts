/**
 * Synthesizes a sample payload from a JSON Schema (Draft 7-ish). Best-effort —
 * used to show consumers an example of each event type in the catalog.
 */
type Schema = Record<string, unknown>;

function isObject(v: unknown): v is Schema {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function exampleFromSchema(schema: unknown, depth = 0): unknown {
  if (depth > 6 || !isObject(schema)) return null;

  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0];

  const type = Array.isArray(schema.type)
    ? (schema.type[0] as string)
    : (schema.type as string | undefined);

  if (type === "object" || (!type && isObject(schema.properties))) {
    const out: Record<string, unknown> = {};
    const props = isObject(schema.properties) ? schema.properties : {};
    for (const key of Object.keys(props)) {
      out[key] = exampleFromSchema(props[key], depth + 1);
    }
    return out;
  }
  if (type === "array") {
    return [exampleFromSchema(schema.items ?? {}, depth + 1)];
  }
  switch (type) {
    case "string":
      return schema.format === "date-time" ? "2026-01-01T00:00:00Z" : "string";
    case "integer":
    case "number":
      return 0;
    case "boolean":
      return true;
    case "null":
      return null;
    default:
      return null;
  }
}

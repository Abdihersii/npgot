import type { JsonSchema, OpenApiDocument } from '../types';

function getByPointer(root: unknown, ref: string): unknown {
  if (!ref.startsWith('#/')) return undefined;
  return ref
    .slice(2)
    .split('/')
    .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduce<unknown>((current, key) => {
      if (!current || typeof current !== 'object') return undefined;
      return (current as Record<string, unknown>)[key];
    }, root);
}

export function resolveLocalRef<T>(value: T, root: OpenApiDocument, seen = new Set<string>()): T {
  if (!value || typeof value !== 'object') return value;
  const maybeRef = value as { $ref?: string };
  if (!maybeRef.$ref || !maybeRef.$ref.startsWith('#/')) return value;
  if (seen.has(maybeRef.$ref)) return value;

  const target = getByPointer(root, maybeRef.$ref);
  if (!target) return value;

  const nextSeen = new Set(seen);
  nextSeen.add(maybeRef.$ref);
  return resolveLocalRef(target as T, root, nextSeen);
}

export function dereferenceSchema(schema: JsonSchema | undefined, root: OpenApiDocument, depth = 0, seen = new Set<string>()): JsonSchema {
  if (!schema || depth > 12) return schema ?? {};
  if (schema.$ref && schema.$ref.startsWith('#/')) {
    if (seen.has(schema.$ref)) return { type: 'object', description: `Circular reference: ${schema.$ref}` };
    const target = getByPointer(root, schema.$ref) as JsonSchema | undefined;
    if (!target) return schema;
    const next = new Set(seen);
    next.add(schema.$ref);
    return dereferenceSchema(target, root, depth + 1, next);
  }

  const result: JsonSchema = { ...schema };
  if (schema.properties) {
    result.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([key, child]) => [key, dereferenceSchema(child, root, depth + 1, seen)]),
    );
  }
  if (schema.items) result.items = dereferenceSchema(schema.items, root, depth + 1, seen);
  if (Array.isArray(schema.oneOf)) result.oneOf = schema.oneOf.map((x) => dereferenceSchema(x, root, depth + 1, seen));
  if (Array.isArray(schema.anyOf)) result.anyOf = schema.anyOf.map((x) => dereferenceSchema(x, root, depth + 1, seen));
  if (Array.isArray(schema.allOf)) result.allOf = schema.allOf.map((x) => dereferenceSchema(x, root, depth + 1, seen));
  return result;
}

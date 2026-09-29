import type { JsonSchema } from '../types';

function literal(value: unknown): string {
  return JSON.stringify(value);
}

export function schemaToZod(schema: JsonSchema, required = true): string {
  let expression: string;
  const type = Array.isArray(schema.type) ? schema.type.find((x) => x !== 'null') : schema.type;

  if (schema.enum?.length) {
    const strings = schema.enum.filter((x): x is string => typeof x === 'string');
    if (strings.length === schema.enum.length && strings.length >= 1) {
      expression = `z.enum([${strings.map(literal).join(', ')}])`;
    } else {
      expression = `z.union([${schema.enum.map((value) => `z.literal(${literal(value)})`).join(', ')}])`;
    }
  } else if (schema.oneOf?.length) {
    expression = `z.union([${schema.oneOf.map((x) => schemaToZod(x, true)).join(', ')}])`;
  } else if (schema.anyOf?.length) {
    expression = `z.union([${schema.anyOf.map((x) => schemaToZod(x, true)).join(', ')}])`;
  } else if (schema.allOf?.length) {
    expression = schema.allOf.map((x) => schemaToZod(x, true)).join('.and(') + ')'.repeat(Math.max(0, schema.allOf.length - 1));
  } else if (type === 'integer') {
    expression = 'z.number().int()';
  } else if (type === 'number') {
    expression = 'z.number()';
  } else if (type === 'boolean') {
    expression = 'z.boolean()';
  } else if (type === 'array') {
    expression = `z.array(${schemaToZod(schema.items ?? {}, true)})`;
  } else if (type === 'object' || schema.properties) {
    const requiredKeys = new Set(schema.required ?? []);
    const entries = Object.entries(schema.properties ?? {}).map(([key, value]) => `${JSON.stringify(key)}: ${schemaToZod(value, requiredKeys.has(key))}`);
    expression = entries.length ? `z.object({ ${entries.join(', ')} }).passthrough()` : 'z.record(z.string(), z.unknown())';
  } else {
    expression = 'z.string()';
  }

  if (schema.description) expression += `.describe(${JSON.stringify(schema.description)})`;
  if (schema.nullable || (Array.isArray(schema.type) && schema.type.includes('null'))) expression += '.nullable()';
  if (!required) expression += '.optional()';
  return expression;
}

import yaml from 'js-yaml';
import type { OpenApiDocument } from '../types';

export function parseSpecText(input: string): OpenApiDocument {
  const text = input.trim();
  if (!text) throw new Error('Paste or load an OpenAPI/Swagger document first.');

  let parsed: unknown;
  try {
    parsed = text.startsWith('{') || text.startsWith('[') ? JSON.parse(text) : yaml.load(text);
  } catch (error) {
    throw new Error(`Could not parse JSON/YAML: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('The document must be a JSON/YAML object.');
  }

  const doc = parsed as OpenApiDocument;
  if (!doc.openapi && doc.swagger !== '2.0') {
    throw new Error('Expected OpenAPI 3.x or Swagger 2.0.');
  }
  if (!doc.paths || typeof doc.paths !== 'object') {
    throw new Error('The specification has no paths object.');
  }
  return doc;
}

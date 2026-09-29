import type { AnalysisResult, HttpMethod, InputField, JsonSchema, OpenApiDocument, ToolCandidate } from '../types';
import { resolveLocalRef, dereferenceSchema } from './refs';
import { classifyRisk, operationScore } from './risk';
import { dedupeName, deriveToolName } from './naming';

const methods = new Set<HttpMethod>(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);

type Parameter = {
  name?: string;
  in?: 'path' | 'query' | 'header' | 'body';
  required?: boolean;
  description?: string;
  schema?: JsonSchema;
  type?: string;
  format?: string;
  items?: JsonSchema;
  $ref?: string;
};

type Operation = {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  deprecated?: boolean;
  parameters?: Parameter[];
  requestBody?: {
    required?: boolean;
    description?: string;
    content?: Record<string, { schema?: JsonSchema }>;
    $ref?: string;
  };
  responses?: Record<string, { description?: string }>;
};

function getBaseUrl(doc: OpenApiDocument): string {
  if (doc.openapi && Array.isArray(doc.servers) && doc.servers[0]?.url) return doc.servers[0].url;
  if (doc.swagger === '2.0' && doc.host) {
    const scheme = doc.schemes?.[0] ?? 'https';
    return `${scheme}://${doc.host}${doc.basePath ?? ''}`.replace(/\/$/, '');
  }
  return 'https://api.example.com';
}

function schemaFromParameter(parameter: Parameter, doc: OpenApiDocument): JsonSchema {
  if (parameter.schema) return dereferenceSchema(parameter.schema, doc);
  return dereferenceSchema({ type: parameter.type ?? 'string', format: parameter.format, items: parameter.items }, doc);
}

function collectFields(pathItem: Record<string, unknown>, operation: Operation, doc: OpenApiDocument): InputField[] {
  const rawParameters = [
    ...(Array.isArray(pathItem.parameters) ? pathItem.parameters : []),
    ...(Array.isArray(operation.parameters) ? operation.parameters : []),
  ] as Parameter[];

  const fields: InputField[] = [];
  const seen = new Set<string>();
  for (const raw of rawParameters) {
    const parameter = resolveLocalRef(raw, doc) as Parameter;
    if (!parameter.name || !parameter.in) continue;
    if (parameter.in === 'header' && ['authorization', 'x-api-key'].includes(parameter.name.toLowerCase())) continue;
    const key = `${parameter.in}:${parameter.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    fields.push({
      name: parameter.name,
      location: parameter.in,
      required: Boolean(parameter.required || parameter.in === 'path'),
      description: parameter.description,
      schema: schemaFromParameter(parameter, doc),
    });
  }

  const resolvedRequestBody = operation.requestBody ? resolveLocalRef(operation.requestBody, doc) as Operation['requestBody'] : undefined;
  const bodySchema = resolvedRequestBody?.content?.['application/json']?.schema
    ?? resolvedRequestBody?.content?.['application/*+json']?.schema
    ?? Object.values(resolvedRequestBody?.content ?? {}).find((entry) => entry.schema)?.schema;

  if (bodySchema) {
    fields.push({
      name: 'body',
      location: 'body',
      required: Boolean(resolvedRequestBody?.required),
      description: resolvedRequestBody?.description ?? 'JSON request body',
      schema: dereferenceSchema(bodySchema, doc),
    });
  }

  return fields;
}

function responseDescription(operation: Operation): string | undefined {
  const responses = operation.responses ?? {};
  return responses['200']?.description ?? responses['201']?.description ?? responses.default?.description;
}

export function analyzeSpec(doc: OpenApiDocument): AnalysisResult {
  const usedNames = new Set<string>();
  const tools: ToolCandidate[] = [];
  const warnings: string[] = [];
  let endpointCount = 0;

  for (const [path, rawPathItem] of Object.entries(doc.paths ?? {})) {
    if (!rawPathItem || typeof rawPathItem !== 'object') continue;
    const pathItem = rawPathItem as Record<string, unknown>;
    for (const [rawMethod, rawOperation] of Object.entries(pathItem)) {
      const method = rawMethod.toLowerCase() as HttpMethod;
      if (!methods.has(method) || !rawOperation || typeof rawOperation !== 'object') continue;
      endpointCount += 1;
      const operation = resolveLocalRef(rawOperation as Operation, doc) as Operation;
      const originalName = deriveToolName(method, path, operation.operationId);
      const name = dedupeName(originalName, usedNames);
      const fields = collectFields(pathItem, operation, doc);
      const summary = operation.summary?.trim() || `${method.toUpperCase()} ${path}`;
      const description = operation.description?.trim() || summary;
      const riskInfo = classifyRisk(method, `${name} ${summary} ${description} ${operation.tags?.join(' ') ?? ''}`);
      const score = operationScore({
        method,
        hasOperationId: Boolean(operation.operationId),
        hasSummary: Boolean(operation.summary),
        deprecated: Boolean(operation.deprecated),
        risk: riskInfo.risk,
        fieldCount: fields.length,
      });

      tools.push({
        name,
        originalName,
        method,
        path,
        summary,
        description,
        tags: operation.tags ?? [],
        deprecated: Boolean(operation.deprecated),
        risk: riskInfo.risk,
        requiresConfirmation: riskInfo.confirmation,
        recommended: score >= 58 && !operation.deprecated && riskInfo.risk !== 'destructive',
        score,
        fields,
        responseDescription: responseDescription(operation),
      });
    }
  }

  if (tools.some((tool) => tool.name !== tool.originalName)) warnings.push('Duplicate operation names were automatically disambiguated.');
  if (!doc.info?.title) warnings.push('The specification has no info.title.');
  if (getBaseUrl(doc) === 'https://api.example.com') warnings.push('No server/base URL was found. Generated code uses API_BASE_URL.');

  return {
    title: doc.info?.title ?? 'Untitled API',
    version: doc.info?.version ?? 'unknown',
    specVersion: doc.openapi ? `OpenAPI ${doc.openapi}` : `Swagger ${doc.swagger ?? 'unknown'}`,
    baseUrl: getBaseUrl(doc),
    endpointCount,
    tools: tools.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)),
    warnings,
  };
}

export function curateTools(tools: ToolCandidate[], mode: 'safe' | 'balanced' | 'exhaustive'): ToolCandidate[] {
  if (mode === 'exhaustive') return tools;
  if (mode === 'safe') {
    return tools.filter((tool) => tool.risk === 'read' && !tool.deprecated).slice(0, 30);
  }
  const preferred = tools.filter((tool) => !tool.deprecated && tool.risk !== 'destructive');
  const destructive = tools.filter((tool) => !tool.deprecated && tool.risk === 'destructive');
  return [...preferred.slice(0, 60), ...destructive.slice(0, 8)];
}

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options';
export type RiskLevel = 'read' | 'write' | 'sensitive' | 'destructive';
export type CurationMode = 'safe' | 'balanced' | 'exhaustive';

export type JsonSchema = {
  type?: string | string[];
  title?: string;
  description?: string;
  format?: string;
  enum?: unknown[];
  default?: unknown;
  nullable?: boolean;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  additionalProperties?: boolean | JsonSchema;
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  allOf?: JsonSchema[];
  $ref?: string;
  [key: string]: unknown;
};

export type OpenApiDocument = {
  openapi?: string;
  swagger?: string;
  info?: { title?: string; version?: string; description?: string };
  servers?: { url: string }[];
  schemes?: string[];
  host?: string;
  basePath?: string;
  paths?: Record<string, Record<string, unknown>>;
  components?: Record<string, unknown>;
  definitions?: Record<string, unknown>;
  [key: string]: unknown;
};

export type InputField = {
  name: string;
  location: 'path' | 'query' | 'header' | 'body';
  required: boolean;
  description?: string;
  schema: JsonSchema;
};

export type ToolCandidate = {
  name: string;
  originalName: string;
  method: HttpMethod;
  path: string;
  summary: string;
  description: string;
  tags: string[];
  deprecated: boolean;
  risk: RiskLevel;
  requiresConfirmation: boolean;
  recommended: boolean;
  score: number;
  fields: InputField[];
  responseDescription?: string;
};

export type AnalysisResult = {
  title: string;
  version: string;
  specVersion: string;
  baseUrl: string;
  endpointCount: number;
  tools: ToolCandidate[];
  warnings: string[];
};

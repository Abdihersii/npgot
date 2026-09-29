import type { AnalysisResult, ToolCandidate } from '../types';
import { schemaToZod } from './zod';

export type GeneratedProject = Record<string, string>;

function groupSchema(tool: ToolCandidate, location: 'path' | 'query' | 'header'): { expression: string; required: boolean } | null {
  const fields = tool.fields.filter((field) => field.location === location);
  if (!fields.length) return null;
  const entries = fields.map((field) => `${JSON.stringify(field.name)}: ${schemaToZod(field.schema, field.required)}`);
  return { expression: `z.object({ ${entries.join(', ')} })`, required: fields.some((field) => field.required) };
}

function toolSchema(tool: ToolCandidate): string {
  const pieces: string[] = [];
  for (const location of ['path', 'query', 'header'] as const) {
    const schema = groupSchema(tool, location);
    if (schema) pieces.push(`${location}: ${schema.expression}${schema.required ? '' : '.optional()'}`);
  }
  const body = tool.fields.find((field) => field.location === 'body');
  if (body) pieces.push(`body: ${schemaToZod(body.schema, body.required)}`);
  return `{ ${pieces.join(', ')} }`;
}

function metadata(tool: ToolCandidate): string {
  return JSON.stringify({
    name: tool.name,
    method: tool.method.toUpperCase(),
    path: tool.path,
    risk: tool.risk,
    requiresConfirmation: tool.requiresConfirmation,
  });
}

function serverSource(result: AnalysisResult, tools: ToolCandidate[]): string {
  const registrations = tools.map((tool) => `
  server.registerTool(
    ${JSON.stringify(tool.name)},
    {
      title: ${JSON.stringify(tool.summary)},
      description: ${JSON.stringify(`${tool.description}\n\nGenerated from ${tool.method.toUpperCase()} ${tool.path}. Risk: ${tool.risk}.`)},
      inputSchema: ${toolSchema(tool)},
      annotations: {
        readOnlyHint: ${tool.risk === 'read'},
        destructiveHint: ${tool.risk === 'destructive'},
        idempotentHint: ${['get', 'put', 'delete', 'head', 'options'].includes(tool.method)},
        openWorldHint: true,
      },
    },
    async (args) => executeOperation(${metadata(tool)}, args),
  );`).join('\n');

  return `import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import * as z from 'zod/v4';

const DEFAULT_BASE_URL = ${JSON.stringify(result.baseUrl)};
const API_BASE_URL = (process.env.API_BASE_URL || DEFAULT_BASE_URL).replace(/\\/$/, '');
const API_TOKEN = process.env.API_TOKEN;
const API_KEY_HEADER = process.env.API_KEY_HEADER || 'Authorization';
const API_KEY_PREFIX = process.env.API_KEY_PREFIX ?? 'Bearer ';
const ALLOW_DESTRUCTIVE_ACTIONS = process.env.ALLOW_DESTRUCTIVE_ACTIONS === 'true';

type OperationMeta = {
  name: string;
  method: string;
  path: string;
  risk: 'read' | 'write' | 'sensitive' | 'destructive';
  requiresConfirmation: boolean;
};

type ToolArgs = {
  path?: Record<string, unknown>;
  query?: Record<string, unknown>;
  header?: Record<string, unknown>;
  body?: unknown;
};

function encodePath(pathTemplate: string, values: Record<string, unknown> = {}) {
  return pathTemplate.replace(/\\{([^}]+)\\}/g, (_, key: string) => {
    const value = values[key];
    if (value === undefined || value === null) throw new Error(\`Missing required path parameter: \${key}\`);
    return encodeURIComponent(String(value));
  });
}

function buildUrl(meta: OperationMeta, args: ToolArgs) {
  const url = new URL(API_BASE_URL + encodePath(meta.path, args.path));
  for (const [key, rawValue] of Object.entries(args.query ?? {})) {
    if (rawValue === undefined || rawValue === null) continue;
    if (Array.isArray(rawValue)) rawValue.forEach((value) => url.searchParams.append(key, String(value)));
    else url.searchParams.set(key, String(rawValue));
  }
  return url;
}

async function executeOperation(meta: OperationMeta, args: ToolArgs = {}) {
  if (meta.risk === 'destructive' && !ALLOW_DESTRUCTIVE_ACTIONS) {
    return {
      isError: true,
      content: [{ type: 'text' as const, text: \`Blocked destructive tool \${meta.name}. Set ALLOW_DESTRUCTIVE_ACTIONS=true after reviewing the generated code.\` }],
    };
  }

  try {
    const url = buildUrl(meta, args);
    const headers = new Headers({ Accept: 'application/json' });
    if (API_TOKEN) headers.set(API_KEY_HEADER, API_KEY_PREFIX + API_TOKEN);
    for (const [key, value] of Object.entries(args.header ?? {})) {
      if (value !== undefined && value !== null) headers.set(key, String(value));
    }

    const hasBody = args.body !== undefined && !['GET', 'HEAD'].includes(meta.method);
    if (hasBody) headers.set('Content-Type', 'application/json');

    const response = await fetch(url, {
      method: meta.method,
      headers,
      body: hasBody ? JSON.stringify(args.body) : undefined,
    });

    const text = await response.text();
    let data: unknown = text;
    try { data = text ? JSON.parse(text) : null; } catch { /* keep text */ }

    const payload = {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      data,
    };

    return {
      isError: !response.ok,
      structuredContent: payload,
      content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
    };
  } catch (error) {
    return {
      isError: true,
      content: [{ type: 'text' as const, text: error instanceof Error ? error.message : String(error) }],
    };
  }
}

function createServer() {
  const server = new McpServer({ name: 'npgot-generated-server', version: '1.0.0' });
${registrations}
  return server;
}

async function startStdio() {
  const server = createServer();
  await server.connect(new StdioServerTransport());
}

async function startHttp() {
  const app = createMcpExpressApp({ host: process.env.HOST || '0.0.0.0' });
  app.post('/mcp', async (req, res) => {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      transport.close();
      server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error(error);
      if (!res.headersSent) res.status(500).json({ error: 'MCP request failed' });
    }
  });
  app.get('/health', (_req, res) => res.json({ ok: true, tools: ${tools.length} }));
  const port = Number(process.env.PORT || 8787);
  app.listen(port, () => console.log(\`npgot MCP server listening on http://localhost:\${port}/mcp\`));
}

if ((process.env.MCP_TRANSPORT || 'http') === 'stdio') await startStdio();
else await startHttp();
`;
}

export function generateProject(result: AnalysisResult, tools: ToolCandidate[]): GeneratedProject {
  return {
    'package.json': JSON.stringify({
      name: 'npgot-generated-mcp',
      version: '1.0.0',
      private: true,
      type: 'module',
      scripts: { dev: 'tsx watch src/index.ts', start: 'tsx src/index.ts', build: 'tsc -p tsconfig.json', inspector: 'npx @modelcontextprotocol/inspector@latest' },
      dependencies: { '@modelcontextprotocol/sdk': '^1.31.0', express: '^5.1.0', zod: '^4.1.11' },
      devDependencies: { '@types/express': '^5.0.3', tsx: '^4.20.5', typescript: '^5.9.2' },
    }, null, 2),
    'tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, esModuleInterop: true, skipLibCheck: true, outDir: 'dist' }, include: ['src/**/*.ts'] }, null, 2),
    '.env.example': `API_BASE_URL=${result.baseUrl}\nAPI_TOKEN=\nAPI_KEY_HEADER=Authorization\nAPI_KEY_PREFIX=Bearer \nALLOW_DESTRUCTIVE_ACTIONS=false\nMCP_TRANSPORT=http\nPORT=8787\n`,
    'src/index.ts': serverSource(result, tools),
    'README.md': `# Generated MCP server\n\nGenerated by **npgot** from **${result.title}**.\n\n## Run\n\n\`\`\`bash\nnpm install\ncp .env.example .env\nnpm run start\n\`\`\`\n\nRemote MCP endpoint: \`http://localhost:8787/mcp\`. For local clients set \`MCP_TRANSPORT=stdio\`.\n\n## Safety\n\nDestructive tools are blocked by default. Review the generated handlers before setting \`ALLOW_DESTRUCTIVE_ACTIONS=true\`. Authentication is intentionally environment-based and should be adapted to your API.\n`,
  };
}

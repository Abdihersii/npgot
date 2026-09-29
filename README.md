# npgot

**OpenAPI / Swagger → curated MCP server, entirely in your browser.**

npgot is a free local-first developer tool. Paste or upload an OpenAPI 3.x / Swagger 2.0 spec and it will:

- extract operations and schemas
- generate stable MCP-friendly tool names
- rank useful actions deterministically, without an LLM
- classify tools as read, write, sensitive, or destructive
- mark actions that should require confirmation
- resolve local `$ref` schemas with circular-reference protection
- generate Zod input contracts
- export a runnable TypeScript MCP server
- support both Streamable HTTP and stdio in the generated project
- block destructive actions by default

The input specification never leaves the browser. URL imports are fetched directly by the browser and therefore depend on the source allowing CORS.

## Why

API specs are designed for developers, not agents. Exposing every endpoint blindly creates noisy toolsets and risky actions. npgot turns the same spec into a smaller, annotated agent surface you can actually inspect before giving it to ChatGPT, Codex, or another MCP client.

## Development

```bash
npm install
npm run dev
```

Verify:

```bash
npm test
npm run build
```

## Generated MCP servers

Generated projects use the official `@modelcontextprotocol/sdk`, default to Streamable HTTP for remote MCP, and can switch to stdio with `MCP_TRANSPORT=stdio`.

Destructive tools require `ALLOW_DESTRUCTIVE_ACTIONS=true` in the generated server environment. Review generated code and authentication before enabling them.

## License

MIT

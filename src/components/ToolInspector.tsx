import type { ToolCandidate } from '../types';

export function ToolInspector({ tool }: { tool: ToolCandidate | null }) {
  if (!tool) return <aside className="inspector empty">Select a tool to inspect its generated contract.</aside>;
  return (
    <aside className="inspector">
      <div className="eyebrow">Tool contract</div>
      <h3>{tool.name}</h3>
      <p>{tool.description}</p>
      <dl>
        <div><dt>Endpoint</dt><dd><code>{tool.method.toUpperCase()} {tool.path}</code></dd></div>
        <div><dt>Risk</dt><dd>{tool.risk}</dd></div>
        <div><dt>Confirmation</dt><dd>{tool.requiresConfirmation ? 'Recommended' : 'Not required'}</dd></div>
        <div><dt>Score</dt><dd>{tool.score}/100</dd></div>
      </dl>
      <h4>Inputs</h4>
      {tool.fields.length === 0 ? <p className="muted">No inputs.</p> : tool.fields.map((field) => (
        <div className="field" key={`${field.location}:${field.name}`}>
          <div><code>{field.name}</code> <span className="pill">{field.location}</span></div>
          <small>{field.required ? 'required' : 'optional'} · {Array.isArray(field.schema.type) ? field.schema.type.join(' | ') : field.schema.type ?? 'schema'}</small>
        </div>
      ))}
    </aside>
  );
}

import type { ToolCandidate } from '../types';

const riskLabel: Record<ToolCandidate['risk'], string> = {
  read: 'READ',
  write: 'WRITE',
  sensitive: 'CONFIRM',
  destructive: 'DESTRUCTIVE',
};

export function ToolTable({ tools, selected, onSelect }: { tools: ToolCandidate[]; selected?: string; onSelect: (tool: ToolCandidate) => void }) {
  return (
    <div className="tool-table-wrap">
      <table className="tool-table">
        <thead>
          <tr><th>Tool</th><th>Endpoint</th><th>Risk</th><th>Score</th></tr>
        </thead>
        <tbody>
          {tools.map((tool) => (
            <tr key={tool.name} className={selected === tool.name ? 'selected' : ''} onClick={() => onSelect(tool)}>
              <td><strong>{tool.name}</strong><span className="muted block">{tool.summary}</span></td>
              <td><code>{tool.method.toUpperCase()} {tool.path}</code></td>
              <td><span className={`risk risk-${tool.risk}`}>{riskLabel[tool.risk]}</span></td>
              <td>{tool.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

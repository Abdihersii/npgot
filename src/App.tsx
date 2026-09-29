import { useMemo, useState } from 'react';
import { parseSpecText } from './lib/parse';
import { analyzeSpec, curateTools } from './lib/analyze';
import { generateProject } from './lib/generate';
import { downloadProject } from './lib/download';
import { petstoreSample } from './sample';
import type { AnalysisResult, CurationMode, ToolCandidate } from './types';
import { ToolTable } from './components/ToolTable';
import { ToolInspector } from './components/ToolInspector';
import './styles.css';

const initialText = `# Paste OpenAPI 3.x or Swagger 2.0 here\n# Or use the sample button below.`;

export default function App() {
  const [input, setInput] = useState(initialText);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [mode, setMode] = useState<CurationMode>('balanced');
  const [selected, setSelected] = useState<ToolCandidate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [url, setUrl] = useState('');

  const tools = useMemo(() => analysis ? curateTools(analysis.tools, mode) : [], [analysis, mode]);
  const generated = useMemo(() => analysis ? generateProject(analysis, tools) : null, [analysis, tools]);

  function run(text = input) {
    try {
      const next = analyzeSpec(parseSpecText(text));
      setAnalysis(next);
      setSelected(curateTools(next.tools, mode)[0] ?? null);
      setError(null);
    } catch (err) {
      setAnalysis(null);
      setSelected(null);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function importUrl() {
    if (!url.trim()) return;
    setLoadingUrl(true);
    try {
      const response = await fetch(url.trim());
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      setInput(text);
      run(text);
    } catch (err) {
      setError(`Could not load the URL in-browser. The API may block CORS. Paste or upload the spec instead. (${err instanceof Error ? err.message : String(err)})`);
    } finally {
      setLoadingUrl(false);
    }
  }

  async function onFile(file?: File) {
    if (!file) return;
    const text = await file.text();
    setInput(text);
    run(text);
  }

  async function copyServer() {
    if (!generated) return;
    await navigator.clipboard.writeText(generated['src/index.ts']);
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#">npgot<span>/</span></a>
        <div className="header-meta">OpenAPI → MCP · runs in your browser</div>
        <a className="github-link" href="https://github.com/Abdihersii/npgot" target="_blank" rel="noreferrer">GitHub ↗</a>
      </header>

      <section className="hero">
        <div className="eyebrow">FREE · LOCAL-FIRST · NO API KEY</div>
        <h1>Turn an API spec into<br />agent-ready MCP tools.</h1>
        <p>npgot reads OpenAPI/Swagger, ranks useful actions, marks risky operations, and exports a runnable TypeScript MCP server.</p>
      </section>

      <section className="workbench">
        <div className="input-panel">
          <div className="panel-top"><strong>1. Load a spec</strong><button onClick={() => { setInput(petstoreSample); run(petstoreSample); }}>Use sample</button></div>
          <div className="url-row"><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/openapi.json" /><button onClick={importUrl} disabled={loadingUrl}>{loadingUrl ? 'Loading…' : 'Import URL'}</button></div>
          <textarea value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} />
          <div className="actions"><label className="file-button">Upload file<input type="file" accept=".json,.yaml,.yml,text/yaml,application/json" onChange={(e) => onFile(e.target.files?.[0])} /></label><button className="primary" onClick={() => run()}>Analyze spec</button></div>
          {error && <div className="error">{error}</div>}
        </div>

        <div className="output-panel">
          <div className="panel-top"><strong>2. Curate actions</strong><div className="modes">{(['safe', 'balanced', 'exhaustive'] as CurationMode[]).map((value) => <button className={mode === value ? 'active' : ''} onClick={() => setMode(value)} key={value}>{value}</button>)}</div></div>
          {!analysis ? <div className="empty-state">Load a spec to see ranked MCP tools.</div> : <>
            <div className="stats">
              <div><span>{analysis.endpointCount}</span><small>endpoints</small></div>
              <div><span>{tools.length}</span><small>generated tools</small></div>
              <div><span>{tools.filter((x) => x.risk === 'read').length}</span><small>read-only</small></div>
              <div><span>{tools.filter((x) => x.requiresConfirmation).length}</span><small>confirmations</small></div>
            </div>
            <div className="spec-meta"><strong>{analysis.title}</strong><span>{analysis.specVersion} · {analysis.version}</span><code>{analysis.baseUrl}</code></div>
            <div className="tool-layout"><ToolTable tools={tools} selected={selected?.name} onSelect={setSelected} /><ToolInspector tool={selected} /></div>
            <div className="export-bar"><div><strong>3. Export</strong><span>TypeScript · Streamable HTTP + stdio · destructive actions gated</span></div><div><button onClick={copyServer}>Copy server.ts</button><button className="primary" onClick={() => generated && downloadProject(generated, `${analysis.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'api'}-mcp.zip`)}>Download project</button></div></div>
          </>}
        </div>
      </section>

      <footer>npgot never uploads your API spec. URL imports are fetched directly by your browser.</footer>
    </main>
  );
}

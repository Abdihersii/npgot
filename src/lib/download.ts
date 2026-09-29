import JSZip from 'jszip';
import type { GeneratedProject } from './generate';

export async function downloadProject(files: GeneratedProject, filename = 'npgot-mcp-server.zip') {
  const zip = new JSZip();
  Object.entries(files).forEach(([path, content]) => zip.file(path, content));
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

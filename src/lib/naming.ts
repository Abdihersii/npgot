import type { HttpMethod } from '../types';

const verbs: Record<HttpMethod, string> = {
  get: 'get',
  post: 'create',
  put: 'replace',
  patch: 'update',
  delete: 'delete',
  head: 'check',
  options: 'inspect',
};

export function sanitizeToolName(value: string): string {
  const snake = value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
  const prefixed = /^\d/.test(snake) ? `tool_${snake}` : snake;
  return (prefixed || 'unnamed_tool').slice(0, 63);
}

export function deriveToolName(method: HttpMethod, path: string, operationId?: string): string {
  if (operationId) return sanitizeToolName(operationId);
  const cleanSegments = path
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.replace(/[{}]/g, ''))
    .filter((segment) => segment && !['api', 'v1', 'v2', 'v3'].includes(segment.toLowerCase()));

  return sanitizeToolName(`${verbs[method]}_${cleanSegments.join('_')}`);
}

export function dedupeName(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  let index = 2;
  while (used.has(`${name}_${index}`)) index += 1;
  const next = `${name}_${index}`.slice(0, 63);
  used.add(next);
  return next;
}

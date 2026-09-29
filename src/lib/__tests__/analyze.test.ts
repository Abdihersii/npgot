import { describe, expect, it } from 'vitest';
import { parseSpecText } from '../parse';
import { analyzeSpec, curateTools } from '../analyze';
import { petstoreSample } from '../../sample';

describe('OpenAPI analysis', () => {
  it('extracts and classifies operations', () => {
    const result = analyzeSpec(parseSpecText(petstoreSample));
    expect(result.endpointCount).toBe(4);
    expect(result.tools.find((tool) => tool.name === 'list_pets')?.risk).toBe('read');
    expect(result.tools.find((tool) => tool.name === 'delete_pet')?.risk).toBe('destructive');
  });

  it('safe mode keeps read-only tools', () => {
    const result = analyzeSpec(parseSpecText(petstoreSample));
    const tools = curateTools(result.tools, 'safe');
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.every((tool) => tool.risk === 'read')).toBe(true);
  });
});

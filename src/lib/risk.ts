import type { HttpMethod, RiskLevel } from '../types';

const sensitiveWords = [
  'refund', 'charge', 'payment', 'invoice', 'cancel', 'booking', 'subscription', 'permission',
  'role', 'password', 'token', 'secret', 'email', 'sms', 'message', 'publish', 'deploy', 'payout',
];
const destructiveWords = ['delete', 'remove', 'destroy', 'purge', 'terminate', 'revoke', 'wipe'];

export function classifyRisk(method: HttpMethod, text: string): { risk: RiskLevel; confirmation: boolean } {
  const haystack = text.toLowerCase();
  if (method === 'delete' || destructiveWords.some((word) => haystack.includes(word))) {
    return { risk: 'destructive', confirmation: true };
  }
  if (sensitiveWords.some((word) => haystack.includes(word))) {
    return { risk: method === 'get' || method === 'head' ? 'read' : 'sensitive', confirmation: method !== 'get' && method !== 'head' };
  }
  if (method === 'get' || method === 'head' || method === 'options') {
    return { risk: 'read', confirmation: false };
  }
  return { risk: 'write', confirmation: false };
}

export function operationScore(input: {
  method: HttpMethod;
  hasOperationId: boolean;
  hasSummary: boolean;
  deprecated: boolean;
  risk: RiskLevel;
  fieldCount: number;
}): number {
  let score = 50;
  if (input.hasOperationId) score += 12;
  if (input.hasSummary) score += 8;
  if (input.method === 'get') score += 8;
  if (input.method === 'post') score += 4;
  if (input.risk === 'sensitive') score -= 6;
  if (input.risk === 'destructive') score -= 16;
  if (input.deprecated) score -= 35;
  if (input.fieldCount > 18) score -= 8;
  if (input.fieldCount === 0) score += 2;
  return Math.max(0, Math.min(100, score));
}

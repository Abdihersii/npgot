import { describe, expect, it } from 'vitest';
import { deriveToolName, sanitizeToolName } from '../naming';

describe('tool naming', () => {
  it('normalizes operation ids', () => expect(sanitizeToolName('GetUserOrdersV2')).toBe('get_user_orders_v2'));
  it('derives readable names from paths', () => expect(deriveToolName('get', '/v1/users/{userId}/orders')).toBe('get_users_user_id_orders'));
});

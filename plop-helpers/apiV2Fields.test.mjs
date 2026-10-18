import { describe, expect, it } from 'bun:test';
import { hasStatusApiV2Field, parseApiV2Fields } from './apiV2Fields.mjs';

describe('parseApiV2Fields', () => {
  it('parses name, type and required flag', () => {
    expect(parseApiV2Fields('code:string:required,amount:decimal')).toEqual([
      { name: 'code', type: 'string', required: true },
      { name: 'amount', type: 'decimal', required: false },
      { name: 'createdAt', type: 'date', required: false },
    ]);
  });

  it('does not duplicate createdAt when provided', () => {
    const fields = parseApiV2Fields('name:string,createdAt:date');
    expect(fields.filter((field) => field.name === 'createdAt')).toHaveLength(1);
  });

  it('defaults the type to string', () => {
    expect(parseApiV2Fields('name')[0]).toMatchObject({ name: 'name', type: 'string' });
  });

  it('rejects unknown types and invalid names', () => {
    expect(() => parseApiV2Fields('code:blob')).toThrow(/Kiểu không hợp lệ/);
    expect(() => parseApiV2Fields('Code:string')).toThrow(/Tên trường không hợp lệ/);
  });

  it('detects a status field', () => {
    expect(hasStatusApiV2Field(parseApiV2Fields('status:status'))).toBe(true);
    expect(hasStatusApiV2Field(parseApiV2Fields('name:string'))).toBe(false);
  });
});

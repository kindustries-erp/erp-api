import { describe, expect, it } from 'bun:test';
import { enumEntryExists, insertAtMarker } from './apiV2Wiring.mjs';

const appModule = [
  "import { Module } from '@nestjs/common';",
  '@Module({',
  '  imports: [',
  '    CommonModule,',
  '    // plop:api-v2-modules',
  '  ],',
  '})',
].join('\n');

describe('insertAtMarker', () => {
  const spec = {
    marker: '// plop:api-v2-modules',
    snippet: '    CustomerClaimsCoreModule,',
    tag: '// api-v2-module:customer-claims-core:modules',
  };

  it('inserts the snippet right before the marker line', () => {
    const out = insertAtMarker(appModule, spec);
    const lines = out.split('\n');
    const at = lines.findIndex((l) => l.includes('CustomerClaimsCoreModule'));
    expect(lines[at + 1]).toContain('// plop:api-v2-modules');
    expect(lines[at]).toContain(spec.tag);
  });

  it('is idempotent: running twice does not duplicate the snippet', () => {
    const once = insertAtMarker(appModule, spec);
    const twice = insertAtMarker(once, spec);
    expect(twice).toBe(once);
    expect(twice.split('CustomerClaimsCoreModule').length - 1).toBe(1);
  });

  it('throws when the marker is missing, so a removed marker is never skipped silently', () => {
    expect(() => insertAtMarker('export const x = 1;', spec)).toThrow(/Không tìm thấy marker/);
  });
});

describe('enumEntryExists', () => {
  const enumFile = "export enum ErpResource {\n  BUSINESS_PARTNERS = 'business_partners',\n  // plop:api-v2-resources\n}";

  it('detects an existing key', () => {
    expect(enumEntryExists(enumFile, "  BUSINESS_PARTNERS = 'other',")).toBe(true);
  });

  it('detects an existing value under a different key', () => {
    expect(enumEntryExists(enumFile, "  BP = 'business_partners',")).toBe(true);
  });

  it('returns false for a new entry and for non-enum snippets', () => {
    expect(enumEntryExists(enumFile, "  VENDORS = 'vendors',")).toBe(false);
    expect(enumEntryExists(enumFile, "import { X } from './x';")).toBe(false);
  });
});

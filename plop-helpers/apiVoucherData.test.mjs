import { describe, expect, it } from 'bun:test';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApiVoucherData, voucherFileMap } from './apiVoucherData.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE_DIR = join(ROOT, 'plop-templates', 'voucher-v2');
const SRC_DIR = join(ROOT, 'src');

const base = {
  moduleInput: 'garage-goods-issues',
  headerEntityInput: 'GarageGoodsIssue',
  lineEntityInput: '',
  voucherPrefixInput: 'GGI',
  tableNameInput: '',
  lineTableNameInput: '',
  routePathInput: '',
  permissionResourceInput: '',
  wireInput: false,
};

/** Symbol đã bị bỏ khỏi helper hiện hành; template còn dùng là lệch contract. */
const FORBIDDEN_SYMBOLS = ['computeTableSummaries', 'TableColumnConfig', 'baseQb'];

const templateFiles = readdirSync(TEMPLATE_DIR).filter((name) => name.endsWith('.hbs'));

/** Kiểm tra `@/…` có tồn tại dưới `src/` (file `.ts`, `index.ts` hoặc thư mục). */
const aliasExists = (alias) => {
  const rel = alias.replace(/^@\//, '');
  const candidates = [
    join(SRC_DIR, `${rel}.ts`),
    join(SRC_DIR, rel, 'index.ts'),
    join(SRC_DIR, rel),
  ];
  return candidates.some((path) => existsSync(path));
};

describe('buildApiVoucherData', () => {
  it('normalizes the module name to the -core suffix', () => {
    const data = buildApiVoucherData(base);
    expect(data.moduleName).toBe('garage-goods-issues-core');
    expect(data.moduleBase).toBe('garage-goods-issues');
  });

  it('keeps an input that already ends with -core unchanged', () => {
    const data = buildApiVoucherData({ ...base, moduleInput: 'garage-goods-issues-core' });
    expect(data.moduleName).toBe('garage-goods-issues-core');
  });
});

describe('voucherFileMap', () => {
  it('maps every template file in plop-templates/voucher-v2 exactly once', () => {
    const data = buildApiVoucherData(base);
    const mapped = voucherFileMap(data).map((item) => item.template);
    expect([...mapped].sort()).toEqual([...templateFiles].sort());
    expect(new Set(mapped).size).toBe(mapped.length);
  });

  it('places the query service and its spec under the module services folder', () => {
    const data = buildApiVoucherData(base);
    const paths = voucherFileMap(data).map((item) => item.path);
    expect(paths).toContain(
      'src/v2/modules/garage-goods-issues-core/services/garage-goods-issue-query.service.ts',
    );
    expect(paths).toContain(
      'src/v2/modules/garage-goods-issues-core/services/garage-goods-issue-query.service.spec.ts',
    );
  });
});

describe('voucher-v2 templates stay on the current contract', () => {
  it.each(templateFiles)('%s does not use removed table-query symbols', (file) => {
    const text = readFileSync(join(TEMPLATE_DIR, file), 'utf8');
    for (const symbol of FORBIDDEN_SYMBOLS) {
      expect(text.includes(symbol), `${file} còn dùng ${symbol}`).toBe(false);
    }
  });

  it.each(templateFiles)('%s imports only existing @/ modules', (file) => {
    const text = readFileSync(join(TEMPLATE_DIR, file), 'utf8');
    const aliases = [...text.matchAll(/from\s+'(@\/[^']+)'/g)]
      .map((match) => match[1])
      // Bỏ import có placeholder Handlebars: đường dẫn phụ thuộc module, không tĩnh
      .filter((alias) => !alias.includes('{{'));
    for (const alias of aliases) {
      expect(aliasExists(alias), `${file}: ${alias} không tồn tại dưới src/`).toBe(true);
    }
  });

  it('keeps summaries on the shared helper', () => {
    const text = readFileSync(join(TEMPLATE_DIR, 'query-service.ts.hbs'), 'utf8');
    expect(text).toContain('applyListSummaries');
    expect(text).toContain('parseSummaryKeys');
    expect(text).toContain("tieBreaker: 'e.id'");
  });
});

// Đảm bảo tests không chạy trên thư mục rỗng do đổi tên
describe('template directory', () => {
  it('is not empty and is a directory', () => {
    expect(statSync(TEMPLATE_DIR).isDirectory()).toBe(true);
    expect(templateFiles.length).toBeGreaterThan(0);
  });
});

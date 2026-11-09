import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const coreRoot = join(repoRoot, 'src/v2/core');

/**
 * Quy tắc: core chỉ là base để kế thừa. Không chứa entity cụ thể, controller, job định kỳ.
 * Các họ core cũ chưa chuyển được liệt kê ở đây; mỗi lần chuyển một họ thì gỡ khỏi danh sách.
 */
export const LEGACY_CORE_ALLOWLIST = [
  'admin-dashboard-core',
  'approval-core',
  'branches-core',
  'business-partners-core',
  'rbac-core',
  'table-preferences-core',
];

const FORBIDDEN = [
  { label: '@Entity', pattern: /@Entity\s*\(/ },
  { label: '@Controller', pattern: /@Controller\s*\(/ },
  { label: '@Cron', pattern: /@Cron\s*\(/ },
  {
    label: 'extends ScheduledJob (job cụ thể)',
    pattern: /extends\s+ScheduledJob\b/,
  },
];

/** Bỏ comment để chú thích như "thêm `@Entity(...)`" không bị tính là vi phạm. */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Trả danh sách vi phạm trong một đoạn mã nguồn TypeScript (đã bỏ comment). */
export function findViolations(source) {
  const code = stripComments(source);
  return FORBIDDEN.filter(({ pattern }) => pattern.test(code)).map(
    ({ label }) => label,
  );
}

function tsFilesOf(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsFilesOf(path);
    return name.endsWith('.ts') && !name.endsWith('.spec.ts') ? [path] : [];
  });
}

/** Quét mọi họ core. Trả map: họ -> danh sách vi phạm `{ file, labels }`. */
export function scanCores(root = coreRoot) {
  const result = new Map();
  for (const family of readdirSync(root)) {
    const dir = join(root, family);
    if (!statSync(dir).isDirectory()) continue;
    const violations = [];
    for (const file of tsFilesOf(dir)) {
      const labels = findViolations(readFileSync(file, 'utf8'));
      if (labels.length)
        violations.push({ file: relative(repoRoot, file), labels });
    }
    result.set(family, violations);
  }
  return result;
}

describe('bố cục lõi API v2: core chỉ là base', () => {
  it('phát hiện đúng vi phạm trong mã nguồn mẫu', () => {
    expect(findViolations('@Entity({ name: "x" })\nexport class X {}')).toEqual(
      ['@Entity'],
    );
    expect(findViolations('@Controller("x")\nexport class C {}')).toEqual([
      '@Controller',
    ]);
    expect(findViolations('@Cron("0 * * * * *")\nrun() {}')).toEqual(['@Cron']);
    expect(findViolations('export class J extends ScheduledJob {}')).toEqual([
      'extends ScheduledJob (job cụ thể)',
    ]);
    expect(findViolations('export abstract class Base {}')).toEqual([]);
    expect(
      findViolations(
        '/** Module con thêm `@Entity(...)` */\nexport abstract class B {}',
      ),
    ).toEqual([]);
    expect(
      findViolations('// @Controller("x")\nexport abstract class B {}'),
    ).toEqual([]);
  });

  it('họ notifications-core và scheduler-core không có entity, controller hay job cụ thể', () => {
    const scan = scanCores();
    expect(scan.get('notifications-core')).toEqual([]);
    expect(scan.get('scheduler-core')).toEqual([]);
  });

  it('mọi họ ngoài danh sách cũ đều sạch (không có vi phạm)', () => {
    const scan = scanCores();
    const dirty = [...scan.entries()]
      .filter(
        ([family, violations]) =>
          violations.length && !LEGACY_CORE_ALLOWLIST.includes(family),
      )
      .map(([family, violations]) => ({ family, violations }));
    expect(dirty).toEqual([]);
  });

  it('danh sách cũ chỉ chứa họ thật sự còn vi phạm (không để sót khi đã chuyển xong)', () => {
    const scan = scanCores();
    for (const family of LEGACY_CORE_ALLOWLIST) {
      expect(existsSync(join(coreRoot, family))).toBe(true);
      expect(scan.get(family)?.length ?? 0).toBeGreaterThan(0);
    }
  });
});

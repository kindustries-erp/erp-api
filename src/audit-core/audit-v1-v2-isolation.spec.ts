import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';

/**
 * Guard tách V1 / V2 của nhật ký kiểm toán:
 * - V1 (`src/audit-core`, `src/audit-logs`) không import module v2 `audit-logs` hay lõi v2 `audit-core`.
 * - V2 (`src/v2/**`) không import `src/audit-core` hay `src/audit-logs`.
 * Đường dẫn được phân giải thật (alias `@/` và relative) nên `src/v2/modules/audit-logs` không bị nhầm.
 */
const SRC = join(__dirname, '..');
const V1_DIRS = [join(SRC, 'audit-core'), join(SRC, 'audit-logs')];
const V2_AUDIT_DIRS = [
  join(SRC, 'v2', 'modules', 'audit-logs'),
  join(SRC, 'v2', 'core', 'audit-core'),
];

function listTs(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return listTs(full);
    return full.endsWith('.ts') && !full.endsWith('.spec.ts') ? [full] : [];
  });
}

/** Trả về đường dẫn tuyệt đối mà import trỏ tới (chỉ alias `@/` và relative; bỏ qua package). */
function resolvedImports(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  return [...text.matchAll(/from\s+['"]([^'"]+)['"]/g)]
    .map((m) => m[1])
    .flatMap((spec) => {
      if (spec.startsWith('@/')) return [join(SRC, spec.slice(2))];
      if (spec.startsWith('.')) return [resolve(dirname(file), spec)];
      return [];
    });
}

const isInside = (target: string, dirs: string[]) =>
  dirs.some((dir) => target === dir || target.startsWith(dir + '/'));

describe('audit V1 / V2 isolation', () => {
  it('V1 không import module v2 audit-logs hay lõi v2 audit-core', () => {
    const files = V1_DIRS.flatMap(listTs);
    const bad = files.flatMap((file) =>
      resolvedImports(file)
        .filter((target) => isInside(target, V2_AUDIT_DIRS))
        .map(
          (target) =>
            `${file.replace(SRC, 'src')} -> ${target.replace(SRC, 'src')}`,
        ),
    );
    expect(bad).toEqual([]);
  });

  it('V2 không import audit-core hay audit-logs của V1', () => {
    const bad = listTs(join(SRC, 'v2')).flatMap((file) =>
      resolvedImports(file)
        .filter((target) => isInside(target, V1_DIRS))
        .map(
          (target) =>
            `${file.replace(SRC, 'src')} -> ${target.replace(SRC, 'src')}`,
        ),
    );
    expect(bad).toEqual([]);
  });
});

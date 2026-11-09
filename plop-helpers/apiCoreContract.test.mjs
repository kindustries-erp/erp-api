import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listCoreFamilies, readCoreManifest } from './apiThinData.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Ghép nội dung mọi file .ts trong một thư mục (đệ quy) để kiểm tra khai báo class. */
function sourceOf(dir) {
  return readdirSync(dir)
    .flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return [sourceOf(path)];
      return name.endsWith('.ts') ? [readFileSync(path, 'utf8')] : [];
    })
    .join('\n');
}

const families = listCoreFamilies(repoRoot);

describe('hợp đồng lõi API v2 (src/v2/core/*)', () => {
  it('có ít nhất một họ lõi để thin module ghép', () => {
    expect(families.length).toBeGreaterThan(0);
  });

  for (const family of families) {
    describe(family, () => {
      const dir = join(repoRoot, 'src/v2/core', family);
      const manifest = readCoreManifest(repoRoot, family);

      it('có barrel index.ts đúng đường dẫn trong manifest', () => {
        expect(manifest.barrel).toBe(`src/v2/core/${family}/index.ts`);
        expect(existsSync(join(repoRoot, manifest.barrel))).toBe(true);
      });

      it('khai báo class nền (entity, create DTO, service) và module nếu họ có module', () => {
        const source = sourceOf(dir);
        for (const name of [manifest.baseClasses.entity, manifest.baseClasses.createDto, manifest.baseClasses.service]) {
          const declared = new RegExp(`export (abstract )?class ${name}\\b`);
          expect(declared.test(source)).toBe(true);
        }
        // Module Nest của lõi chỉ tồn tại ở họ cũ; họ base mới không khai báo module
        if (manifest.module) {
          expect(new RegExp(`export class ${manifest.module}\\b`).test(source)).toBe(true);
        }
      });
    });
  }
});

#!/usr/bin/env bun
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

interface FileReport {
  path: string;
  relativePath: string;
  lines: number;
  type: 'controller' | 'service' | 'other';
  threshold: number;
  severity: 'CRITICAL' | 'WARNING';
  recommendedPattern: string;
}

const THRESHOLDS = {
  controller: 300,
  service: 500,
  other: 800,
  critical: 1000,
};

async function getFilesRecursively(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === 'dist' ||
        entry.name === '.git' ||
        entry.name === '.agents'
      ) {
        continue;
      }
      files.push(...(await getFilesRecursively(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      // Ignore test files and declaration files
      if (
        entry.name.endsWith('.spec.ts') ||
        entry.name.endsWith('.test.ts') ||
        entry.name.endsWith('.d.ts')
      ) {
        continue;
      }
      files.push(fullPath);
    }
  }

  return files;
}

async function countLines(filePath: string): Promise<number> {
  const content = await readFile(filePath, 'utf-8');
  if (!content) return 0;
  return content.split('\n').length;
}

function categorizeFile(filePath: string): {
  type: 'controller' | 'service' | 'other';
  threshold: number;
  recommendedPattern: string;
} {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.controller.ts')) {
    return {
      type: 'controller',
      threshold: THRESHOLDS.controller,
      recommendedPattern: 'Pattern A (Sub-Controllers REST)',
    };
  }
  if (lower.endsWith('.service.ts')) {
    return {
      type: 'service',
      threshold: THRESHOLDS.service,
      recommendedPattern: 'Pattern B (Sub-Services & Facade)',
    };
  }
  return {
    type: 'other',
    threshold: THRESHOLDS.other,
    recommendedPattern: 'Pattern C (Query / Engine Helper)',
  };
}

async function main() {
  const rootDir = resolve(process.cwd(), 'src');
  console.log(`\n🔍 Đang quét mã nguồn tại: \x1b[36m${rootDir}\x1b[0m...`);

  const files = await getFilesRecursively(rootDir);
  const reports: FileReport[] = [];

  for (const file of files) {
    const lines = await countLines(file);
    const { type, threshold, recommendedPattern } = categorizeFile(file);

    if (lines > threshold) {
      const severity = lines >= THRESHOLDS.critical ? 'CRITICAL' : 'WARNING';
      reports.push({
        path: file,
        relativePath: relative(process.cwd(), file),
        lines,
        type,
        threshold,
        severity,
        recommendedPattern,
      });
    }
  }

  // Sort descending by line count
  reports.sort((a, b) => b.lines - a.lines);

  console.log('\n' + '='.repeat(110));
  console.log(' 🚨 BÁO CÁO CẢNH BÁO FILE VƯỢT QUÁ NGƯỠNG ĐỘ DÀI (BACKEND REFACTORING WARNING)');
  console.log('='.repeat(110));
  console.log(` Tiêu chuẩn: Controller > ${THRESHOLDS.controller} dòng | Service > ${THRESHOLDS.service} dòng | Khác > ${THRESHOLDS.other} dòng`);
  console.log(` Nghiêm trọng (CRITICAL): >= ${THRESHOLDS.critical} dòng\n`);

  if (reports.length === 0) {
    console.log(' \x1b[32m✔ Tuyệt vời! Không có file nào vượt quá ngưỡng quy định.\x1b[0m\n');
    return;
  }

  const criticals = reports.filter((r) => r.severity === 'CRITICAL');
  const warnings = reports.filter((r) => r.severity === 'WARNING');

  console.log(`\x1b[31m[!] Phát hiện ${reports.length} file cần lưu ý (${criticals.length} Critical, ${warnings.length} Warning):\x1b[0m\n`);

  const colLevel = 'MỨC ĐỘ'.padEnd(10);
  const colLines = 'SỐ DÒNG'.padStart(10);
  const colPath = 'ĐƯỜNG DẪN FILE'.padEnd(52);
  const colPattern = 'GỢI Ý PATTERN';

  console.log(`${colLevel} | ${colLines} | ${colPath} | ${colPattern}`);
  console.log('-'.repeat(110));

  for (const r of reports) {
    const isCrit = r.severity === 'CRITICAL';
    const tag = isCrit ? '🔴 CRIT' : '🟡 WARN';
    const levelStr = (isCrit ? `\x1b[31m${tag.padEnd(8)}\x1b[0m` : `\x1b[33m${tag.padEnd(8)}\x1b[0m`);
    const linesStr = `${r.lines.toLocaleString()} l`.padStart(10);
    const displayPath = r.relativePath.length > 50 ? '...' + r.relativePath.slice(-47) : r.relativePath.padEnd(52);
    const patternStr = `\x1b[90m${r.recommendedPattern}\x1b[0m`;

    console.log(`${levelStr} | ${linesStr} | ${displayPath} | ${patternStr}`);
  }

  console.log('\n' + '='.repeat(110));
  console.log(' 💡 HƯỚNG DẪN DÀNH CHO DEVELOPER / AGENT:');
  console.log(' 1. Đây chỉ là báo cáo CẢNH BÁO (Warning), script KHÔNG tự ý sửa hoặc xóa code.');
  console.log(' 2. Đọc chi tiết quy chuẩn refactor tại: .agents/skills/api-service-refactor/SKILL.md');
  console.log(' 3. Luôn bảo toàn Interface/Contract và chạy test kiểm chứng: bun run test');
  console.log('='.repeat(110) + '\n');
}

main().catch((err) => {
  console.error('Lỗi quét file:', err);
  process.exit(1);
});

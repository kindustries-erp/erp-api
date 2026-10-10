#!/usr/bin/env bun
/**
 * Quét file backend vượt ngưỡng kích thước + vi phạm Clean DI + vệ sinh script (read-only).
 *
 * Chạy từ thư mục erp-api:
 *   bun .agents/skills/api-service-refactor/scripts/scan-oversized-files.ts
 *   bun .../scan-oversized-files.ts --path=src/ai-hub-core      # chỉ quét một thư mục
 *   bun .../scan-oversized-files.ts --json                       # xuất JSON (cho CI/agent)
 *   bun .../scan-oversized-files.ts --strict                     # exit 1 nếu có vi phạm Clean DI
 *   bun .../scan-oversized-files.ts --no-scripts                 # bỏ qua scripts/ và src/**\/scripts/
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';

type FileType = 'controller' | 'service' | 'handler' | 'script' | 'other';

interface FileReport {
  relativePath: string;
  lines: number;
  type: FileType;
  threshold: number;
  severity: 'CRITICAL' | 'WARNING';
  recommendedPattern: string;
}

interface DiViolation {
  relativePath: string;
  kind: 'CONSTRUCTOR_UNION' | 'CONSTRUCTOR_OVERLOAD';
  detail: string;
}

interface ScriptHygiene {
  relativePath: string;
  flags: string[];
}

const THRESHOLDS = {
  controller: 300,
  service: 500,
  handler: 400,
  other: 800,
  script: 800,
  critical: 1000,
};

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.agents']);

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const strict = args.includes('--strict');
const includeScripts = !args.includes('--no-scripts');
const pathArg = args.find((a) => a.startsWith('--path='))?.slice('--path='.length);

function isScriptFile(rel: string): boolean {
  const p = rel.split(sep).join('/');
  return p.startsWith('scripts/') || /(^|\/)scripts\/[^/]+\.ts$/.test(p);
}

async function getFilesRecursively(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      files.push(...(await getFilesRecursively(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      // Bỏ test, khai báo kiểu và file dữ liệu thuần (*.data.ts) - không phải logic để refactor
      if (/\.(spec|test|d|data)\.ts$/.test(entry.name)) continue;
      files.push(fullPath);
    }
  }
  return files;
}

function categorizeFile(rel: string): {
  type: FileType;
  threshold: number;
  recommendedPattern: string;
} {
  const lower = rel.toLowerCase();
  if (isScriptFile(rel)) {
    return {
      type: 'script',
      threshold: THRESHOLDS.script,
      recommendedPattern: 'Script: gọi service/handler của app, không nhân đôi logic',
    };
  }
  if (lower.endsWith('.controller.ts')) {
    return { type: 'controller', threshold: THRESHOLDS.controller, recommendedPattern: 'Pattern A (Sub-Controllers REST)' };
  }
  if (lower.endsWith('.service.ts')) {
    return { type: 'service', threshold: THRESHOLDS.service, recommendedPattern: 'Pattern B (Sub-Services & Facade)' };
  }
  if (lower.endsWith('.handler.ts')) {
    return { type: 'handler', threshold: THRESHOLDS.handler, recommendedPattern: 'Pattern E/C (tách prompt, parser, hằng số thành module thuần)' };
  }
  return { type: 'other', threshold: THRESHOLDS.other, recommendedPattern: 'Pattern C (Query / Engine Helper)' };
}

/** Bỏ chuỗi và comment để regex không khớp nhầm vào nội dung. */
function stripNoise(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\\n])*'/g, "''")
    .replace(/"(?:\\.|[^"\\\n])*"/g, '""');
}

/** Lấy phần tham số của mọi `constructor(...)` (kể cả nhiều dòng) bằng đếm ngoặc. */
function extractConstructors(clean: string): { params: string; hasBody: boolean }[] {
  const out: { params: string; hasBody: boolean }[] = [];
  const re = /\bconstructor\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean))) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < clean.length && depth > 0) {
      if (clean[i] === '(') depth++;
      else if (clean[i] === ')') depth--;
      i++;
    }
    const params = clean.slice(start, i - 1);
    const after = clean.slice(i).trimStart();
    out.push({ params, hasBody: after.startsWith('{') || /^:[^{;]*\{/.test(after) });
  }
  return out;
}

function checkCleanDi(rel: string, src: string): DiViolation[] {
  if (!/@Injectable\s*\(/.test(src) && !/@Controller\s*\(/.test(src)) return [];
  const clean = stripNoise(src);
  const ctors = extractConstructors(clean);
  const violations: DiViolation[] = [];

  // Overload = có chữ ký constructor KHÔNG có thân hàm (`constructor(a: A);`). Nhiều class trong
  // một file mỗi class một constructor có thân là hợp lệ.
  const signatures = ctors.filter((c) => !c.hasBody).length;
  if (signatures > 0) {
    violations.push({
      relativePath: rel,
      kind: 'CONSTRUCTOR_OVERLOAD',
      detail: `${signatures} chữ ký constructor overload (không có thân hàm)`,
    });
  }
  for (const c of ctors) {
    // tham số kiểu union: `x: A | B` (bỏ qua `||`)
    const union = /:\s*[A-Za-z_][\w.<>\[\]]*(?:\s*\|\s*(?!\|)[A-Za-z_][\w.<>\[\]]*)+/.exec(c.params.replace(/\|\|/g, ''));
    if (union) {
      violations.push({
        relativePath: rel,
        kind: 'CONSTRUCTOR_UNION',
        detail: union[0].replace(/\s+/g, ' ').trim(),
      });
    }
  }
  return violations;
}

function checkScriptHygiene(rel: string, src: string): ScriptHygiene | null {
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  const flags: string[] = [];
  if (/dotenv\.config\(\s*\)/.test(code)) flags.push('dotenv.config() ambient (nạp .env ngầm)');
  if (/['"`][^'"`]*\.env\.(greenway|klotus)-(production|staging)[^'"`]*['"`]/.test(code) && !/load-script-env/.test(code)) {
    flags.push('hard-code tên file env tenant');
  }
  if (/\/home\/dev\//.test(code)) flags.push('đường dẫn tuyệt đối /home/dev');
  if (/9router/i.test(code) && /\bfetch\s*\(/.test(code)) flags.push('gọi thẳng 9router bằng fetch (dùng NineRouterClient)');
  if (/\bssl\s*:\s*false\b/.test(code) && !/load-script-env/.test(code)) flags.push('ssl:false hard-code');
  if (/process\.env\.DATABASE_URL/.test(code) && !/load-script-env/.test(code)) flags.push('đọc DATABASE_URL trực tiếp (dùng load-script-env)');
  return flags.length ? { relativePath: rel, flags } : null;
}

async function main() {
  const cwd = process.cwd();
  const roots = pathArg
    ? [resolve(cwd, pathArg)]
    : [resolve(cwd, 'src'), ...(includeScripts ? [resolve(cwd, 'scripts')] : [])];

  const files: string[] = [];
  for (const root of roots) {
    try {
      files.push(...(await getFilesRecursively(root)));
    } catch {
      // thư mục không tồn tại: bỏ qua
    }
  }

  const reports: FileReport[] = [];
  const di: DiViolation[] = [];
  const hygiene: ScriptHygiene[] = [];

  for (const file of files) {
    const rel = relative(cwd, file);
    const isScript = isScriptFile(rel);
    if (isScript && !includeScripts) continue;

    const content = await readFile(file, 'utf-8');
    const lines = content ? content.split('\n').length : 0;
    const { type, threshold, recommendedPattern } = categorizeFile(rel);

    if (lines > threshold) {
      reports.push({
        relativePath: rel,
        lines,
        type,
        threshold,
        severity: lines >= THRESHOLDS.critical ? 'CRITICAL' : 'WARNING',
        recommendedPattern,
      });
    }
    di.push(...checkCleanDi(rel, content));
    if (isScript) {
      const h = checkScriptHygiene(rel, content);
      if (h) hygiene.push(h);
    }
  }

  reports.sort((a, b) => b.lines - a.lines);

  if (asJson) {
    console.log(JSON.stringify({ thresholds: THRESHOLDS, oversized: reports, cleanDiViolations: di, scriptHygiene: hygiene }, null, 2));
    if (strict && di.length > 0) process.exit(1);
    return;
  }

  const line = '='.repeat(110);
  console.log(`\n🔍 Quét tại: \x1b[36m${roots.map((r) => relative(cwd, r) || '.').join(', ')}\x1b[0m (${files.length} file)`);
  console.log('\n' + line);
  console.log(' 🚨 FILE VƯỢT NGƯỠNG ĐỘ DÀI');
  console.log(line);
  console.log(` Controller > ${THRESHOLDS.controller} | Service > ${THRESHOLDS.service} | Handler > ${THRESHOLDS.handler} | Khác/Script > ${THRESHOLDS.other} | CRITICAL >= ${THRESHOLDS.critical}`);
  console.log(' (đã loại *.spec.ts, *.d.ts và file dữ liệu *.data.ts)\n');

  if (reports.length === 0) {
    console.log(' \x1b[32m✔ Không có file nào vượt ngưỡng.\x1b[0m\n');
  } else {
    const crit = reports.filter((r) => r.severity === 'CRITICAL').length;
    console.log(`\x1b[31m[!] ${reports.length} file cần lưu ý (${crit} Critical, ${reports.length - crit} Warning)\x1b[0m\n`);
    console.log(`${'MỨC ĐỘ'.padEnd(8)} | ${'SỐ DÒNG'.padStart(9)} | ${'LOẠI'.padEnd(10)} | ${'ĐƯỜNG DẪN FILE'.padEnd(52)} | GỢI Ý`);
    console.log('-'.repeat(110));
    for (const r of reports) {
      const tag = r.severity === 'CRITICAL' ? '\x1b[31mCRIT\x1b[0m    ' : '\x1b[33mWARN\x1b[0m    ';
      const p = r.relativePath.length > 50 ? '...' + r.relativePath.slice(-47) : r.relativePath.padEnd(52);
      console.log(`${tag} | ${`${r.lines.toLocaleString()} l`.padStart(9)} | ${r.type.padEnd(10)} | ${p} | \x1b[90m${r.recommendedPattern}\x1b[0m`);
    }
  }

  console.log('\n' + line);
  console.log(' 🧱 VI PHẠM CLEAN DI CONSTRUCTOR (cấm overload / union type trong @Injectable)');
  console.log(line);
  if (di.length === 0) {
    console.log(' \x1b[32m✔ Không phát hiện.\x1b[0m');
  } else {
    for (const v of di) console.log(` \x1b[31m✘\x1b[0m ${v.relativePath}  [${v.kind}] ${v.detail}`);
  }

  if (includeScripts) {
    console.log('\n' + line);
    console.log(' 🧹 VỆ SINH SCRIPT (chỉ báo cáo, không chặn) - xem quy ước env trong api-service-refactor.md');
    console.log(line);
    if (hygiene.length === 0) {
      console.log(' \x1b[32m✔ Không phát hiện.\x1b[0m');
    } else {
      console.log(` ${hygiene.length} script chưa theo chuẩn:`);
      for (const h of hygiene) console.log(` \x1b[33m•\x1b[0m ${h.relativePath}\n     - ${h.flags.join('\n     - ')}`);
    }
  }

  console.log('\n' + line);
  console.log(' 💡 Đây là báo cáo CẢNH BÁO, script KHÔNG tự sửa code. Quy chuẩn: .agents/workflows/api-service-refactor.md');
  console.log(' 💡 Khi chạy dưới /plan-and-task: chỉ chạy test scoped ở từng task, full suite ở Final Gate.');
  console.log(line + '\n');

  if (strict && di.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Lỗi quét file:', err);
  process.exit(1);
});

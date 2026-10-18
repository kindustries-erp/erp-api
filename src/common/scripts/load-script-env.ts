import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Loader env chuẩn cho các script chạy tay (backfill, seed, netoff...).
 *
 * Quy ước (khớp pipeline GitHub Actions: nhánh `erp-<tenant>-<stage>` <-> file `.env.<tenant>-<stage>`):
 *   1. Tham số vị trí bắt đầu bằng `.env`   (vd: `.env.greenway-staging`)
 *   2. `--env=<file>`
 *   3. `--target=<tenant>-<stage>`           (=> `.env.<tenant>-<stage>`)
 *   4. biến môi trường `ENV_FILE`
 *   5. file `.env` ở thư mục chạy (nếu có)
 *   6. không có file nào -> dùng `process.env` (vd: chạy trong container)
 *
 * Hermetic: khi đã chọn file thì CHỈ dùng giá trị trong file đó; các biến mà Bun tự nạp từ
 * `.env`/`.env.local` nhưng file được chọn không có sẽ bị gỡ khỏi `process.env`, tránh lẫn tenant.
 * File chỉ định mà không tồn tại thì báo lỗi, không âm thầm đổi sang file khác.
 */

export class ScriptEnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScriptEnvError';
  }
}

export type PgSsl = false | { rejectUnauthorized: false };

export interface ScriptEnv {
  /** Cấu hình hiệu lực của script (đã hermetic). */
  config: Record<string, string>;
  /** Mô tả nguồn: `file:<tên file>` hoặc `process.env`. */
  envSource: string;
  envFile: string | null;
  /** true nếu người chạy chọn file env tường minh (tham số/--env/--target/ENV_FILE), false nếu rơi về `.env`/process.env. */
  explicit: boolean;
  databaseUrl: string;
  /** `host:port/db` — không chứa user/password. */
  dbLabel: string;
  dbName: string;
  isProduction: boolean;
  ssl: PgSsl;
}

export interface ScriptEnvOptions {
  argv?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  /** Ghi cấu hình đã chọn vào `env` và gỡ biến lẫn từ `.env` ambient (mặc định true). */
  applyToEnv?: boolean;
}

export interface WriteGuard {
  apply: boolean;
  allowed: boolean;
  message: string;
}

const AMBIENT_FILES = ['.env', '.env.local'];

function pickEnvFileName(
  argv: string[],
  env: NodeJS.ProcessEnv,
): string | null {
  const positional = argv.find(
    (a) => !a.startsWith('--') && path.basename(a).startsWith('.env'),
  );
  if (positional) return positional;

  const flag = argv.find((a) => a.startsWith('--env='));
  if (flag) return flag.slice('--env='.length);

  const target = argv.find((a) => a.startsWith('--target='));
  if (target) {
    const name = target.slice('--target='.length).trim();
    if (!/^[a-z0-9-]+$/i.test(name)) {
      throw new ScriptEnvError(
        `--target không hợp lệ: "${name}" (chỉ gồm chữ, số, dấu gạch ngang, vd greenway-production)`,
      );
    }
    return `.env.${name}`;
  }

  return env.ENV_FILE ? env.ENV_FILE : null;
}

export function parseDatabaseUrl(url: string): {
  host: string;
  port: string;
  dbName: string;
} {
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: u.port || '5432',
      dbName: decodeURIComponent(u.pathname.replace(/^\//, '')),
    };
  } catch {
    throw new ScriptEnvError('DATABASE_URL không đúng định dạng URL');
  }
}

export function resolvePgSsl(config: Record<string, string>): PgSsl {
  const url = config.DATABASE_URL || '';
  const disabled =
    config.DB_SSL === 'false' ||
    url.includes('sslmode=disable') ||
    url.includes('ssl=false');
  if (disabled) return false;
  if (!url && config.DB_SSL !== 'true') return false;
  return { rejectUnauthorized: false };
}

function buildDatabaseUrl(config: Record<string, string>): string {
  if (config.DATABASE_URL) return config.DATABASE_URL.trim();
  if (config.DB_HOST && config.DB_DATABASE) {
    const user = encodeURIComponent(config.DB_USER || 'postgres');
    const pass = encodeURIComponent(config.DB_PASSWORD || '');
    const port = config.DB_PORT || '5432';
    return `postgresql://${user}:${pass}@${config.DB_HOST}:${port}/${config.DB_DATABASE}`;
  }
  throw new ScriptEnvError(
    'Thiếu DATABASE_URL (hoặc nhóm DB_HOST/DB_DATABASE) trong file env đã chọn.',
  );
}

function scrubAmbient(
  chosen: Record<string, string>,
  chosenPath: string | null,
  cwd: string,
  env: NodeJS.ProcessEnv,
): void {
  for (const name of AMBIENT_FILES) {
    const p = path.resolve(cwd, name);
    if (chosenPath && path.resolve(chosenPath) === p) continue;
    if (!fs.existsSync(p)) continue;
    const ambient = dotenv.parse(fs.readFileSync(p));
    for (const [key, value] of Object.entries(ambient)) {
      // Chỉ gỡ khi giá trị trong process.env đúng là giá trị nạp tự động từ file ambient
      if (!(key in chosen) && env[key] === value) delete env[key];
    }
  }
}

export function resolveScriptEnv(opts: ScriptEnvOptions = {}): ScriptEnv {
  const argv = opts.argv ?? process.argv.slice(2);
  const cwd = opts.cwd ?? process.cwd();
  const env = opts.env ?? process.env;
  const applyToEnv = opts.applyToEnv ?? true;

  const requested = pickEnvFileName(argv, env);
  let envFile: string | null = null;

  if (requested) {
    envFile = path.resolve(cwd, requested);
    if (!fs.existsSync(envFile)) {
      throw new ScriptEnvError(
        `Không tìm thấy file env đã chỉ định: ${requested} (tìm tại ${envFile}). Không tự đổi sang file khác.`,
      );
    }
  } else {
    const fallback = path.resolve(cwd, '.env');
    if (fs.existsSync(fallback)) envFile = fallback;
  }

  let config: Record<string, string>;
  let envSource: string;
  if (envFile) {
    config = dotenv.parse(fs.readFileSync(envFile));
    envSource = `file:${path.basename(envFile)}`;
    if (applyToEnv) {
      scrubAmbient(config, envFile, cwd, env);
      Object.assign(env, config);
    }
  } else {
    config = Object.fromEntries(
      Object.entries(env).filter(([, v]) => typeof v === 'string'),
    ) as Record<string, string>;
    envSource = 'process.env';
  }

  const databaseUrl = buildDatabaseUrl(config);
  const { host, port, dbName } = parseDatabaseUrl(databaseUrl);
  const isProduction =
    /production/i.test(dbName) ||
    (envFile ? /production/i.test(path.basename(envFile)) : false);

  return {
    config,
    envSource,
    envFile,
    explicit: Boolean(requested),
    databaseUrl,
    dbLabel: `${host}:${port}/${dbName}`,
    dbName,
    isProduction,
    ssl: resolvePgSsl({ ...config, DATABASE_URL: databaseUrl }),
  };
}

/**
 * Điều kiện ghi DB:
 *  - Ghi khi có `--apply` (bí danh cũ `--execute`); DB production cần thêm `--confirm=<tên DB>`.
 *  - `--dry-run` hoặc biến `DRY_RUN=true|1` luôn ép dry-run, kể cả khi có `--apply`.
 */
export function getWriteGuard(
  scriptEnv: ScriptEnv,
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
): WriteGuard {
  const forcedDry =
    argv.includes('--dry-run') || ['true', '1'].includes(env.DRY_RUN ?? '');
  if (forcedDry) {
    return {
      apply: false,
      allowed: false,
      message: 'DRY-RUN: không ghi DB (--dry-run / DRY_RUN).',
    };
  }

  const apply = argv.includes('--apply') || argv.includes('--execute');
  if (!apply) {
    return {
      apply: false,
      allowed: false,
      message: 'DRY-RUN: không ghi DB (thêm --apply để ghi).',
    };
  }
  if (scriptEnv.isProduction) {
    const confirm = argv.find((a) => a.startsWith('--confirm='));
    const value = confirm ? confirm.slice('--confirm='.length) : '';
    if (value !== scriptEnv.dbName) {
      return {
        apply: true,
        allowed: false,
        message: `DB production "${scriptEnv.dbName}": cần thêm --confirm=${scriptEnv.dbName} để ghi.`,
      };
    }
  }
  return { apply: true, allowed: true, message: 'APPLY: sẽ ghi vào DB.' };
}

export function describeScriptEnv(
  scriptEnv: ScriptEnv,
  guard?: WriteGuard,
): string {
  const prod = scriptEnv.isProduction ? ' [PRODUCTION]' : '';
  const lines = [
    `ENV : ${scriptEnv.envSource}`,
    `DB  : ${scriptEnv.dbLabel}${prod}`,
  ];
  if (guard) lines.push(`MODE: ${guard.message}`);
  return lines.join('\n');
}

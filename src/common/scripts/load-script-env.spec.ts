import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  describeScriptEnv,
  getWriteGuard,
  parseDatabaseUrl,
  resolvePgSsl,
  resolveScriptEnv,
  ScriptEnvError,
} from './load-script-env';

describe('load-script-env', () => {
  let dir: string;

  const write = (name: string, content: string) =>
    fs.writeFileSync(path.join(dir, name), content);

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'script-env-'));
    write(
      '.env',
      'DATABASE_URL=postgresql://u:p@db-dev.liouni.com:5433/erp_greenway_production\nNINE_ROUTER_BASE_URL=https://ambient.example/v1\n',
    );
    write(
      '.env.klotus-staging',
      'DATABASE_URL=postgresql://u:secret@db-dev.liouni.com:5433/erp_klotus_staging?sslmode=disable\nDB_SSL=false\n',
    );
    write(
      '.env.greenway-production',
      'DATABASE_URL=postgresql://u:p@db-dev.liouni.com:5433/erp_greenway_production\n',
    );
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('uses a positional .env.* argument and ignores the ambient .env', () => {
    const env: NodeJS.ProcessEnv = {};
    const r = resolveScriptEnv({
      argv: ['.env.klotus-staging'],
      cwd: dir,
      env,
    });
    expect(r.envSource).toBe('file:.env.klotus-staging');
    expect(r.explicit).toBe(true);
    expect(r.dbName).toBe('erp_klotus_staging');
    expect(r.config.NINE_ROUTER_BASE_URL).toBeUndefined();
  });

  it('supports --env=, --target= and ENV_FILE', () => {
    const a = resolveScriptEnv({
      argv: ['--env=.env.klotus-staging'],
      cwd: dir,
      env: {},
    });
    const b = resolveScriptEnv({
      argv: ['--target=klotus-staging'],
      cwd: dir,
      env: {},
    });
    const c = resolveScriptEnv({
      argv: [],
      cwd: dir,
      env: { ENV_FILE: '.env.klotus-staging' },
    });
    expect([a.dbName, b.dbName, c.dbName]).toEqual([
      'erp_klotus_staging',
      'erp_klotus_staging',
      'erp_klotus_staging',
    ]);
  });

  it('rejects an invalid --target', () => {
    expect(() =>
      resolveScriptEnv({ argv: ['--target=../x'], cwd: dir, env: {} }),
    ).toThrow(ScriptEnvError);
  });

  it('falls back to .env when nothing is specified', () => {
    const r = resolveScriptEnv({ argv: [], cwd: dir, env: {} });
    expect(r.envSource).toBe('file:.env');
    expect(r.isProduction).toBe(true);
    expect(r.explicit).toBe(false);
  });

  it('uses process.env when no file exists', () => {
    fs.rmSync(path.join(dir, '.env'));
    const r = resolveScriptEnv({
      argv: [],
      cwd: dir,
      env: { DATABASE_URL: 'postgresql://u:p@h:5432/erp_local' },
    });
    expect(r.envSource).toBe('process.env');
    expect(r.dbLabel).toBe('h:5432/erp_local');
  });

  it('throws (no silent fallback) when the requested file is missing', () => {
    expect(() =>
      resolveScriptEnv({ argv: ['.env.nope'], cwd: dir, env: {} }),
    ).toThrow(/Không tìm thấy file env/);
  });

  it('scrubs variables that Bun auto-loaded from the ambient .env', () => {
    // mô phỏng Bun đã nạp sẵn .env vào process.env
    const env: NodeJS.ProcessEnv = {
      DATABASE_URL:
        'postgresql://u:p@db-dev.liouni.com:5433/erp_greenway_production',
      NINE_ROUTER_BASE_URL: 'https://ambient.example/v1',
      UNRELATED_SHELL_VAR: 'keep',
    };
    const r = resolveScriptEnv({
      argv: ['.env.klotus-staging'],
      cwd: dir,
      env,
    });
    expect(env.DATABASE_URL).toContain('erp_klotus_staging');
    expect(env.NINE_ROUTER_BASE_URL).toBeUndefined();
    expect(env.UNRELATED_SHELL_VAR).toBe('keep');
    expect(r.config.NINE_ROUTER_BASE_URL).toBeUndefined();
  });

  it('does not mutate env when applyToEnv is false', () => {
    const env: NodeJS.ProcessEnv = {};
    resolveScriptEnv({
      argv: ['.env.klotus-staging'],
      cwd: dir,
      env,
      applyToEnv: false,
    });
    expect(env.DATABASE_URL).toBeUndefined();
  });

  it('builds the URL from the DB_* group when DATABASE_URL is absent', () => {
    write(
      '.env.legacy',
      'DB_HOST=h1\nDB_PORT=5433\nDB_USER=me\nDB_PASSWORD=p@ss\nDB_DATABASE=erp_legacy\n',
    );
    const r = resolveScriptEnv({ argv: ['.env.legacy'], cwd: dir, env: {} });
    expect(r.dbLabel).toBe('h1:5433/erp_legacy');
    expect(parseDatabaseUrl(r.databaseUrl).dbName).toBe('erp_legacy');
  });

  it('throws when no database configuration exists', () => {
    write('.env.empty', 'FOO=bar\n');
    expect(() =>
      resolveScriptEnv({ argv: ['.env.empty'], cwd: dir, env: {} }),
    ).toThrow(/Thiếu DATABASE_URL/);
  });

  describe('resolvePgSsl', () => {
    it('disables ssl for DB_SSL=false or sslmode=disable / ssl=false', () => {
      expect(resolvePgSsl({ DB_SSL: 'false', DATABASE_URL: 'x' })).toBe(false);
      expect(resolvePgSsl({ DATABASE_URL: 'x?sslmode=disable' })).toBe(false);
      expect(resolvePgSsl({ DATABASE_URL: 'x?ssl=false' })).toBe(false);
    });
    it('enables relaxed ssl otherwise', () => {
      expect(resolvePgSsl({ DATABASE_URL: 'postgresql://h/db' })).toEqual({
        rejectUnauthorized: false,
      });
    });
  });

  describe('write guard and description', () => {
    it('is dry-run by default', () => {
      const r = resolveScriptEnv({
        argv: ['.env.klotus-staging'],
        cwd: dir,
        env: {},
      });
      const g = getWriteGuard(r, []);
      expect(g).toMatchObject({ apply: false, allowed: false });
    });

    it('allows --apply on non-production', () => {
      const r = resolveScriptEnv({
        argv: ['.env.klotus-staging'],
        cwd: dir,
        env: {},
      });
      expect(getWriteGuard(r, ['--apply']).allowed).toBe(true);
    });

    it('requires --confirm=<db> on production', () => {
      const r = resolveScriptEnv({
        argv: ['.env.greenway-production'],
        cwd: dir,
        env: {},
      });
      expect(getWriteGuard(r, ['--apply']).allowed).toBe(false);
      expect(getWriteGuard(r, ['--apply', '--confirm=wrong']).allowed).toBe(
        false,
      );
      expect(
        getWriteGuard(r, ['--apply', '--confirm=erp_greenway_production'])
          .allowed,
      ).toBe(true);
    });

    describe('flag matrix', () => {
      const staging = () =>
        resolveScriptEnv({ argv: ['.env.klotus-staging'], cwd: dir, env: {} });
      const prod = () =>
        resolveScriptEnv({
          argv: ['.env.greenway-production'],
          cwd: dir,
          env: {},
        });

      it('treats --execute as an alias of --apply', () => {
        expect(getWriteGuard(staging(), ['--execute'], {}).allowed).toBe(true);
      });

      it('--dry-run wins over --apply and --execute', () => {
        expect(
          getWriteGuard(staging(), ['--apply', '--dry-run'], {}).allowed,
        ).toBe(false);
        expect(
          getWriteGuard(staging(), ['--execute', '--dry-run'], {}),
        ).toMatchObject({ apply: false, allowed: false });
      });

      it('DRY_RUN=true or 1 forces dry-run, other values do not', () => {
        expect(
          getWriteGuard(staging(), ['--apply'], { DRY_RUN: 'true' }).allowed,
        ).toBe(false);
        expect(
          getWriteGuard(staging(), ['--apply'], { DRY_RUN: '1' }).allowed,
        ).toBe(false);
        expect(
          getWriteGuard(staging(), ['--apply'], { DRY_RUN: 'false' }).allowed,
        ).toBe(true);
      });

      it('production still needs --confirm with the legacy alias', () => {
        expect(getWriteGuard(prod(), ['--execute'], {}).allowed).toBe(false);
        expect(
          getWriteGuard(
            prod(),
            ['--execute', '--confirm=erp_greenway_production'],
            {},
          ).allowed,
        ).toBe(true);
      });

      it('--dry-run beats a correct --confirm on production', () => {
        expect(
          getWriteGuard(
            prod(),
            ['--apply', '--dry-run', '--confirm=erp_greenway_production'],
            {},
          ).allowed,
        ).toBe(false);
      });
    });

    it('never prints credentials', () => {
      const r = resolveScriptEnv({
        argv: ['.env.klotus-staging'],
        cwd: dir,
        env: {},
      });
      const text = describeScriptEnv(r, getWriteGuard(r, []));
      expect(text).not.toContain('secret');
      expect(text).toContain('db-dev.liouni.com:5433/erp_klotus_staging');
    });
  });
});

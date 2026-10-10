import { Client } from 'pg';
import { DataSource, DataSourceOptions, QueryRunner } from 'typeorm';
import type { ScriptEnv, WriteGuard } from './load-script-env';

/**
 * Kết nối DB cho script với cơ chế "dry-run bằng rollback":
 * mọi câu lệnh chạy trong MỘT transaction; cuối cùng COMMIT nếu `guard.allowed`, ngược lại ROLLBACK.
 * Báo cáo số dòng ở dry-run vì vậy khớp với lần ghi thật.
 *
 * Giới hạn: không hoàn tác được tác dụng ngoài DB (R2, gọi API) và `nextval` của sequence.
 * Script đã tự quản BEGIN/COMMIT thì KHÔNG bọc thêm (transaction lồng sẽ commit sớm).
 */

export type SessionOutcome = 'COMMITTED' | 'ROLLED_BACK';

export interface PgSession {
  client: Client;
  /** COMMIT nếu `guard.allowed`, ngược lại ROLLBACK; luôn đóng kết nối. Gọi nhiều lần an toàn. */
  finish(): Promise<SessionOutcome>;
  /** ROLLBACK vô điều kiện (dùng khi lỗi); luôn đóng kết nối. */
  abort(): Promise<void>;
}

export interface ConnectPgOptions {
  /** Cho phép test thay client giả. */
  clientFactory?: (config: {
    connectionString: string;
    ssl: ScriptEnv['ssl'];
  }) => Client;
}

export async function connectPg(
  scriptEnv: ScriptEnv,
  guard: WriteGuard,
  options: ConnectPgOptions = {},
): Promise<PgSession> {
  const factory = options.clientFactory ?? ((cfg) => new Client(cfg));
  const client = factory({
    connectionString: scriptEnv.databaseUrl,
    ssl: scriptEnv.ssl,
  });
  await client.connect();
  try {
    await client.query('BEGIN');
  } catch (err) {
    await client.end().catch(() => undefined);
    throw err;
  }

  let outcome: SessionOutcome | null = null;
  const close = async (commit: boolean): Promise<SessionOutcome> => {
    if (outcome) return outcome;
    outcome = commit ? 'COMMITTED' : 'ROLLED_BACK';
    try {
      await client.query(commit ? 'COMMIT' : 'ROLLBACK');
    } finally {
      await client.end().catch(() => undefined);
    }
    return outcome;
  };

  return {
    client,
    finish: () => close(guard.allowed),
    abort: async () => {
      await close(false);
    },
  };
}

/**
 * Chạy `fn` trong một phiên: thành công ⇒ commit/rollback theo guard; ném lỗi ⇒ rollback rồi ném lại.
 */
export async function withPgSession<T>(
  scriptEnv: ScriptEnv,
  guard: WriteGuard,
  fn: (client: Client) => Promise<T>,
  options: ConnectPgOptions = {},
): Promise<{ result: T; outcome: SessionOutcome }> {
  const session = await connectPg(scriptEnv, guard, options);
  try {
    const result = await fn(session.client);
    const outcome = await session.finish();
    return { result, outcome };
  } catch (err) {
    await session.abort();
    throw err;
  }
}

/**
 * DataSource cho script TypeORM chỉ dùng `ds.query(...)`:
 * mọi `query()` đi qua một QueryRunner dùng chung đang mở transaction (xem `begin()`/`finish()`).
 * Repository/EntityManager KHÔNG đi qua runner này (script hiện tại không dùng).
 */
export class ScriptDataSource extends DataSource {
  private sharedRunner: QueryRunner | null = null;
  private outcome: SessionOutcome | null = null;

  constructor(
    private readonly guard: WriteGuard,
    options: DataSourceOptions,
  ) {
    super(options);
  }

  /** Khởi tạo kết nối và mở transaction dùng chung. */
  async begin(): Promise<this> {
    if (!this.isInitialized) await this.initialize();
    this.sharedRunner = this.createQueryRunner();
    await this.sharedRunner.connect();
    await this.sharedRunner.startTransaction();
    return this;
  }

  override query<T = any>(
    query: string,
    parameters?: any[],
    queryRunner?: QueryRunner,
  ): Promise<T> {
    return super.query<T>(
      query,
      parameters,
      queryRunner ?? this.sharedRunner ?? undefined,
    );
  }

  /** COMMIT nếu `guard.allowed`, ngược lại ROLLBACK. Gọi nhiều lần an toàn. */
  async finish(): Promise<SessionOutcome> {
    return this.endTransaction(this.guard.allowed);
  }

  /** Luôn rollback phần còn dở rồi đóng kết nối. */
  override async destroy(): Promise<void> {
    await this.endTransaction(false);
    if (this.isInitialized) await super.destroy();
  }

  private async endTransaction(commit: boolean): Promise<SessionOutcome> {
    if (this.outcome) return this.outcome;
    this.outcome = commit ? 'COMMITTED' : 'ROLLED_BACK';
    const runner = this.sharedRunner;
    this.sharedRunner = null;
    if (runner) {
      try {
        if (commit) await runner.commitTransaction();
        else await runner.rollbackTransaction();
      } finally {
        await runner.release();
      }
    }
    return this.outcome;
  }
}

export function createScriptDataSource(
  scriptEnv: ScriptEnv,
  guard: WriteGuard,
  overrides: Partial<DataSourceOptions> = {},
): ScriptDataSource {
  return new ScriptDataSource(guard, {
    type: 'postgres',
    url: scriptEnv.databaseUrl,
    ssl: scriptEnv.ssl,
    extra: scriptEnv.ssl ? { ssl: scriptEnv.ssl } : {},
    ...overrides,
  } as DataSourceOptions);
}

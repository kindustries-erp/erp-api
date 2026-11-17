import { DataSource, EntitySchema } from 'typeorm';

type EntityTarget = (new (...args: never[]) => unknown) | EntitySchema;

export interface SqlCapture {
  dataSource: DataSource;
  /** Mọi câu SQL TypeORM sinh ra, theo thứ tự chạy. */
  calls: Array<{ sql: string; params: unknown[] }>;
  /** Đặt dữ liệu trả về: hàm nhận SQL, trả mảng dòng thô. Mặc định trả mảng rỗng. */
  respond(fn: (sql: string, params: unknown[]) => unknown[]): void;
}

/**
 * DataSource Postgres KHÔNG kết nối DB: dựng metadata thật rồi thay query runner bằng bản ghi lại SQL.
 * Dùng trong spec để kiểm câu SQL thật do QueryBuilder sinh ra (phạm vi chi nhánh, join, sắp xếp)
 * thay vì mock từng hàm của QueryBuilder.
 */
export async function createSqlCapture(
  entities: EntityTarget[] = [],
): Promise<SqlCapture> {
  const dataSource = new DataSource({ type: 'postgres', entities });
  await (
    dataSource as unknown as { buildMetadatas(): Promise<void> }
  ).buildMetadatas();

  const calls: SqlCapture['calls'] = [];
  let responder: (sql: string, params: unknown[]) => unknown[] = () => [];
  const run = (sql: string, params: unknown[] = [], structured = false) => {
    calls.push({ sql, params });
    const records = responder(sql, params);
    return Promise.resolve(structured ? { records, raw: records } : records);
  };
  const runner = {
    connection: dataSource,
    manager: dataSource.manager,
    data: {},
    isReleased: false,
    isTransactionActive: false,
    connect: () => Promise.resolve(),
    release: () => Promise.resolve(),
    query: run,
  };
  Object.assign(dataSource, {
    createQueryRunner: () => runner,
    query: (sql: string, params?: unknown[]) => run(sql, params),
  });
  return {
    dataSource,
    calls,
    respond: (fn) => {
      responder = fn;
    },
  };
}

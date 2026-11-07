/**
 * swap-po-request-fk.ts — đổi FK của đơn mua garage sang lõi cashflow (bước cắt, KHÔNG phải migration).
 *
 *   erp_garage_proc_orders.request_id            -> erp_garage_proc_requests(id)        (cũ)
 *                                                -> cashflow_forecasts(id)              (mới, --apply)
 *   erp_garage_proc_order_lines.request_line_id  -> erp_garage_proc_request_lines(id)   (cũ)
 *                                                -> cashflow_forecast_lines(id)         (mới, --apply)
 *
 * Vì sao không phải migration: CI chạy migrate tự động khi merge lên production. Nếu production
 * chưa backfill thì kiểm tra mồ côi sẽ chặn cả đợt deploy. Script này chạy tay, có kiểm tra trước.
 *
 * Chế độ:
 *   (mặc định)                 chỉ đọc: in FK hiện tại, số tham chiếu mồ côi, và việc sẽ làm.
 *   --simulate                 chạy đổi FK trong transaction rồi ROLLBACK (kiểm tra, không ghi).
 *   --apply --confirm=<DB>     đổi FK, COMMIT. --confirm phải khớp đúng tên DB thực tế.
 *   thêm --rollback            đưa FK về bảng PR cũ (áp dụng cùng các chế độ trên).
 *
 * Idempotent: nếu FK đã trỏ đúng đích thì bỏ qua.
 *
 * Cách chạy (trong thư mục erp-api, env tường minh):
 *   TS_NODE_TRANSPILE_ONLY=true node -r ts-node/register -r tsconfig-paths/register src/v2/modules/cashflow-garage/scripts/swap-po-request-fk.ts --target=greenway-staging
 *   ... --target=greenway-staging --simulate
 *   ... --target=greenway-staging --apply --confirm=erp_greenway_staging
 */

import { Client } from 'pg';
import {
  describeScriptEnv,
  resolveScriptEnv,
  ScriptEnvError,
} from '../../../../common/scripts/load-script-env';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const SIMULATE = args.includes('--simulate');
const ROLLBACK = args.includes('--rollback');
const CONFIRM = args
  .find((a) => a.startsWith('--confirm='))
  ?.slice('--confirm='.length);

interface FkSpec {
  name: string;
  table: string;
  column: string;
  legacyTarget: string;
  legacyColumn: string;
  newTarget: string;
  newColumn: string;
}

const SPECS: FkSpec[] = [
  {
    name: 'FK_erp_garage_proc_orders_request',
    table: 'erp_garage_proc_orders',
    column: 'request_id',
    legacyTarget: 'erp_garage_proc_requests',
    legacyColumn: 'id',
    newTarget: 'cashflow_forecasts',
    newColumn: 'id',
  },
  {
    name: 'FK_erp_garage_proc_order_lines_request_line',
    table: 'erp_garage_proc_order_lines',
    column: 'request_line_id',
    legacyTarget: 'erp_garage_proc_request_lines',
    legacyColumn: 'id',
    newTarget: 'cashflow_forecast_lines',
    newColumn: 'id',
  },
];

type Direction = 'forward' | 'rollback';
type Client_ = Pick<Client, 'query'>;

/** Đích của FK theo chiều: forward -> cashflow, rollback -> bảng PR cũ. */
function targetOf(spec: FkSpec, direction: Direction) {
  return direction === 'forward'
    ? { table: spec.newTarget, column: spec.newColumn }
    : { table: spec.legacyTarget, column: spec.legacyColumn };
}

async function currentTarget(
  client: Client_,
  spec: FkSpec,
): Promise<string | null> {
  const { rows } = await client.query<{ def: string }>(
    `SELECT pg_get_constraintdef(c.oid) AS def
       FROM pg_constraint c
      WHERE c.conname = $1 AND c.conrelid = $2::regclass`,
    [spec.name, spec.table],
  );
  if (rows.length === 0) return null;
  const m = /REFERENCES\s+(\w+)\(/.exec(rows[0].def);
  return m ? m[1] : null;
}

/** Số tham chiếu không có đích tương ứng (phải bằng 0 trước khi đổi). */
async function orphanCount(
  client: Client_,
  spec: FkSpec,
  direction: Direction,
): Promise<number> {
  const t = targetOf(spec, direction);
  const { rows } = await client.query<{ n: number }>(
    `SELECT count(*)::int AS n
       FROM ${spec.table} x
      WHERE x.${spec.column} IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM ${t.table} t WHERE t.${t.column} = x.${spec.column})`,
  );
  return rows[0].n;
}

async function swap(
  client: Client,
  direction: Direction,
  commit: boolean,
): Promise<void> {
  console.log(
    `\nChiều: ${direction === 'forward' ? 'ĐỔI SANG LÕI MỚI' : 'QUAY VỀ BẢNG PR CŨ'}`,
  );

  // 1. Kiểm tra trước khi đụng FK.
  for (const spec of SPECS) {
    const t = targetOf(spec, direction);
    const current = await currentTarget(client, spec);
    const orphans = await orphanCount(client, spec, direction);
    console.log(
      `  ${spec.table}.${spec.column}: hiện tại -> ${current ?? '(không có FK)'}; ` +
        `đích mới ${t.table}(${t.column}); tham chiếu mồ côi = ${orphans}`,
    );
    if (orphans > 0) {
      throw new ScriptEnvError(
        `Dừng: ${spec.table}.${spec.column} còn ${orphans} tham chiếu không có đích ${t.table}. ` +
          `Chạy backfill trước (forward) hoặc kiểm tra PR chỉ tồn tại ở bảng mới (rollback).`,
      );
    }
  }

  await client.query('BEGIN');
  try {
    for (const spec of SPECS) {
      const t = targetOf(spec, direction);
      const current = await currentTarget(client, spec);
      if (current === t.table) {
        console.log(`  ${spec.name}: đã trỏ ${t.table}, bỏ qua`);
        continue;
      }
      // Tên FK trên DB viết hoa (TypeORM tạo có ngoặc kép): phải đặt trong ngoặc kép khi ALTER.
      await client.query(
        `ALTER TABLE ${spec.table} DROP CONSTRAINT IF EXISTS "${spec.name}"`,
      );
      await client.query(
        `ALTER TABLE ${spec.table}
           ADD CONSTRAINT "${spec.name}"
           FOREIGN KEY (${spec.column}) REFERENCES ${t.table}(${t.column})
           ON DELETE RESTRICT`,
      );
      console.log(`  ${spec.name}: đã đổi sang ${t.table}`);
    }

    // 2. Đối chiếu sau khi đổi: FK đúng đích và không còn mồ côi.
    for (const spec of SPECS) {
      const t = targetOf(spec, direction);
      const current = await currentTarget(client, spec);
      if (current !== t.table) {
        throw new Error(
          `Sau khi đổi, ${spec.name} trỏ ${current}, kỳ vọng ${t.table}`,
        );
      }
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }

  if (commit) {
    await client.query('COMMIT');
    console.log('\nĐã COMMIT.');
  } else {
    await client.query('ROLLBACK');
    console.log('\nMÔ PHỎNG: đã ROLLBACK, không ghi.');
  }
}

async function main(): Promise<void> {
  console.log(
    '================================================================',
  );
  console.log(
    APPLY
      ? 'ĐỔI FK PO GARAGE (GHI DB)'
      : 'KIỂM TRA FK PO GARAGE (đọc / mô phỏng)',
  );
  console.log(
    '================================================================',
  );

  const scriptEnv = resolveScriptEnv({ argv: args });
  console.log(
    describeScriptEnv(scriptEnv, { apply: APPLY, allowed: true, message: '' }),
  );
  if (!scriptEnv.explicit && scriptEnv.isProduction) {
    throw new ScriptEnvError(
      `Env mặc định đang trỏ DB production (${scriptEnv.dbLabel}). Hãy chỉ định env tường minh.`,
    );
  }

  const client = new Client({
    connectionString: scriptEnv.databaseUrl,
    ssl: scriptEnv.ssl,
  });
  await client.connect();

  try {
    const writing = APPLY || SIMULATE;
    await client.query(
      `SET default_transaction_read_only = ${writing ? 'off' : 'on'}`,
    );
    const { rows: dbRows } = await client.query<{ db: string }>(
      'SELECT current_database() AS db',
    );
    console.log(`Database thực tế: ${dbRows[0].db}`);

    if (APPLY && CONFIRM !== dbRows[0].db) {
      throw new ScriptEnvError(
        `--apply cần --confirm=${dbRows[0].db} (khớp đúng tên DB thực tế).`,
      );
    }

    const direction: Direction = ROLLBACK ? 'rollback' : 'forward';
    if (!writing) {
      console.log(`\nChế độ chỉ đọc. Chiều: ${direction}`);
      for (const spec of SPECS) {
        const t = targetOf(spec, direction);
        const current = await currentTarget(client, spec);
        const orphans = await orphanCount(client, spec, direction);
        console.log(
          `  ${spec.table}.${spec.column}: hiện tại -> ${current ?? '(không có FK)'}; ` +
            `đích ${t.table}; mồ côi = ${orphans}`,
        );
      }
      console.log(
        '\nChạy --simulate để thử đổi (ROLLBACK), --apply --confirm=<DB> để ghi.',
      );
      return;
    }

    await swap(client, direction, APPLY);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error('ERR', error instanceof Error ? error.message : String(error));
  process.exit(1);
});

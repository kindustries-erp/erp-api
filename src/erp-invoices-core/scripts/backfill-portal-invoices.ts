/**
 * backfill-portal-invoices.ts
 *
 * Đối soát CHỈ ĐỌC: hóa đơn trên Cổng Thuế GDT có chưa nằm trong DB hay không, theo tháng và chiều.
 * Quét các cửa sổ ngày như lượt đồng bộ, rồi kiểm tra từng hóa đơn theo khóa định danh
 * (chiều, số, ký hiệu, năm lập, MST đối tác, tổng tiền). Không ghi DB.
 *
 * Token: copy Bearer token từ phiên đăng nhập hoadondientu.gdt.gov.vn, truyền qua biến môi trường GDT_TOKEN.
 * Cookie WAF (nếu cần): GDT_COOKIES. Không lưu token vào repo.
 *
 * Env: theo loader chuẩn (src/common/scripts/load-script-env.ts). Bắt buộc chỉ định file tường minh.
 *   GDT_TOKEN=... bun src/erp-invoices-core/scripts/backfill-portal-invoices.ts \
 *     .env.greenway-production --from=2026-04-01 --to=2026-10-29
 */

import { Client } from 'pg';
import {
  describeScriptEnv,
  resolveScriptEnv,
  ScriptEnvError,
} from '../../common/scripts/load-script-env';
import { sleep } from '../../common/utils/delay.util';
import {
  fetchWithRetry,
  parseGdtJson,
  parsePortalIsoDate,
} from '../helpers/invoice-gdt.helper';
import {
  buildDateWindows,
  formatDateWindowLabel,
  GdtDateWindow,
  toGdtDate,
} from '../helpers/gdt-date-window.helper';

const GDT_API_BASE_URL = 'https://hoadondientu.gdt.gov.vn/api';
const PAGE_SIZE = 50;
const MAX_PAGES = 50;

/** Các endpoint giống lượt đồng bộ: mua vào (đủ ttxly 5, 6, 8) và bán ra (không lọc ttxly). */
const ENDPOINTS: {
  direction: 'IN' | 'OUT';
  path: string;
  ttxly: (number | null)[];
}[] = [
  { direction: 'IN', path: '/query/invoices/purchase', ttxly: [5, 6] },
  { direction: 'IN', path: '/sco-query/invoices/purchase', ttxly: [8] },
  { direction: 'OUT', path: '/query/invoices/sold', ttxly: [null] },
];

interface GdtRow {
  direction: 'IN' | 'OUT';
  windowLabel: string;
  raw: any;
}

function parseArgs(argv: string[]): { from: string; to: string } {
  const get = (name: string) =>
    argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
  const from = get('from');
  const to = get('to');
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!from || !to || !iso.test(from) || !iso.test(to)) {
    throw new ScriptEnvError('Thiếu --from=YYYY-MM-DD hoặc --to=YYYY-MM-DD.');
  }
  return { from, to };
}

/** Lấy toàn bộ hóa đơn của một cửa sổ, một endpoint, một ttxly (theo cursor `state`). */
async function fetchWindow(
  window: GdtDateWindow,
  endpoint: (typeof ENDPOINTS)[number],
  ttxly: number | null,
  headers: Record<string, string>,
  isFirstRequest: { value: boolean },
): Promise<{ rows: any[]; total: number }> {
  const rows: any[] = [];
  let total = 0;
  let state: string | null = null;
  let pages = 0;

  do {
    const url = new URL(`${GDT_API_BASE_URL}${endpoint.path}`);
    url.searchParams.set('sort', 'tdlap:desc');
    url.searchParams.set('size', String(PAGE_SIZE));
    let search = `tdlap=ge=${toGdtDate(window.from)}T00:00:00;tdlap=le=${toGdtDate(window.to)}T23:59:59`;
    if (ttxly !== null) search += `;ttxly==${ttxly}`;
    url.searchParams.set('search', search);
    if (state) url.searchParams.set('state', state);

    if (!isFirstRequest.value) {
      await sleep(Math.round((4 + Math.random() * 3) * 1000));
    }
    isFirstRequest.value = false;

    const res = await fetchWithRetry(url, { headers });
    if (!res.ok) {
      throw new Error(
        `HTTP ${res.status} ${endpoint.path} ttxly=${ttxly ?? '-'} ${formatDateWindowLabel(window)}`,
      );
    }
    const json: any = await parseGdtJson(res);
    if (pages === 0) total = json.total ?? 0;
    rows.push(...(json.datas ?? []));
    state = json.state ?? null;
    pages++;
  } while (state && pages < MAX_PAGES);

  if (state) {
    throw new Error(
      `Vượt ${MAX_PAGES * PAGE_SIZE} bản ghi ${endpoint.path} ${formatDateWindowLabel(window)}: giảm GDT_QUERY_WINDOW_DAYS`,
    );
  }
  return { rows, total };
}

/** Khóa định danh giống `buildInvoiceIdentityWhere`, dùng để kiểm tra một hóa đơn trên cổng có trong DB không. */
async function existsInDb(
  client: Client,
  direction: 'IN' | 'OUT',
  raw: any,
): Promise<boolean> {
  const counterparty =
    direction === 'IN' ? (raw.nbmst ?? null) : (raw.nmmst ?? raw.mst ?? null);
  const serial = raw.khhdon ?? null;
  const result = await client.query(
    `SELECT 1 FROM erp_invoices
      WHERE is_deleted = false
        AND direction = $1::text
        AND invoice_no = $2::text
        AND serial_no IS NOT DISTINCT FROM $3::text
        AND date_part('year', invoice_date) = $4::int
        AND (CASE WHEN $1::text = 'IN' THEN seller_tax_code ELSE buyer_tax_code END) IS NOT DISTINCT FROM $5::text
        AND total_amount = $6::numeric
      LIMIT 1`,
    [
      direction,
      String(raw.shdon ?? ''),
      serial,
      Number(parsePortalIsoDate(raw.tdlap).slice(0, 4)),
      counterparty,
      String(raw.tgtttbso ?? 0),
    ],
  );
  return (result.rowCount ?? 0) > 0;
}

async function run(): Promise<void> {
  const { from, to } = parseArgs(process.argv.slice(2));
  const scriptEnv = resolveScriptEnv({ argv: process.argv.slice(2) });
  if (!scriptEnv.explicit) {
    throw new ScriptEnvError(
      'Phải chỉ định file env tường minh (ví dụ .env.greenway-production). Không dùng .env trần.',
    );
  }

  const token = process.env.GDT_TOKEN?.trim();
  if (!token) {
    throw new ScriptEnvError(
      'Thiếu GDT_TOKEN: copy Bearer token từ phiên đăng nhập hoadondientu.gdt.gov.vn rồi chạy lại.',
    );
  }
  const cookies = process.env.GDT_COOKIES?.trim();
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (cookies) headers.Cookie = cookies;

  const windowDays = Number(scriptEnv.config.GDT_QUERY_WINDOW_DAYS ?? 10);
  const windows = buildDateWindows(from, to, windowDays);

  const client = new Client({
    connectionString: scriptEnv.databaseUrl,
    ssl: scriptEnv.ssl,
  });
  await client.connect();
  try {
    console.log(
      describeScriptEnv(scriptEnv, {
        apply: false,
        allowed: false,
        message: 'DRY-RUN: chỉ đọc, không ghi DB',
      }),
    );
    const current = await client.query<{ current_database: string }>(
      'SELECT current_database()',
    );
    console.log(`DB thực tế: ${current.rows[0].current_database}`);
    console.log(
      `Khoảng: ${from} → ${to}, ${windows.length} cửa sổ, ${windowDays} ngày/cửa sổ\n`,
    );

    const isFirst = { value: true };
    const gdtRows: GdtRow[] = [];
    const gdtTotals = new Map<string, number>();

    for (const window of windows) {
      for (const endpoint of ENDPOINTS) {
        for (const ttxly of endpoint.ttxly) {
          const { rows, total } = await fetchWindow(
            window,
            endpoint,
            ttxly,
            headers,
            isFirst,
          );
          const key = `${endpoint.direction}`;
          gdtTotals.set(key, (gdtTotals.get(key) ?? 0) + total);
          for (const raw of rows) {
            gdtRows.push({
              direction: endpoint.direction,
              windowLabel: formatDateWindowLabel(window),
              raw,
            });
          }
        }
      }
      console.log(
        `Đã quét ${formatDateWindowLabel(window)}: ${gdtRows.length} bản ghi tích lũy`,
      );
    }

    // Đối chiếu từng hóa đơn với DB, gom theo tháng và chiều.
    const summary = new Map<
      string,
      { gdt: number; inDb: number; missing: number }
    >();
    const missingSamples: Record<string, unknown>[] = [];

    for (const row of gdtRows) {
      const month = parsePortalIsoDate(row.raw.tdlap).slice(0, 7);
      const groupKey = `${month} ${row.direction}`;
      const entry = summary.get(groupKey) ?? { gdt: 0, inDb: 0, missing: 0 };
      entry.gdt++;

      if (await existsInDb(client, row.direction, row.raw)) {
        entry.inDb++;
      } else {
        entry.missing++;
        if (missingSamples.length < 30) {
          missingSamples.push({
            chiều: row.direction,
            ngày: parsePortalIsoDate(row.raw.tdlap),
            số: row.raw.shdon,
            ký_hiệu: row.raw.khhdon ?? '',
            đối_tác: row.direction === 'IN' ? row.raw.nbten : row.raw.nmten,
            tổng_tiền: row.raw.tgtttbso,
          });
        }
      }
      summary.set(groupKey, entry);
    }

    console.log('\nTổng hợp theo tháng và chiều:');
    console.table(
      [...summary.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => ({
          'tháng chiều': k,
          'trên cổng': v.gdt,
          'đã có trong DB': v.inDb,
          thiếu: v.missing,
        })),
    );
    const totalMissing = [...summary.values()].reduce(
      (s, v) => s + v.missing,
      0,
    );
    console.log(
      `Tổng số hóa đơn thiếu: ${totalMissing} (dry-run, chưa ghi gì)`,
    );
    if (missingSamples.length > 0) {
      console.log(`\nMẫu hóa đơn thiếu (tối đa 30):`);
      console.table(missingSamples);
    }
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  if (err instanceof ScriptEnvError) {
    console.error(`Lỗi cấu hình: ${err.message}`);
  } else {
    console.error(`Lỗi đối soát: ${(err as Error).message}`);
  }
  process.exit(1);
});

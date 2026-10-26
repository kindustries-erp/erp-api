/**
 * backfill-bank-partner-from-netoff.ts
 *
 * Gán Đối tượng (partner_id) cho dòng sao kê chưa có đối tượng, dựa trên hóa đơn đã cấn trừ.
 *
 * Quy tắc an toàn:
 * - Chỉ gán khi mọi hóa đơn cấn trừ của dòng có CÙNG một MST (bên mua với HĐ bán ra, bên bán với HĐ mua vào).
 * - Đối tác với MST đó phải đã tồn tại (chạy đồng bộ đối tác từ hóa đơn trước).
 * - Không gán cho dòng có hóa đơn khác MST, không MST (khách lẻ) hoặc chưa có đối tác.
 * - Chỉ ghi dòng đang partner_id IS NULL; không đụng description, note, phân loại.
 *
 * Env: theo loader chuẩn (src/common/scripts/load-script-env.ts), KHÔNG có file mặc định:
 *   <.env.xxx> (tham số vị trí) | --env=<file> | --target=<tenant>-<stage> | ENV_FILE | .env
 * Mặc định là DRY-RUN. Ghi DB cần --apply; DB production cần thêm --confirm=<tên DB>.
 *
 * Cách chạy (trong thư mục erp-api):
 *   bun src/bank-transactions-core/scripts/backfill-bank-partner-from-netoff.ts .env.greenway-production \
 *     [--from=YYYY-MM-DD --to=YYYY-MM-DD] [--report=<file.csv>] [--backup=<file.csv>]
 *   bun src/bank-transactions-core/scripts/backfill-bank-partner-from-netoff.ts .env.greenway-production \
 *     --apply --confirm=erp_greenway_production --backup=<file.csv>
 */

import { writeFileSync } from 'fs';
import { Client } from 'pg';
import {
  describeScriptEnv,
  getWriteGuard,
  resolveScriptEnv,
  ScriptEnvError,
} from '../../common/scripts/load-script-env';
import {
  buildInvoicePartnerSqlParts,
  KHONG_MST,
} from '../../common/utils/invoice-partner-key.util';

const args = process.argv.slice(2);
const argValue = (name: string): string | null => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(`--${name}=`.length) : null;
};

const reportPath = argValue('report');
const backupPath = argValue('backup');
const fromDate = argValue('from');
const toDate = argValue('to');
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const csvCell = (value: string | number | null | undefined): string => {
  const text = value === null || value === undefined ? '' : `${value}`;
  return `"${text.replace(/"/g, '""')}"`;
};

const OUT = buildInvoicePartnerSqlParts('OUT');
const IN = buildInvoicePartnerSqlParts('IN');

/** Mỗi dòng sao kê chưa có đối tượng: các MST của hóa đơn cấn trừ (đã loại KHONG_MST). */
const LINKED_TAXES_SQL = `
  SELECT o.bank_transaction_id::text AS "txnId",
         t.trans_date::text AS "transDate",
         ARRAY_AGG(DISTINCT CASE WHEN inv.direction = 'IN'
                                 THEN ${IN.taxCodeExpr}
                                 ELSE ${OUT.taxCodeExpr} END) AS taxes
  FROM erp_invoice_voucher_netoff o
  JOIN erp_invoices inv ON inv.id = o.invoice_id AND inv.is_deleted = false
  JOIN erp_bank_transactions t ON t.id = o.bank_transaction_id
  WHERE t.is_deleted = false
    AND t.partner_id IS NULL
    AND ($1::date IS NULL OR (t.trans_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date >= $1::date)
    AND ($2::date IS NULL OR (t.trans_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= $2::date)
  GROUP BY o.bank_transaction_id, t.trans_date
`;

interface Linked {
  txnId: string;
  transDate: string;
  taxes: string[];
}

interface Decision {
  txnId: string;
  transDate: string;
  partnerId: string | null;
  taxCode: string | null;
  reason: string;
}

async function main() {
  console.log(
    '================================================================',
  );
  console.log('BACKFILL ĐỐI TƯỢNG SAO KÊ TỪ HÓA ĐƠN CẤN TRỪ');
  console.log(
    '================================================================',
  );

  if (
    (fromDate && !DATE_PATTERN.test(fromDate)) ||
    (toDate && !DATE_PATTERN.test(toDate))
  ) {
    throw new ScriptEnvError('--from/--to phải có dạng YYYY-MM-DD.');
  }

  const scriptEnv = resolveScriptEnv({ argv: args });
  const guard = getWriteGuard(scriptEnv, args);
  console.log(describeScriptEnv(scriptEnv, guard));
  if (!scriptEnv.explicit && scriptEnv.isProduction) {
    throw new ScriptEnvError(
      `Env mặc định đang trỏ DB production (${scriptEnv.dbLabel}). Hãy chỉ định env tường minh.`,
    );
  }
  if (guard.apply && !guard.allowed) throw new ScriptEnvError(guard.message);

  const client = new Client({
    connectionString: scriptEnv.databaseUrl,
    ssl: scriptEnv.ssl,
  });
  await client.connect();

  try {
    const { rows: dbRows } = await client.query<{ db: string }>(
      'SELECT current_database() AS db',
    );
    console.log(`Database thực tế: ${dbRows[0].db}`);

    const { rows: linked } = await client.query<Linked>(LINKED_TAXES_SQL, [
      fromDate,
      toDate,
    ]);

    const decisions: Decision[] = [];
    for (const row of linked) {
      const taxes = row.taxes.filter((t) => t !== KHONG_MST && t !== null);
      const distinct = [...new Set(taxes)];
      if (distinct.length === 0) {
        decisions.push({
          txnId: row.txnId,
          transDate: row.transDate,
          partnerId: null,
          taxCode: null,
          reason: 'HĐ không có MST',
        });
        continue;
      }
      if (distinct.length > 1) {
        decisions.push({
          txnId: row.txnId,
          transDate: row.transDate,
          partnerId: null,
          taxCode: null,
          reason: 'HĐ khác MST',
        });
        continue;
      }
      const taxCode: string = distinct[0] as string;
      const { rows: partners } = await client.query<{ id: string }>(
        `SELECT id FROM erp_business_partners
         WHERE is_deleted = false AND tax_code = $1 LIMIT 1`,
        [taxCode],
      );
      decisions.push({
        txnId: row.txnId,
        transDate: row.transDate,
        partnerId: partners[0]?.id ?? null,
        taxCode,
        reason: partners[0] ? 'SE_GAN' : 'CHUA_CO_DOI_TAC',
      });
    }

    const toAssign = decisions.filter((d) => d.partnerId !== null);
    const count = (reason: string) =>
      decisions.filter((d) => d.reason === reason).length;

    console.log(
      `Dòng sao kê chưa có đối tượng nhưng đã cấn trừ: ${linked.length}`,
    );
    console.log(`Sẽ gán: ${toAssign.length}`);
    console.log(`HĐ khác MST (bỏ qua): ${count('HĐ khác MST')}`);
    console.log(
      `HĐ không có MST / khách lẻ (bỏ qua): ${count('HĐ không có MST')}`,
    );
    console.log(
      `MST chưa có đối tác (chạy đồng bộ trước): ${count('CHUA_CO_DOI_TAC')}`,
    );

    if (reportPath) {
      const header = [
        'txn_id',
        'trans_date',
        'tax_code',
        'partner_id',
        'reason',
      ];
      const lines = decisions.map((d) =>
        [d.txnId, d.transDate, d.taxCode, d.partnerId, d.reason]
          .map(csvCell)
          .join(','),
      );
      writeFileSync(
        reportPath,
        [header.join(','), ...lines].join('\n'),
        'utf8',
      );
      console.log(`Báo cáo CSV: ${reportPath}`);
    }

    if (backupPath) {
      const header = ['txn_id', 'old_partner_id'];
      const lines = toAssign.map((d) => [d.txnId, null].map(csvCell).join(','));
      writeFileSync(
        backupPath,
        [header.join(','), ...lines].join('\n'),
        'utf8',
      );
      console.log(
        `Sao lưu (${toAssign.length} dòng, trạng thái cũ là chưa có đối tượng): ${backupPath}`,
      );
    }

    if (!guard.apply) {
      console.log('DRY-RUN: không ghi DB.');
      return;
    }

    await client.query('BEGIN');
    let updated = 0;
    for (const d of toAssign) {
      const res = await client.query(
        `UPDATE erp_bank_transactions
            SET partner_id = $2, updated_at = NOW()
          WHERE id = $1 AND partner_id IS NULL`,
        [d.txnId, d.partnerId],
      );
      updated += res.rowCount ?? 0;
    }
    await client.query('COMMIT');
    console.log(`ĐÃ GHI: ${updated} dòng (transaction đã commit).`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

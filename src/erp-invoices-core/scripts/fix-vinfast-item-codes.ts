/**
 * fix-vinfast-item-codes.ts
 *
 * Sửa lại mã hàng hóa/dịch vụ (item_code) của dòng hóa đơn đã gán sai bằng quy tắc VinFast
 * không xét chiều hóa đơn, đơn vị tính và người bán. Chỉ dùng luật (không gọi AI).
 *
 * Chọn các dòng có item_code bắt đầu bằng "VF-", tính lại mã bằng extractStandardItemCode với đầy đủ
 * ngữ cảnh (chiều, đơn vị, người bán) và không giữ mã cũ. Chỉ đổi khi kết quả khác mã cũ và không phải FALLBACK.
 *
 * Env: theo loader chuẩn (src/common/scripts/load-script-env.ts), phải chỉ định tường minh.
 * Mặc định là DRY-RUN. Ghi DB cần --apply (DB production cần thêm --confirm=<tên DB>).
 *
 * Cách chạy (trong thư mục erp-api):
 *   bun src/erp-invoices-core/scripts/fix-vinfast-item-codes.ts --target=greenway-production
 *   bun src/erp-invoices-core/scripts/fix-vinfast-item-codes.ts --target=greenway-production --apply --confirm=<tên DB> --expect=<số dòng dry-run>
 */

import { Client } from 'pg';
import {
  describeScriptEnv,
  getWriteGuard,
  resolveScriptEnv,
  ScriptEnvError,
} from '../../common/scripts/load-script-env';
import { extractStandardItemCode } from '../helpers/vinfast-part-code.helper';

const args = process.argv.slice(2);
const expectArg = args.find((a) => a.startsWith('--expect='));
const expectCount = expectArg ? parseInt(expectArg.split('=')[1], 10) : null;

interface VfLineRow {
  id: string;
  direction: string;
  description: string | null;
  unit: string | null;
  item_code: string;
  pre_vat_amount: string | null;
  discount_amount: string | null;
  seller_name: string | null;
  seller_tax_code: string | null;
}

interface Change {
  id: string;
  oldCode: string;
  newCode: string;
  direction: string;
  unit: string;
  description: string;
}

async function main() {
  console.log(
    '================================================================',
  );
  console.log('🔧 FIX VINFAST ITEM CODES (rule-based, không AI)');
  console.log(
    '================================================================',
  );
  const scriptEnv = resolveScriptEnv({ argv: args });
  const guard = getWriteGuard(scriptEnv, args);
  console.log(describeScriptEnv(scriptEnv, guard));
  if (!scriptEnv.explicit) {
    throw new ScriptEnvError(
      'Hãy chỉ định env tường minh (vd --target=greenway-production hoặc .env.xxx).',
    );
  }
  if (guard.apply && !guard.allowed) throw new ScriptEnvError(guard.message);

  const client = new Client({
    connectionString: scriptEnv.databaseUrl,
    ssl: scriptEnv.ssl,
  });
  await client.connect();

  try {
    const { rows } = await client.query<{ current_database: string }>(
      'SELECT current_database()',
    );
    console.log(`DB thực tế: ${rows[0].current_database}`);

    const lines = await client.query<VfLineRow>(`
      SELECT ii.id, inv.direction, ii.description, ii.unit, ii.item_code,
             ii.pre_vat_amount, ii.discount_amount,
             inv.seller_name, inv.seller_tax_code
      FROM erp_invoice_items ii
      JOIN erp_invoices inv ON inv.id = ii.invoice_id
      WHERE inv.is_deleted = false AND ii.item_code LIKE 'VF-%'
    `);

    const changes: Change[] = [];
    for (const r of lines.rows) {
      const result = extractStandardItemCode({
        description: r.description,
        unit: r.unit,
        direction: r.direction,
        sellerName: r.seller_name,
        sellerTaxCode: r.seller_tax_code,
        preVatAmount: r.pre_vat_amount ? Number(r.pre_vat_amount) : 0,
        discountAmount: r.discount_amount ? Number(r.discount_amount) : 0,
      });
      if (result.source === 'FALLBACK' || !result.itemCode) continue;
      if (result.itemCode === r.item_code) continue;
      changes.push({
        id: r.id,
        oldCode: r.item_code,
        newCode: result.itemCode,
        direction: r.direction,
        unit: r.unit ?? '',
        description: (r.description ?? '').slice(0, 70),
      });
    }

    // Gom theo loại mã (VF-số, VF-chữ, DV-, CK-...) để thấy toàn bộ nhóm đổi
    const kind = (code: string) =>
      /^VF-\d+$/.test(code) ? 'VF-<số>' : code.replace(/-.*$/, '-*');
    const groups = new Map<string, number>();
    for (const c of changes) {
      const key = `${c.direction} | ${kind(c.oldCode)} -> ${kind(c.newCode)}`;
      groups.set(key, (groups.get(key) ?? 0) + 1);
    }
    console.log(`\nDòng VF- được xét: ${lines.rows.length}`);
    console.log(`Dòng cần đổi mã: ${changes.length}`);
    console.log(
      '\nNhóm đổi mã theo loại (chiều | loại cũ -> loại mới : số dòng):',
    );
    [...groups.entries()]
      .sort((a, b) => b[1] - a[1])
      .forEach(([k, n]) => console.log(`  ${k} : ${n}`));
    const others = changes.filter(
      (c) =>
        !(
          c.direction === 'OUT' &&
          kind(c.oldCode) === 'VF-<số>' &&
          kind(c.newCode) === 'DV-*'
        ),
    );
    console.log(
      `\nDòng ngoài nhóm công lao động (${others.length}) - cần xem trước:`,
    );
    others.forEach((c) =>
      console.log(
        `  [${c.direction}] ${c.oldCode} -> ${c.newCode} | ${c.unit} | ${c.description}`,
      ),
    );
    console.log('\nMẫu (tối đa 10 dòng):');
    changes
      .slice(0, 10)
      .forEach((c) =>
        console.log(
          `  [${c.direction}] ${c.oldCode} -> ${c.newCode} | ${c.unit} | ${c.description}`,
        ),
      );

    if (!guard.apply) {
      console.log(
        '\nDRY-RUN: chưa ghi DB. Chạy lại với --apply (và --confirm=<tên DB>, --expect=<số dòng>).',
      );
      return;
    }
    if (expectCount !== null && expectCount !== changes.length) {
      throw new ScriptEnvError(
        `Số dòng cần đổi (${changes.length}) khác --expect (${expectCount}). Dừng, chưa ghi gì.`,
      );
    }

    await client.query('BEGIN');
    try {
      for (const c of changes) {
        await client.query(
          'UPDATE erp_invoice_items SET item_code = $1, updated_at = NOW() WHERE id = $2',
          [c.newCode, c.id],
        );
      }
      await client.query('COMMIT');
      console.log(`\nĐÃ GHI ${changes.length} dòng (1 transaction).`);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  if (err instanceof ScriptEnvError) {
    console.error(`\n❌ ${err.message}`);
  } else {
    console.error(err);
  }
  process.exit(1);
});

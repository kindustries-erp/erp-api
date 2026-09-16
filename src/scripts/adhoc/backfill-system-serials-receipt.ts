import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env', override: true });
import { Client } from 'pg';
import { format } from 'date-fns';

async function main() {
  const receiptNo = process.argv[2] || 'NK-20260914-001';
  const connectionString = process.env.DATABASE_URL;

  console.log(
    `Bắt đầu kiểm tra và backfill System Serials cho phiếu: ${receiptNo}`,
  );
  const client = new Client({
    connectionString,
    ssl:
      process.env.DB_SSL === 'false' ||
      connectionString?.includes('sslmode=disable')
        ? false
        : { rejectUnauthorized: false },
  });
  await client.connect();

  const receiptRes = await client.query(
    `SELECT id, receipt_no, status, receipt_date, created_at FROM erp_goods_receipts WHERE receipt_no = $1 AND is_deleted = false`,
    [receiptNo],
  );

  if (receiptRes.rows.length === 0) {
    console.error(`Không tìm thấy phiếu ${receiptNo}`);
    await client.end();
    return;
  }

  const receipt = receiptRes.rows[0];
  console.log(
    `Tìm thấy phiếu: ${receipt.receipt_no} (ID: ${receipt.id}, Trạng thái: ${receipt.status})`,
  );

  const linesRes = await client.query(
    `
    SELECT l.id as line_id, l.line_no, l.item_id, l.qty_received, l.unit_cost, l.declared_serials,
           i.sku, i.item_name
    FROM erp_goods_receipt_lines l
    JOIN erp_inventory_items i ON i.id = l.item_id
    WHERE l.goods_receipt_id = $1
    ORDER BY l.line_no ASC
  `,
    [receipt.id],
  );

  console.log(`Tổng số dòng hàng: ${linesRes.rows.length}`);

  let totalInserted = 0;
  const dateObj = receipt.receipt_date
    ? new Date(receipt.receipt_date)
    : new Date();
  const dateStr = format(dateObj, 'yyMMdd');

  for (const line of linesRes.rows) {
    const qty = Math.max(0, Math.round(Number(line.qty_received || 0)));
    if (qty <= 0) continue;

    // Check existing serials for this line
    const existingRes = await client.query(
      `SELECT COUNT(*) as count FROM erp_inventory_tracking_serials WHERE receipt_line_id = $1`,
      [line.line_id],
    );
    const existingCount = Number(existingRes.rows[0]?.count || 0);

    if (existingCount >= qty) {
      console.log(
        `Dòng #${line.line_no} [${line.sku}]: Đã có đủ ${existingCount} serials -> Bỏ qua.`,
      );
      continue;
    }

    const cleanSku = (line.sku || 'ITEM').replace(/[^a-zA-Z0-9_-]/g, '');
    const prefix = `SYS-${cleanSku}-${dateStr}-`;

    // Find highest sequence for this prefix
    const seqRes = await client.query(
      `SELECT system_serial_no FROM erp_inventory_tracking_serials WHERE system_serial_no LIKE $1 ORDER BY system_serial_no DESC LIMIT 1`,
      [`${prefix}%`],
    );

    let lastSeq = 0;
    if (seqRes.rows.length > 0 && seqRes.rows[0].system_serial_no) {
      const suffix = seqRes.rows[0].system_serial_no.slice(prefix.length);
      const parsed = parseInt(suffix, 10);
      if (!isNaN(parsed)) lastSeq = parsed;
    }

    const remainingQty = qty - existingCount;
    const batchRows: any[] = [];

    for (let i = 1; i <= remainingQty; i++) {
      const systemSerialNo = `${prefix}${String(lastSeq + i).padStart(6, '0')}`;
      batchRows.push([
        line.item_id,
        systemSerialNo, // serial_no
        systemSerialNo, // system_serial_no
        'SYSTEM_AUTO', // tracking_type
        'IN_STOCK', // status
        line.line_id, // receipt_line_id
        receipt.id, // source_document_id
        'GOODS_RECEIPT', // source_document_type
        line.unit_cost !== null && line.unit_cost !== undefined
          ? String(line.unit_cost)
          : null,
      ]);
    }

    // Insert in chunks of 1000
    const chunkSize = 1000;
    for (let j = 0; j < batchRows.length; j += chunkSize) {
      const chunk = batchRows.slice(j, j + chunkSize);
      const valuePlaceholders: string[] = [];
      const flatValues: any[] = [];
      let pIdx = 1;

      chunk.forEach((row) => {
        valuePlaceholders.push(
          `($${pIdx}, $${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4}, $${pIdx + 5}, $${pIdx + 6}, $${pIdx + 7}, $${pIdx + 8})`,
        );
        flatValues.push(...row);
        pIdx += 9;
      });

      await client.query(
        `
        INSERT INTO erp_inventory_tracking_serials 
        (item_id, serial_no, system_serial_no, tracking_type, status, receipt_line_id, source_document_id, source_document_type, unit_cost)
        VALUES ${valuePlaceholders.join(', ')}
      `,
        flatValues,
      );
    }

    // Mark line as serials_generated
    await client.query(
      `UPDATE erp_goods_receipt_lines SET serials_generated = true WHERE id = $1`,
      [line.line_id],
    );

    totalInserted += remainingQty;
    console.log(
      `Dòng #${line.line_no} [${line.sku} - ${line.item_name}]: Đã sinh ${remainingQty} System Serials [${prefix}${String(lastSeq + 1).padStart(6, '0')} → ${prefix}${String(lastSeq + remainingQty).padStart(6, '0')}]`,
    );
  }

  console.log(
    `\n🎉 HOÀN TẤT! Đã sinh tổng cộng ${totalInserted} System Serials cho phiếu ${receiptNo}.`,
  );
  await client.end();
}

main().catch(console.error);

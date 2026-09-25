#!/usr/bin/env bun
/**
 * CLI Script: Backfill License Plates for Invoices using AI (TOON Format)
 *
 * Usage:
 *   bun run scripts/backfill-invoice-license-plates.ts [env-file] [--dry-run] [--branch=PQ] [--force]
 *
 * Examples:
 *   bun run scripts/backfill-invoice-license-plates.ts .env.greenway-staging --dry-run
 *   bun run scripts/backfill-invoice-license-plates.ts .env.greenway-staging --branch=PQ
 *   bun run scripts/backfill-invoice-license-plates.ts .env.greenway-staging --all
 */

import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { NineRouterClient } from '../src/ai-hub-core/clients/nine-router.client';
import { InvoiceAiHandler } from '../src/ai-hub-core/handlers/invoice-ai.handler';
import { ConfigService } from '@nestjs/config';

// 1. Parse Arguments
const args = process.argv.slice(2);
let envFileName = '.env';
let isDryRun = false;
let branchFilter: string | null = null;
let isForce = false;

for (const arg of args) {
  if (arg === '--dry-run') {
    isDryRun = true;
  } else if (arg.startsWith('--branch=')) {
    branchFilter = arg.split('=')[1].toUpperCase();
  } else if (arg === '--force') {
    isForce = true;
  } else if (!arg.startsWith('--')) {
    envFileName = arg;
  }
}

// 2. Load Environment Config
const envPath = path.isAbsolute(envFileName)
  ? envFileName
  : path.resolve(process.cwd(), envFileName);

if (!fs.existsSync(envPath)) {
  console.error(`❌ Không tìm thấy file môi trường: ${envPath}`);
  process.exit(1);
}

const envConfig = dotenv.parse(fs.readFileSync(envPath));
const connectionString = envConfig.DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Thiếu biến DATABASE_URL trong file môi trường.');
  process.exit(1);
}

const mockConfigService = {
  get: (key: string) => envConfig[key] || process.env[key] || null,
} as unknown as ConfigService;

const nineClient = new NineRouterClient(mockConfigService);
const invoiceAiHandler = new InvoiceAiHandler(nineClient);

async function main() {
  console.log('========================================================================================');
  console.log(`🚀 CLI TOOL: BACKFILL BIỂN SỐ XE HÓA ĐƠN BẰNG AI (TOON FORMAT)`);
  console.log(`- Môi trường: ${envFileName}`);
  console.log(`- Chế độ: ${isDryRun ? 'DRY-RUN (Chỉ xem trước, không ghi DB)' : 'LIVE (Cập nhật DB)'}`);
  console.log(`- Chi nhánh lọc: ${branchFilter || 'TẤT CẢ'}`);
  console.log(`- Điều kiện: ${isForce ? 'Cập nhật lại toàn bộ' : 'Chỉ các HĐ chưa có biển số (NULL)'}`);
  console.log('========================================================================================\n');

  const client = new Client({ connectionString, ssl: false });
  await client.connect();

  let query = `
    SELECT 
      inv.id,
      inv.invoice_no,
      inv.serial_no,
      inv.invoice_date,
      inv.buyer_name,
      inv.description,
      inv.notes,
      inv.license_plate,
      b.code as branch_code,
      b.name as branch_name
    FROM erp_invoices inv
    LEFT JOIN erp_branches b ON b.id = inv.branch_id
    WHERE inv.direction = 'OUT' AND inv.is_deleted = false
  `;

  const queryParams: any[] = [];
  if (!isForce) {
    query += ` AND inv.license_plate IS NULL`;
  }
  if (branchFilter) {
    queryParams.push(branchFilter);
    query += ` AND b.code = $${queryParams.length}`;
  }

  query += ` ORDER BY inv.invoice_date DESC, inv.invoice_no DESC;`;

  const invoicesRes = await client.query(query, queryParams);
  const total = invoicesRes.rows.length;

  console.log(`🔍 Tìm thấy ${total} hóa đơn cần xử lý.\n`);

  if (total === 0) {
    console.log('✅ Tất cả hóa đơn đã có biển số xe đầy đủ. Không có việc cần làm.');
    await client.end();
    return;
  }

  // Load line items for all target invoices in 1 batch
  const invoiceIds = invoicesRes.rows.map((r) => r.id);
  const itemsRes = await client.query(
    `
    SELECT invoice_id, description, quantity, total_amount
    FROM erp_invoice_items
    WHERE invoice_id = ANY($1::uuid[])
    ORDER BY id ASC;
  `,
    [invoiceIds],
  );

  const itemsMap = new Map<string, any[]>();
  for (const row of itemsRes.rows) {
    if (!itemsMap.has(row.invoice_id)) itemsMap.set(row.invoice_id, []);
    itemsMap.get(row.invoice_id)!.push({
      description: row.description,
      quantity: Number(row.quantity),
      totalAmount: Number(row.total_amount),
    });
  }

  let successCount = 0;
  let emptyCount = 0;
  let errorCount = 0;
  const resultsTable: any[] = [];

  // Process in concurrent chunks of 5
  const chunkSize = 5;
  for (let i = 0; i < total; i += chunkSize) {
    const chunk = invoicesRes.rows.slice(i, i + chunkSize);

    await Promise.all(
      chunk.map(async (inv) => {
        try {
          const items = itemsMap.get(inv.id) || [];
          const aiResult = await invoiceAiHandler.extractLicensePlate({
            invoiceNo: inv.invoice_no,
            serialNo: inv.serial_no,
            invoiceDate: inv.invoice_date
              ? inv.invoice_date.toISOString().split('T')[0]
              : undefined,
            buyerName: inv.buyer_name,
            description: inv.description,
            notes: inv.notes,
            items,
          });

          const plateToSave = aiResult.formattedPlate || aiResult.licensePlate;

          if (plateToSave) {
            successCount++;
            if (!isDryRun) {
              await client.query(
                `UPDATE erp_invoices SET license_plate = $1, updated_at = now() WHERE id = $2`,
                [plateToSave, inv.id],
              );
            }
          } else {
            emptyCount++;
          }

          resultsTable.push({
            'Số HĐ': `${inv.invoice_no} (${inv.serial_no})`,
            'Ngày': inv.invoice_date
              ? inv.invoice_date.toISOString().split('T')[0]
              : 'N/A',
            'Chi nhánh': inv.branch_code || 'N/A',
            'Diễn giải':
              (inv.description || '').slice(0, 35) +
              (inv.description?.length > 35 ? '...' : ''),
            'Biển Số AI': plateToSave || '(Không có)',
            'Độ Tin Cậy': `${(aiResult.confidence * 100).toFixed(0)}%`,
            'Ghi DB': isDryRun ? 'Dry-run (Bỏ qua)' : (plateToSave ? '✅ Đã lưu' : '—'),
          });
        } catch (err: any) {
          errorCount++;
          console.error(`❌ Lỗi HĐ ${inv.invoice_no}: ${err.message}`);
        }
      }),
    );
  }

  console.table(resultsTable);

  console.log('\n========================================================================================');
  console.log('📊 TỔNG KẾT TIẾN TRÌNH:');
  console.log(`- Tổng số hóa đơn quét:            ${total}`);
  console.log(`- Trích xuất thành công biển số:    ${successCount} HĐ (${((successCount / total) * 100).toFixed(1)}%)`);
  console.log(`- Không tìm thấy biển số trong text: ${emptyCount} HĐ`);
  console.log(`- Lỗi xử lý:                        ${errorCount} HĐ`);
  console.log(`- Trạng thái DB:                   ${isDryRun ? 'DRY-RUN (Chưa ghi vào DB)' : 'ĐÃ CẬP NHẬT VÀO DB THÀNH CÔNG'}`);
  console.log('========================================================================================\n');

  await client.end();
}

main().catch((err) => {
  console.error('Fatal script error:', err);
  process.exit(1);
});

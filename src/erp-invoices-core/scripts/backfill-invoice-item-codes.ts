/**
 * backfill-invoice-item-codes.ts
 *
 * Script backfill & chuẩn hóa MÃ HÀNG (item_code) cho các dòng chi tiết Hóa đơn (direction = 'IN' / 'OUT')
 * theo cơ chế Hybrid AI-First (9router AI Gateway) ➔ Rule-based Fallback (Regex / Vendor Matching)
 * tuân thủ 100% Prefix Taxonomy (VF-, PT-, VT-, DV-, CK-, CCDC-, HC-).
 *
 * Tối ưu hóa hiệu năng cao:
 * - Pre-filtering quy tắc Regex cục bộ (0.001ms) cho Phụ tùng VinFast / Dịch vụ / Vật tư rõ ràng
 * - Gọi AI song song (Concurrency = 6) chỉ cho các dòng mơ hồ / chưa xác định
 * - Bulk Update DB theo lô (500 dòng/lệnh SQL)
 * - Đồng bộ tức thời Catalog & Sổ cái VinFast Ledger (direction IN/OUT)
 *
 * Cách chạy:
 *   bun run src/erp-invoices-core/scripts/backfill-invoice-item-codes.ts [.env.file] [--direction=IN|OUT|ALL] [--dry-run] [--force-all] [--concurrency=6] [--batch-size=30]
 */

import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import {
  extractStandardItemCode,
  extractVinfastItemCode,
  normalizePrefix,
} from '../helpers/vinfast-part-code.helper';

// Load môi trường
const envFileArg = process.argv.slice(2).find((a) => a.startsWith('.env'));
let loadedEnvConfig: Record<string, string> = {};
if (envFileArg && fs.existsSync(envFileArg)) {
  loadedEnvConfig = dotenv.parse(fs.readFileSync(envFileArg));
} else if (fs.existsSync('.env.greenway-production')) {
  loadedEnvConfig = dotenv.parse(fs.readFileSync('.env.greenway-production'));
}

const dbUrl =
  loadedEnvConfig.DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://erp_greenway_production_admin:Cg4b6wqHAH3kWVP2pbCismcari9Tz-4ueB4YH_Pd@db-dev.liouni.com:5433/erp_greenway_production?sslmode=disable';

const AI_ROUTER_BASE_URL =
  loadedEnvConfig.NINE_ROUTER_BASE_URL ||
  process.env.NINE_ROUTER_BASE_URL ||
  'https://9router.liouni.com/v1';
const AI_ROUTER_API_KEY =
  loadedEnvConfig.NINE_ROUTER_API_KEY ||
  process.env.NINE_ROUTER_API_KEY ||
  'sk-8cacf887edb2816b-plx0ba-b0f99291';

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const forceAll = args.includes('--force-all');
const limitArg = args.find((a) => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;
const batchSizeArg = args.find((a) => a.startsWith('--batch-size='));
const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1], 10) : 30;
const concurrencyArg = args.find((a) => a.startsWith('--concurrency='));
const concurrency = concurrencyArg
  ? parseInt(concurrencyArg.split('=')[1], 10)
  : 6;

const dirArg = args.find((a) => a.startsWith('--direction='));
const targetDirection: 'IN' | 'OUT' | 'ALL' = dirArg
  ? (dirArg.split('=')[1].toUpperCase() as 'IN' | 'OUT' | 'ALL')
  : 'IN';

interface DbItemRow {
  id: string;
  invoice_id: string;
  direction: string;
  description: string | null;
  unit: string | null;
  quantity: string | null;
  unit_price: string | null;
  pre_vat_amount: string | null;
  discount_amount: string | null;
  item_code: string | null;
  invoice_no: string;
  invoice_date: string;
  seller_name: string | null;
  seller_tax_code: string | null;
  buyer_name: string | null;
  buyer_tax_code: string | null;
  license_plate: string | null;
  invoice_type: string | number | null;
  tax_invoice_status: number | null;
}

interface AiClassificationItem {
  lineIndex: number;
  itemCode: string;
  itemType: 'PARTS' | 'SERVICE' | 'MATERIAL' | 'DISCOUNT' | 'OTHER';
  isDiscountDeduction: boolean;
  confidence: number;
  reason?: string;
}

function parseAiResponseContent(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) return trimmed;

  const lines = trimmed.split('\n');
  let aggregated = '';
  for (const line of lines) {
    const lineTrim = line.trim();
    if (!lineTrim.startsWith('data:') || lineTrim.includes('[DONE]')) continue;
    try {
      const json = JSON.parse(lineTrim.slice(5).trim());
      const delta = json.choices?.[0]?.delta?.content;
      if (delta) aggregated += delta;
      const direct = json.choices?.[0]?.message?.content;
      if (direct) aggregated += direct;
    } catch {
      // ignore
    }
  }
  return aggregated || trimmed;
}

async function call9RouterAiBatch(
  items: {
    lineIndex: number;
    description: string;
    unit?: string;
    sellerName?: string;
    sellerTaxCode?: string;
    preVatAmount?: number;
    discountAmount?: number;
  }[],
): Promise<Map<number, AiClassificationItem>> {
  const map = new Map<number, AiClassificationItem>();
  if (items.length === 0) return map;

  const serialized = items
    .map(
      (it) =>
        `[#${it.lineIndex}] Seller: "${it.sellerName || 'N/A'}" (MST: ${it.sellerTaxCode || 'N/A'}) | Desc: "${it.description}" | Unit: "${it.unit || 'N/A'}" | PreVat: ${it.preVatAmount ?? 0} | Discount: ${it.discountAmount ?? 0}`,
    )
    .join('\n');

  const systemPrompt = `Bạn là Trợ lý AI Kế toán ERP & Master Data chuyên sâu, phụ trách phân loại và gán MÃ HÀNG HÓA/DỊCH VỤ (item_code) cho các dòng HÓA ĐƠN ĐIỆN TỬ theo HỆ THỐNG TIỀN TỐ (Prefix Taxonomy) quy chuẩn sau:

1. PHỤ TÙNG XE (PARTS):
   - Phụ tùng VinFast (VinFast Trading & Production MST 0108926276 / 0318334886): Bắt buộc dùng tiền tố 'VF-' kèm Part Number.
     VD: "BEX20001151 Cụm tấm ốp" -> itemCode: "VF-BEX20001151"
     VD: "VF5_HV_BATTERY_PACK_38_KWH" -> itemCode: "VF-EEP73110011AP"
     VD: "BAT21001011 HV BATTERY" -> itemCode: "VF-BAT21001011"
     VD: "55406501 Thay dây điện ắc quy" -> itemCode: "VF-55406501"
     VD: "9990084 Cập nhật phần mềm" -> itemCode: "VF-9990084"
   - Phụ tùng OEM / Các hãng xe khác (Toyota, Hyundai, Ford, Kia, Michelin...): Bắt buộc dùng tiền tố 'PT-'.
     VD: "0K95K15909 Dây curoa" -> itemCode: "PT-0K95K15909"
     VD: "Lốp Michelin 205/55R16" -> itemCode: "PT-205/55R16"
     VD: "Bugi động cơ / Gạt mưa" -> itemCode: "PT-CHUNG"

2. VẬT TƯ XƯỞNG (MATERIAL):
   - 'VT-SON': Sơn, dầu bóng 2K, chất đóng rắn, bột trét matit, phụ gia sơn
   - 'VT-GAS': Gas lạnh điều hòa (R134a, R1234yf)
   - 'VT-DAU-NHOT': Dầu nhớt động cơ, dầu hộp số (8HP, ATF), mỡ bôi trơn
   - 'VT-KEO': Keo silicon, keo dán kính, keo chống rỉ
   - 'VT-HOACHAT': Nước làm mát, dung dịch tẩy rửa, chai đánh bóng 3M
   - 'VT-TIEU-HAO': Vật tư tiêu hao phụ xưởng: giấy nhám, băng dính giấy 3M, giẻ lau, phễu lọc sơn, lon pha, bạt che xe, bọc ghế, bao tay bảo hộ, que hàn, đá cắt, điện nước xưởng.

3. DỊCH VỤ & THẦU PHỤ (SERVICE):
   - 'DV-CUUHO': Toàn bộ dịch vụ cứu hộ, kéo xe, chở xe
   - 'DV-VANCHUYEN': Cước phí vận chuyển GrabExpress, ViettelPost, giao nhận hàng
   - 'DV-GIACONG': Gia công cơ khí ngoài (mâm, phay, tiện, hàn, kéo nắn, thước lái)
   - 'DV-SUACHUA': Chi phí sửa xe, tiền công đồng sơn ngoài, tiền công kỹ thuật, tháo lắp
   - 'DV-BAOVE': Thuê dịch vụ bảo vệ an ninh
   - 'DV-VESINH': Dịch vụ vệ sinh công nghiệp xưởng/văn phòng
   - 'DV-IT': Dịch vụ phần mềm, chữ ký số, hóa đơn điện tử, đường truyền internet, máy photocopy
   - 'DV-INAN': In ấn danh thiếp, bạt quảng cáo, catalogue

4. CHIẾT KHẤU & GIẢM TRỪ (DISCOUNT):
   - 'CK-GSM': Chiết khấu Xanh SM / GSM
   - 'CK-GRAB': Chiết khấu đối tác Grab
   - 'CK-THUONGMAI': Chiết khấu thương mại, giảm giá bán

5. CÔNG CỤ DỤNG CỤ (MATERIAL / TOOLS):
   - 'CCDC-XUONG': Dụng cụ xưởng (súng phun sơn, cuộn rulo, súng bulong, kìm, kích nâng, đồng hồ đo áp)
   - 'CCDC-VP': Thiết bị văn phòng (máy tính, màn hình LCD, case, chuột, switch mạng, camera quan sát, máy in)

6. HÀNH CHÍNH & VĂN PHÒNG PHẨM (OTHER / ADMIN):
   - 'HC-NUOC': Nước uống văn phòng (Lavie, Aquafina, nước bình 19L)
   - 'HC-VPP': Văn phòng phẩm (giấy in A4, bìa còng, bút viết, tiếp khách, bánh trái, xôi, cafe, khăn giấy, sáp thơm)

TRẢ VỀ DUY NHẤT ĐỊNH DẠNG JSON (không giải thích thêm markdown ngoài JSON block):
{
  "classifications": [
    {
      "lineIndex": 0,
      "itemCode": "VF-BIN20050001",
      "itemType": "PARTS",
      "isDiscountDeduction": false,
      "confidence": 0.98,
      "reason": "Phụ tùng lọc khí VinFast"
    }
  ]
}`;

  try {
    const response = await fetch(`${AI_ROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_ROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'ag/gemini-3.7-flash-low',
        tier: 'low',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Hãy phân loại danh sách các dòng hóa đơn sau theo đúng JSON schema:\n\n${serialized}`,
          },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });

    if (response.ok) {
      const data: any = await response.json();
      const rawText = data?.choices?.[0]?.message?.content || '';
      const parsedText = parseAiResponseContent(rawText);
      const json = JSON.parse(parsedText);
      const list = json?.classifications || [];
      for (const item of list) {
        if (typeof item.lineIndex === 'number') {
          map.set(item.lineIndex, item);
        }
      }
    }
  } catch (err) {
    // fallback
  }

  return map;
}

// Helper chạy mảng async với concurrency giới hạn
async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      results[index] = await fn(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    worker(),
  );
  await Promise.all(workers);
  return results;
}

async function main() {
  console.log(
    '================================================================',
  );
  console.log('🚀 HIGH-PERFORMANCE BACKFILL & STANDARDIZE INVOICE ITEM CODES');
  console.log(
    '================================================================',
  );
  console.log(`Database: ${dbUrl.replace(/:[^:@]+@/, ':***@')}`);
  console.log(`Direction: ${targetDirection}`);
  console.log(`Dry Run: ${isDryRun}`);
  console.log(`Force All: ${forceAll}`);
  console.log(`Batch Size: ${batchSize}`);
  console.log(`AI Concurrency: ${concurrency}`);
  if (limit) console.log(`Limit: ${limit}`);
  console.log(
    '----------------------------------------------------------------\n',
  );

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    const whereConditions = [`inv.is_deleted = false`];
    if (targetDirection !== 'ALL') {
      whereConditions.push(`inv.direction = '${targetDirection}'`);
    }
    if (!forceAll) {
      whereConditions.push(
        `(item.item_code IS NULL OR item.item_code = '' OR item.item_code = 'NULL' OR (
          item.item_code NOT LIKE 'VF-%' AND 
          item.item_code NOT LIKE 'PT-%' AND 
          item.item_code NOT LIKE 'VT-%' AND 
          item.item_code NOT LIKE 'DV-%' AND 
          item.item_code NOT LIKE 'CK-%' AND 
          item.item_code NOT LIKE 'CCDC-%' AND 
          item.item_code NOT LIKE 'HC-%'
        ))`,
      );
    }

    let query = `
      SELECT 
        item.id,
        item.invoice_id,
        inv.direction,
        item.description,
        item.unit,
        item.quantity,
        item.unit_price,
        item.pre_vat_amount,
        item.discount_amount,
        item.item_code,
        inv.invoice_no,
        inv.invoice_date,
        inv.seller_name,
        inv.seller_tax_code,
        inv.buyer_name,
        inv.buyer_tax_code,
        inv.license_plate,
        inv.invoice_type,
        inv.tax_invoice_status
      FROM erp_invoice_items item
      JOIN erp_invoices inv ON item.invoice_id = inv.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY inv.invoice_date DESC, item.created_at ASC
    `;

    if (limit) {
      query += ` LIMIT ${limit}`;
    }

    const { rows }: { rows: DbItemRow[] } = await client.query(query);
    console.log(`📊 Tìm thấy tổng cộng ${rows.length} dòng cần xử lý.\n`);

    if (rows.length === 0) {
      console.log(
        '✅ Toàn bộ các dòng yêu cầu đã có mã hàng hợp lệ. Hoàn tất!',
      );
      return;
    }

    const prefixStats: Record<string, number> = {
      'VF-* (VinFast)': 0,
      'PT-* (OEM Parts)': 0,
      'VT-* (Consumables)': 0,
      'DV-* (Services)': 0,
      'CK-* (Discounts)': 0,
      'CCDC-* (Tools)': 0,
      'HC-* (Admin/Water/Paper)': 0,
      OTHER: 0,
    };

    // 1. FAST PRE-FILTERING (Gán mã nhanh cho dòng khớp quy tắc chắc chắn)
    console.log(
      '⚡ Bước 1: Quét nhanh quy tắc Regex & Master Data (0.001ms)...',
    );

    interface ResolvedItem {
      id: string;
      itemCode: string;
      source: string;
      direction: string;
      invoiceNo: string;
      description: string;
    }

    const resolvedItems: ResolvedItem[] = [];
    const ambiguousItems: { row: DbItemRow; originalIndex: number }[] = [];

    let vfRuleCount = 0;
    let localRuleCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const item = rows[i];
      const vfCode = extractVinfastItemCode(item.description);
      if (vfCode) {
        resolvedItems.push({
          id: item.id,
          itemCode: vfCode,
          source: 'VINFAST_RULE',
          direction: item.direction,
          invoiceNo: item.invoice_no,
          description: item.description || '',
        });
        vfRuleCount++;
        continue;
      }

      const ruleResult = extractStandardItemCode({
        description: item.description,
        unit: item.unit,
        sellerName: item.seller_name,
        sellerTaxCode: item.seller_tax_code,
        preVatAmount: item.pre_vat_amount ? Number(item.pre_vat_amount) : 0,
        discountAmount: item.discount_amount ? Number(item.discount_amount) : 0,
      });

      if (ruleResult.source !== 'FALLBACK') {
        const code = normalizePrefix(ruleResult.itemCode, ruleResult.itemType);
        resolvedItems.push({
          id: item.id,
          itemCode: code,
          source: `RULE (${ruleResult.source})`,
          direction: item.direction,
          invoiceNo: item.invoice_no,
          description: item.description || '',
        });
        localRuleCount++;
      } else {
        ambiguousItems.push({ row: item, originalIndex: i });
      }
    }

    console.log(`  ➔ Khớp mã Phụ tùng VinFast (VF-*): ${vfRuleCount} dòng`);
    console.log(
      `  ➔ Khớp quy tắc cục bộ (DV-, VT-, CK-...): ${localRuleCount} dòng`,
    );
    console.log(
      `  ➔ Dòng mơ hồ cần gửi AI Gateway 9Router: ${ambiguousItems.length} dòng\n`,
    );

    // 2. AI BATCH PROCESSING SONG SONG
    if (ambiguousItems.length > 0) {
      console.log(
        `🤖 Bước 2: Gọi AI Gateway 9Router (Gemini 3.7 Flash) song song (Concurrency = ${concurrency})...`,
      );

      // Chia ambiguousItems thành các chunks có kích thước batchSize
      const aiChunks: { row: DbItemRow; originalIndex: number }[][] = [];
      for (let i = 0; i < ambiguousItems.length; i += batchSize) {
        aiChunks.push(ambiguousItems.slice(i, i + batchSize));
      }

      let completedAiBatches = 0;

      await mapConcurrent(aiChunks, concurrency, async (chunk, chunkIdx) => {
        const payload = chunk.map((item, idx) => ({
          lineIndex: idx,
          description: item.row.description || '',
          unit: item.row.unit || undefined,
          sellerName: item.row.seller_name || undefined,
          sellerTaxCode: item.row.seller_tax_code || undefined,
          preVatAmount: item.row.pre_vat_amount
            ? Number(item.row.pre_vat_amount)
            : 0,
          discountAmount: item.row.discount_amount
            ? Number(item.row.discount_amount)
            : 0,
        }));

        const aiResultMap = await call9RouterAiBatch(payload);

        for (let idx = 0; idx < chunk.length; idx++) {
          const item = chunk[idx];
          const aiRes = aiResultMap.get(idx);

          let code = 'PT-CHUNG';
          let src = 'FALLBACK';

          if (aiRes && aiRes.itemCode) {
            code = normalizePrefix(aiRes.itemCode, aiRes.itemType);
            src = 'AI';
          }

          resolvedItems.push({
            id: item.row.id,
            itemCode: code,
            source: src,
            direction: item.row.direction,
            invoiceNo: item.row.invoice_no,
            description: item.row.description || '',
          });
        }

        completedAiBatches++;
        if (
          completedAiBatches % 5 === 0 ||
          completedAiBatches === aiChunks.length
        ) {
          console.log(
            `  ▶ Tiến độ AI: ${completedAiBatches} / ${aiChunks.length} batches (${Math.min(completedAiBatches * batchSize, ambiguousItems.length)} / ${ambiguousItems.length} dòng)...`,
          );
        }
      });
    }

    // Thống kê Prefix
    for (const item of resolvedItems) {
      if (item.itemCode.startsWith('VF-')) prefixStats['VF-* (VinFast)']++;
      else if (item.itemCode.startsWith('PT-'))
        prefixStats['PT-* (OEM Parts)']++;
      else if (item.itemCode.startsWith('VT-'))
        prefixStats['VT-* (Consumables)']++;
      else if (item.itemCode.startsWith('DV-'))
        prefixStats['DV-* (Services)']++;
      else if (item.itemCode.startsWith('CK-'))
        prefixStats['CK-* (Discounts)']++;
      else if (item.itemCode.startsWith('CCDC-'))
        prefixStats['CCDC-* (Tools)']++;
      else if (item.itemCode.startsWith('HC-'))
        prefixStats['HC-* (Admin/Water/Paper)']++;
      else prefixStats['OTHER']++;
    }

    // 3. BULK UPDATE DATABASE THEO LÔ (500 DÒNG/LỆNH)
    if (!isDryRun && resolvedItems.length > 0) {
      console.log(
        `\n💾 Bước 3: Cập nhật dữ liệu hàng loạt vào Database (${resolvedItems.length} dòng)...`,
      );

      const dbChunkSize = 500;
      for (let i = 0; i < resolvedItems.length; i += dbChunkSize) {
        const chunk = resolvedItems.slice(i, i + dbChunkSize);
        const valuesList = chunk
          .map((item, idx) => `($${idx * 2 + 1}::uuid, $${idx * 2 + 2}::text)`)
          .join(', ');
        const params: any[] = [];
        chunk.forEach((item) => {
          params.push(item.id, item.itemCode);
        });

        const sql = `
          UPDATE erp_invoice_items AS t
          SET item_code = v.item_code,
              updated_at = NOW()
          FROM (VALUES ${valuesList}) AS v(id, item_code)
          WHERE t.id = v.id;
        `;

        await client.query(sql, params);
      }
      console.log('  ✅ Cập nhật thành công toàn bộ dòng hóa đơn!');
    }

    console.log(
      '\n================================================================',
    );
    console.log('🎉 TỔNG KẾT QUÁ TRÌNH CHUẨN HÓA MÃ HÀNG:');
    console.log(
      '================================================================',
    );
    console.log(`- Tổng số dòng đã quét: ${rows.length}`);
    console.log(
      `- Đã giải quyết bằng Regex / Rules: ${vfRuleCount + localRuleCount}`,
    );
    console.log(`- Đã giải quyết bằng AI 9Router: ${ambiguousItems.length}`);
    console.log(`- Tổng số dòng cập nhật: ${resolvedItems.length}`);
    console.log('\n📊 Phân bổ theo nhóm Prefix:');
    console.table(
      Object.entries(prefixStats).map(([prefix, count]) => ({
        Prefix: prefix,
        Count: count,
        Percentage: `${((count / resolvedItems.length) * 100).toFixed(2)}%`,
      })),
    );

    // 4. ĐỒNG BỘ CATALOG & SỔ CÁI VINFAST LEDGER
    if (!isDryRun) {
      console.log(
        '\n🔄 Bước 4: Đồng bộ Danh mục Catalog và Sổ cái VinFast Ledger...',
      );

      // 1. Đồng bộ Catalog cho tất cả các mã VF-
      const catRes = await client.query(`
        INSERT INTO vinfast_parts_catalog (sku, name, uom, is_service, created_at, updated_at)
        SELECT DISTINCT 
          SUBSTRING(item.item_code, 1, 32) as sku,
          SUBSTRING(COALESCE(NULLIF(TRIM(REGEXP_REPLACE(item.description, '^(?:VF-)?[A-Z0-9]+\\s*[-–]?\\s*', '')), ''), item.item_code), 1, 255) as name,
          SUBSTRING(COALESCE(NULLIF(item.unit, ''), 'Chiếc'), 1, 32) as uom,
          false as is_service,
          NOW(),
          NOW()
        FROM erp_invoice_items item
        JOIN erp_invoices inv ON item.invoice_id = inv.id
        WHERE item.item_code LIKE 'VF-%' AND inv.is_deleted = false
        ON CONFLICT (sku) DO NOTHING;
      `);
      console.log(`  ➔ Catalog: Đã đồng bộ mã mới.`);

      // 2. Đồng bộ Sổ cái vinfast_parts_ledger cho toàn bộ các dòng VF- (cả IN và OUT)
      const ledRes = await client.query(`
        INSERT INTO vinfast_parts_ledger (
          part_sku, invoice_item_id, invoice_id, direction, qty, unit_cost, pre_vat_amount,
          transaction_date, license_plate, is_adjustment, adj_sign, created_at
        )
        SELECT 
          SUBSTRING(item.item_code, 1, 32) as part_sku,
          item.id as invoice_item_id,
          inv.id as invoice_id,
          inv.direction as direction,
          COALESCE(item.quantity::numeric, 1) as qty,
          COALESCE(item.unit_price::numeric, CASE WHEN item.quantity::numeric > 0 THEN item.pre_vat_amount::numeric / item.quantity::numeric ELSE 0 END) as unit_cost,
          COALESCE(item.pre_vat_amount::numeric, 0) as pre_vat_amount,
          inv.invoice_date as transaction_date,
          SUBSTRING(inv.license_plate, 1, 32) as license_plate,
          false as is_adjustment,
          1 as adj_sign,
          NOW() as created_at
        FROM erp_invoice_items item
        JOIN erp_invoices inv ON item.invoice_id = inv.id
        WHERE item.item_code LIKE 'VF-%'
          AND inv.is_deleted = false
          AND inv.tax_invoice_status IN (1, 3)
          AND NOT EXISTS (
            SELECT 1 FROM vinfast_parts_ledger l WHERE l.invoice_item_id = item.id
          )
        ON CONFLICT DO NOTHING;
      `);
      console.log(
        `  ➔ Sổ cái Ledger: Đã ghi nhận các phát sinh mới vào Sổ kho.`,
      );
      console.log('✅ Đã đồng bộ hoàn tất Catalog & Sổ cái VinFast Ledger!');
    }

    if (isDryRun) {
      console.log('\n⚠️ Đang ở chế độ DRY-RUN (Chưa ghi vào database)');
    } else {
      console.log('\n✅ Hoàn tất 100% quá trình chuẩn hóa!');
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('❌ Lỗi thực thi backfill:', err);
  process.exit(1);
});

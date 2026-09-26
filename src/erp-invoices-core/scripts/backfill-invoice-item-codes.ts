/**
 * backfill-invoice-item-codes.ts
 *
 * Script backfill MÃ HÀNG (item_code) cho các dòng chi tiết Hóa đơn Đầu Vào (direction = 'IN')
 * theo cơ chế Hybrid AI-First (9router AI Gateway) ➔ Rule-based Fallback (Regex / Vendor Matching).
 *
 * Cách chạy:
 *   bun run src/erp-invoices-core/scripts/backfill-invoice-item-codes.ts [--dry-run] [--limit=50] [--batch-size=30]
 */

import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { extractStandardItemCode } from '../helpers/vinfast-part-code.helper';

// Load môi trường
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({
  path: path.resolve(process.cwd(), '.env.greenway-production'),
  override: true,
});

const dbUrl =
  process.env.DATABASE_URL ||
  'postgresql://erp_greenway_production_admin:Cg4b6wqHAH3kWVP2pbCismcari9Tz-4ueB4YH_Pd@db-dev.liouni.com:5433/erp_greenway_production?sslmode=disable';

const AI_ROUTER_BASE_URL =
  process.env.NINE_ROUTER_BASE_URL ||
  process.env.AI_ROUTER_BASE_URL ||
  'https://9router.liouni.com/v1';
const AI_ROUTER_API_KEY =
  process.env.NINE_ROUTER_API_KEY ||
  process.env.AI_ROUTER_API_KEY ||
  'sk-8cacf887edb2816b-plx0ba-b0f99291';

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const forceAll = args.includes('--force-all');
const limitArg = args.find((a) => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;
const batchSizeArg = args.find((a) => a.startsWith('--batch-size='));
const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1], 10) : 30;

interface DbItemRow {
  id: string;
  invoice_id: string;
  description: string | null;
  unit: string | null;
  pre_vat_amount: string | null;
  discount_amount: string | null;
  item_code: string | null;
  invoice_no: string;
  seller_name: string | null;
  seller_tax_code: string | null;
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

  // SSE chunk aggregator
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

  const systemPrompt = `Bạn là Chuyên gia Master Data & Kế toán Trưởng ERP Garage Ô tô.
Nhiệm vụ của bạn là đọc thông tin chi tiết từng dòng hàng hóa/dịch vụ trên hóa đơn đầu vào và gán MÃ HÀNG CHUẨN HÓA (item_code), LOẠI MẶT HÀNG (item_type) và XÁC ĐỊNH TÍNH CHẤT GIẢM TRỪ (isDiscountDeduction).

HƯỚNG DẪN PHÂN LOẠI & TRÍCH XUẤT MÃ HÀNG:
1. PHỤ TÙNG CHÍNH HÃNG VINFAST & OEM (ƯU TIÊN TRÍCH XUẤT MÃ PART NUMBER GỐC):
   - Đọc tên hàng hóa, tìm và trích xuất MÃ PART NUMBER CHUẨN của nhà sản xuất đặt ở đầu hoặc trong mô tả:
     + Ví dụ: "BIW20002460 - ĐỆM_CAO_SU_TAY_NẮM_MỞ_CỬA_BÊN_I" -> item_code: "BIW20002460", item_type: "PARTS"
     + Ví dụ: "CHS20000814 - LỐP XE" -> item_code: "CHS20000814", item_type: "PARTS"
     + Ví dụ: "EEP30032001 - ẮC QUY 12V" -> item_code: "EEP30032001", item_type: "PARTS"
     + Ví dụ: "FLU10006075 - Ga điều hòa R134" -> item_code: "FLU10006075", item_type: "MATERIAL"
     + Ví dụ: "VF5_HV_BATTERY_PACK_38_KWH" -> item_code: "EEP73110011AP", item_type: "PARTS"
     + Ví dụ: "HV_BATTERY_41.9KWH" hoặc "BAT21001011" -> item_code: "BAT21001011", item_type: "PARTS"
     + Ví dụ: "ĐỘNG CƠ ĐIỆN BẢO HÀNH" -> item_code: "PVT20030000", item_type: "PARTS"
     + Ví dụ: "LFP00000216 Chẩn đoán lỗi pin" -> item_code: "LFP00000216", item_type: "SERVICE"

2. CỨU HỘ & CẨU KÉO XE:
   - Cước chở xe, cẩu kéo xe tai nạn/sự cố của CÔNG TY CỔ PHẦN DỊCH VỤ VÂN SƠN -> item_code: "DV-CUUHO-VANSON", item_type: "SERVICE".
   - Cứu hộ giao thông 911 SÀI GÒN -> item_code: "DV-CUUHO-911", item_type: "SERVICE".
   - Cứu hộ kéo xe chung khác -> item_code: "DV-CUUHO", item_type: "SERVICE".

3. CHIẾT KHẤU, GIẢM GIÁ & KHUYẾN MẠI (LƯU Ý: LÀ PHÉP TRỪ VÀO TỔNG TIỀN):
   - Chiết khấu từ GRAB -> item_code: "CK-GRAB", item_type: "DISCOUNT", isDiscountDeduction: true.
   - Chiết khấu thương mại từ GSM (Xanh SM) -> item_code: "CK-GSM", item_type: "DISCOUNT", isDiscountDeduction: true.
   - Chiết khấu mua hàng / giảm giá chung -> item_code: "CK-THUONGMAI", item_type: "DISCOUNT", isDiscountDeduction: true.

4. CÔNG THỢ & GIA CÔNG THẦU PHỤ:
   - Gia công mâm, hàn lazang, phục hồi mâm ô tô (TNT Auto) -> item_code: "DV-GIACONG-MAM", item_type: "SERVICE".
   - Phục hồi thước lái, tiện đĩa thắng -> item_code: "DV-GIACONG-THUOCLAI", item_type: "SERVICE".
   - Dịch vụ thay thế cầu chì Pyro VinFast theo số VIN -> item_code: "DV-THAY-PYRO", item_type: "SERVICE".
   - Sửa chữa thầu phụ xe ngoài -> item_code: "DV-SUACHUA-NGOAI", item_type: "SERVICE".

5. DỊCH VỤ VẬN HÀNH, TIỆN ÍCH & MẶT BẰNG:
   - Phí dịch vụ bảo vệ an ninh (Thắng Lợi 24H) -> item_code: "DV-BAOVE", item_type: "SERVICE".
   - Vệ sinh công nghiệp xưởng/VP (Trí Đức Clean, Biwase) -> item_code: "DV-VESINH", item_type: "SERVICE".
   - Dịch vụ tư vấn kế toán, pháp lý (W&A, Wellspring Law) -> item_code: "DV-TUVAN", item_type: "SERVICE".
   - Cước vận chuyển, giao nhận phụ tùng (Grab Express, Viettel Post) -> item_code: "DV-CUOC-GIAOHANG", item_type: "SERVICE".
   - Xử lý rác thải công nghiệp / y tế -> item_code: "DV-RACTHAI", item_type: "SERVICE".

6. VẬT TƯ TIÊU HAO XƯỞNG (SƠN, DẦU, GAS, KEO):
   - Sơn lót, sơn màu, keo bóng 2K, chất đóng rắn -> item_code: "VT-SON-2K", item_type: "MATERIAL".
   - Dầu động cơ, dầu nhớt phuy/can, dầu hộp số -> item_code: "VT-DAU-NHOT", item_type: "MATERIAL".
   - Gas lạnh điều hòa R134a -> item_code: "VT-GAS-R134", item_type: "MATERIAL".
   - Nước làm mát động cơ -> item_code: "VT-NUOC-LAMMAT", item_type: "MATERIAL".
   - Giấy nhám, băng keo, vải lau, màng bọc nilong -> item_code: "VT-TIEUHAO-XUONG", item_type: "MATERIAL".

7. KHÁC / HÀNG HÓA CHUNG:
   - Nước uống tiếp khách/thợ (Biwase, Viva 19L), VPP -> item_code: "HH-VANPHONGPHAM", item_type: "OTHER".

ĐỊNH DẠNG ĐẦU RA JSON BẮT BUỘC:
{
  "items": [
    {
      "lineIndex": 0,
      "itemCode": "BIW20002460",
      "itemType": "PARTS",
      "isDiscountDeduction": false,
      "confidence": 0.98,
      "reason": "Mã phụ tùng đệm cao su tay nắm VinFast"
    }
  ]
}`;

  try {
    const cleanUrl = `${AI_ROUTER_BASE_URL.replace(/\/+$/, '')}/chat/completions`;
    const response = await fetch(cleanUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_ROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'ag/gemini-3.7-flash-low',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Hãy phân loại và gán mã hàng chuẩn cho danh sách các dòng sau:\n${serialized}`,
          },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.warn(`[AI Warning] 9router HTTP ${response.status}`);
      return map;
    }

    const rawText = await response.text();
    const content = parseAiResponseContent(rawText);
    if (!content) return map;

    const parsed = JSON.parse(
      content.replace(/```json\n?/g, '').replace(/```\n?/g, ''),
    );
    if (Array.isArray(parsed.items)) {
      for (const res of parsed.items) {
        if (
          res.lineIndex !== undefined &&
          res.itemCode &&
          (res.confidence ?? 1) >= 0.7
        ) {
          map.set(Number(res.lineIndex), res);
        }
      }
    }
  } catch (err: any) {
    console.warn(`[AI Warning] 9router call failed: ${err.message}`);
  }

  return map;
}

async function main() {
  console.log(
    '================================================================',
  );
  console.log(
    '🚀 BACKFILL HYBRID AI-FIRST INVOICE ITEM CODES (INPUT INVOICES)',
  );
  console.log(
    '================================================================',
  );
  console.log(`Database: ${dbUrl.replace(/:[^:@]+@/, ':***@')}`);
  console.log(`Dry Run: ${isDryRun}`);
  console.log(`Force All: ${forceAll}`);
  console.log(`Batch Size: ${batchSize}`);
  if (limit) console.log(`Limit: ${limit}`);
  console.log(
    '----------------------------------------------------------------\n',
  );

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    // 1. Lấy danh sách items cần phân loại
    const whereConditions = [`inv.direction = 'IN'`, `inv.is_deleted = false`];
    if (!forceAll) {
      whereConditions.push(
        `(item.item_code IS NULL OR item.item_code = '' OR item.item_code = 'NULL')`,
      );
    }

    let query = `
      SELECT 
        item.id,
        item.invoice_id,
        item.description,
        item.unit,
        item.pre_vat_amount,
        item.discount_amount,
        item.item_code,
        inv.invoice_no,
        inv.seller_name,
        inv.seller_tax_code
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
        '✅ Toàn bộ các dòng đầu vào đã có mã hàng hợp lệ. Hoàn tất!',
      );
      return;
    }

    let aiAssignedCount = 0;
    let ruleAssignedCount = 0;
    let preservedCount = 0;
    let totalUpdated = 0;

    // 2. Xử lý theo từng batch
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      console.log(
        `▶ Đang xử lý batch ${Math.floor(i / batchSize) + 1} / ${Math.ceil(rows.length / batchSize)} (Dòng ${i + 1} - ${Math.min(i + batchSize, rows.length)})...`,
      );

      // Chuẩn bị payload cho AI
      const aiInputPayload = batch.map((item, idx) => ({
        lineIndex: idx,
        description: item.description || '',
        unit: item.unit || undefined,
        sellerName: item.seller_name || undefined,
        sellerTaxCode: item.seller_tax_code || undefined,
        preVatAmount: item.pre_vat_amount ? Number(item.pre_vat_amount) : 0,
        discountAmount: item.discount_amount ? Number(item.discount_amount) : 0,
      }));

      // Gọi AI 9router
      const aiResults = await call9RouterAiBatch(aiInputPayload);

      // Map kết quả & Update
      for (let idx = 0; idx < batch.length; idx++) {
        const item = batch[idx];
        const aiResult = aiResults.get(idx);

        let finalCode: string | null = null;
        let finalSource = 'FALLBACK';

        if (
          !forceAll &&
          item.item_code &&
          item.item_code.trim() !== '' &&
          item.item_code !== 'NULL'
        ) {
          finalCode = item.item_code;
          finalSource = 'PRESERVED';
          preservedCount++;
        } else if (aiResult && aiResult.itemCode) {
          finalCode = aiResult.itemCode;
          finalSource = 'AI';
          aiAssignedCount++;
        } else {
          const ruleResult = extractStandardItemCode({
            description: item.description,
            unit: item.unit,
            sellerName: item.seller_name,
            sellerTaxCode: item.seller_tax_code,
            preVatAmount: item.pre_vat_amount ? Number(item.pre_vat_amount) : 0,
            discountAmount: item.discount_amount
              ? Number(item.discount_amount)
              : 0,
          });
          finalCode = ruleResult.itemCode;
          finalSource = `RULE (${ruleResult.source})`;
          ruleAssignedCount++;
        }

        if (finalCode) {
          if (!isDryRun) {
            await client.query(
              `UPDATE erp_invoice_items SET item_code = $1, updated_at = NOW() WHERE id = $2`,
              [finalCode, item.id],
            );
          }
          totalUpdated++;
          if (idx < 5 || idx === batch.length - 1) {
            console.log(
              `  [#${i + idx + 1}] HĐ: ${item.invoice_no} | ${item.description?.slice(0, 40).padEnd(40)} ➔ [${finalCode}] (${finalSource})`,
            );
          }
        }
      }
    }

    console.log(
      '\n================================================================',
    );
    console.log('🎉 TỔNG KẾT QUÁ TRÌNH BACKFILL MÃ HÀNG ĐẦU VÀO:');
    console.log(
      '================================================================',
    );
    console.log(`- Tổng số dòng đã quét: ${rows.length}`);
    console.log(`- Gán mã qua AI 9router: ${aiAssignedCount}`);
    console.log(`- Gán mã qua Rule Fallback: ${ruleAssignedCount}`);
    console.log(`- Bảo toàn mã cũ: ${preservedCount}`);
    console.log(`- Tổng số dòng được cập nhật: ${totalUpdated}`);
    if (isDryRun) {
      console.log('⚠️ Đang ở chế độ DRY-RUN (Chưa ghi vào database)');
    } else {
      console.log('✅ Đã ghi nhận thành công vào database!');
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('❌ Lỗi thực thi backfill:', err);
  process.exit(1);
});

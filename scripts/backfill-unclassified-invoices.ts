/**
 * scripts/backfill-unclassified-invoices.ts
 *
 * Tự động quét và phân loại AI (9router AI Gateway / VinFast Whitelist)
 * cho toàn bộ hóa đơn mua vào (direction = 'IN') chưa có category_id trên DB,
 * đồng thời tự động hạch toán Sổ Nhật Ký Chung với Số CT chuẩn:
 *   HĐM-YYYYMMDD-XXX-TS3
 *
 * Cách chạy:
 *   bun run scripts/backfill-unclassified-invoices.ts [.env.file] [--dry-run]
 */

import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load môi trường
dotenv.config();
const envFileArg = process.argv
  .slice(2)
  .find((a) => a.startsWith('.env') || a.endsWith('.env'));
let loadedEnvConfig: Record<string, string> = {};
if (envFileArg && fs.existsSync(envFileArg)) {
  loadedEnvConfig = dotenv.parse(fs.readFileSync(envFileArg));
} else if (fs.existsSync('.env')) {
  loadedEnvConfig = dotenv.parse(fs.readFileSync('.env'));
}

const dbUrl: string =
  loadedEnvConfig.DATABASE_URL || process.env.DATABASE_URL || '';
if (!dbUrl) {
  throw new Error('❌ Thiếu biến DATABASE_URL trong môi trường hoặc file .env');
}

const AI_ROUTER_BASE_URL: string =
  loadedEnvConfig.NINE_ROUTER_BASE_URL ||
  process.env.NINE_ROUTER_BASE_URL ||
  'https://9router.liouni.com/v1';
const AI_ROUTER_API_KEY: string =
  loadedEnvConfig.NINE_ROUTER_API_KEY || process.env.NINE_ROUTER_API_KEY || '';
if (!AI_ROUTER_API_KEY) {
  throw new Error(
    '❌ Thiếu biến NINE_ROUTER_API_KEY trong môi trường hoặc file .env',
  );
}

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

const VINFAST_TAX_CODES = [
  '0108926276',
  '0108926276-001',
  '0202357718',
  '0108926276-002',
  '0108926276-003',
  '0108926276-004',
];

const CATEGORY_DEFAULT_ACCOUNT_MAP: Record<string, string> = {
  VF_PARTS: '1561',
  COMMERCIAL_VEHICLES: '1562',
  OEM_OTHER_PARTS: '1563',
  WORKSHOP_CONSUMABLES: '152',
  GARAGE_SUBCONTRACT: '6427',
  GARAGE_TOOLS_EQUIPMENT: '242',
  OFFICE_IT_FACILITIES: '242',
  OPEX_LOGISTICS: '6427',
  OPEX_SECURITY_CLEANING: '6427',
  OPEX_BANK_FEES: '6428',
  OPEX_ADMIN: '6428',
  OPEX_LEGAL_CONSULTING: '6427',
  OPEX_IT_SOFTWARE: '6427',
  OPEX_MARKETING: '6421',
};

async function call9RouterAi(
  invoice: any,
  items: any[],
): Promise<{ categoryCode: string; reason: string; confidence: number }> {
  const normTaxCode = String(invoice.seller_tax_code || '')
    .replace(/\s+/g, '')
    .trim();
  const sellerNameUpper = String(invoice.seller_name || '').toUpperCase();

  if (normTaxCode && VINFAST_TAX_CODES.includes(normTaxCode)) {
    return {
      categoryCode: 'VF_PARTS',
      reason: `Khớp trực tiếp MST chính hãng VinFast (${normTaxCode})`,
      confidence: 1.0,
    };
  }

  if (sellerNameUpper.includes('VINFAST')) {
    return {
      categoryCode: 'VF_PARTS',
      reason: `Khớp tên VinFast trong tên người bán`,
      confidence: 1.0,
    };
  }

  const promptPayload = {
    model: 'low',
    messages: [
      {
        role: 'system',
        content: `Bạn là Giám đốc Kế toán kiêm Chuyên gia Phân loại Chi phí ERP Garage Ô tô Liouni theo Thông tư 99/2025/TT-BTC.
Nhiệm vụ: Đọc kỹ thông tin hóa đơn đầu vào (người bán, mô tả, mặt hàng) và phân loại vào ĐÚNG 1 TRONG 14 MÃ DANH MỤC SAU ĐÂY:

DANH SÁCH 14 MÃ DANH MỤC CHUẨN:
1. VF_PARTS: Phụ tùng chính hãng VinFast.
2. COMMERCIAL_VEHICLES: Mua xe ô tô thương mại / xe lướt.
3. OEM_OTHER_PARTS: Phụ tùng OEM & Các hãng xe khác (Lốp xe Hải Triều/Michelin/Pirelli, ắc quy Varta/GS, bạc máy, rotuyn, má phanh...).
4. WORKSHOP_CONSUMABLES: Nguyên vật liệu & Tiêu hao xưởng (Sơn các màu, keo bóng 2K, chất đóng rắn, dung môi pha sơn, dầu nhớt, gas lạnh...).
5. GARAGE_SUBCONTRACT: Gia công ngoài & Thầu phụ kỹ thuật (Sửa vỏ pin EV, phục hồi/sơn mâm lazang, dịch vụ đồng sơn ngoài...).
6. GARAGE_TOOLS_EQUIPMENT: Máy móc, Thiết bị & CCDC xưởng (Súng siết bulong, máy nén khí, cẩu máy, kệ trung tải, tủ dụng cụ...).
7. OFFICE_IT_FACILITIES: Thiết bị CNTT, Camera & Nội thất VP (Laptop, camera, máy in, bàn ghế...).
8. OPEX_LOGISTICS: Giao nhận & Vận chuyển (Grab Express, taxi di chuyển GSM, cứu hộ kéo xe 911, Viettel Post...).
9. OPEX_SECURITY_CLEANING: Bảo vệ, Vệ sinh & Môi trường (Bảo vệ Hoàng Thiên Hổ, vệ sinh Trí Đức Clean, rác thải công nghiệp...).
10. OPEX_BANK_FEES: Phí Ngân hàng & Dịch vụ Tài chính (Phí duy trì tài khoản Techcombank, phí chuyển tiền, phí máy POS...).
11. OPEX_ADMIN: Hành chính, Văn phòng phẩm & Nước uống (Giấy A4, nước khoáng Biwase 19L...).
12. OPEX_LEGAL_CONSULTING: Tư vấn Pháp lý & Kế toán BCTC (Dịch vụ kế toán BCTC, tư vấn luật...).
13. OPEX_IT_SOFTWARE: Phần mềm Garage (KGARA), Email & 4G.
14. OPEX_MARKETING: Tiếp thị, Video & Quà tặng.

Trả về duy nhất định dạng JSON thuần túy:
{
  "categoryCode": "MÃ_DANH_MỤC_TRÊN",
  "confidence": 0.95,
  "reason": "Giải thích ngắn gọn 1 câu"
}`,
      },
      {
        role: 'user',
        content: JSON.stringify({
          invoiceNo: invoice.invoice_no,
          serialNo: invoice.serial_no,
          sellerName: invoice.seller_name,
          sellerTaxCode: invoice.seller_tax_code,
          description: invoice.description,
          totalAmount: Number(invoice.total_amount || 0),
          items: items.slice(0, 15).map((it) => ({
            name: it.description,
            code: it.item_code,
            qty: it.quantity,
            amount: it.total_amount,
          })),
        }),
      },
    ],
    temperature: 0.1,
    response_format: { type: 'json_object' },
  };

  try {
    const res = await fetch(`${AI_ROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_ROUTER_API_KEY}`,
      },
      body: JSON.stringify(promptPayload),
    });

    if (!res.ok) {
      throw new Error(`AI Gateway HTTP ${res.status}: ${await res.text()}`);
    }

    const responseText = (await res.text()).trim();
    let aggregatedContent = '';

    if (responseText.startsWith('{')) {
      const json = JSON.parse(responseText);
      aggregatedContent = json.choices?.[0]?.message?.content || '';
    } else {
      // Parse SSE lines
      const lines = responseText.split('\n');
      for (const line of lines) {
        const lineTrim = line.trim();
        if (!lineTrim.startsWith('data:') || lineTrim.includes('[DONE]'))
          continue;
        try {
          const chunkJson = JSON.parse(lineTrim.slice(5).trim());
          const delta =
            chunkJson.choices?.[0]?.delta?.content ||
            chunkJson.choices?.[0]?.message?.content;
          if (delta) aggregatedContent += delta;
        } catch {
          // ignore
        }
      }
    }

    const clean = aggregatedContent
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : clean);

    const validCodes = [
      'VF_PARTS',
      'COMMERCIAL_VEHICLES',
      'OEM_OTHER_PARTS',
      'WORKSHOP_CONSUMABLES',
      'GARAGE_SUBCONTRACT',
      'GARAGE_TOOLS_EQUIPMENT',
      'OFFICE_IT_FACILITIES',
      'OPEX_LOGISTICS',
      'OPEX_SECURITY_CLEANING',
      'OPEX_BANK_FEES',
      'OPEX_ADMIN',
      'OPEX_LEGAL_CONSULTING',
      'OPEX_IT_SOFTWARE',
      'OPEX_MARKETING',
    ];

    const categoryCode = validCodes.includes(parsed.categoryCode)
      ? parsed.categoryCode
      : 'T0003';
    return {
      categoryCode,
      reason: parsed.reason || 'AI phân loại',
      confidence: parsed.confidence || 0.8,
    };
  } catch (err: any) {
    console.warn(
      `  ⚠️ AI Classification error: ${err.message}. Fallback to T0003.`,
    );
    return {
      categoryCode: 'T0003',
      reason: `Fallback lỗi AI: ${err.message}`,
      confidence: 0.5,
    };
  }
}

async function main() {
  console.log(
    '================================================================',
  );
  console.log('🚀 BACKFILL & AI AUTOCLASSIFY UNCLASSIFIED INVOICES RUNNER');
  console.log(
    '================================================================',
  );
  console.log(`📁 Database: ${dbUrl.replace(/:[^:@]+@/, ':***@')}`);
  console.log(
    `🔍 Chế độ: ${isDryRun ? 'DRY-RUN (Không ghi DB)' : '⚡ THỰC THI THỰC TẾ'}\n`,
  );

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    // 1. Load Categories Map
    const catRes = await client.query(
      `SELECT id, code, name FROM erp_module_categories WHERE module_key = 'INVOICE' AND is_deleted = false`,
    );
    const catMap = new Map<string, { id: string; name: string }>();
    for (const r of catRes.rows) {
      catMap.set(r.code, { id: r.id, name: r.name });
    }

    // 2. Load Chart of Accounts
    const coaRes = await client.query(
      `SELECT id, account_code, account_name FROM erp_chart_of_accounts WHERE is_deleted = false`,
    );
    const coaMap = new Map<string, string>(); // code -> id
    for (const r of coaRes.rows) {
      coaMap.set(r.account_code, r.id);
    }

    const coa1331 = coaMap.get('1331');
    const coa331 = coaMap.get('331');
    const coaT0003 = coaMap.get('T0003') || coaMap.get('0003');

    // 3. Lấy danh sách hóa đơn mua vào chưa có categoryId
    const invoicesRes = await client.query(`
      SELECT 
        inv.id, inv.invoice_no, inv.serial_no, inv.invoice_date, inv.direction,
        inv.seller_name, inv.seller_tax_code, inv.seller_address,
        inv.pre_vat_amount, inv.vat_amount, inv.total_amount, inv.description,
        inv.branch_id, inv.posting_status, inv.journal_entry_id
      FROM erp_invoices inv
      WHERE inv.direction = 'IN' 
        AND (inv.category_id IS NULL OR inv.posting_status != 'POSTED' OR inv.journal_entry_id IS NULL)
        AND inv.is_deleted = false
      ORDER BY inv.invoice_date ASC
    `);

    const invoices = invoicesRes.rows;
    console.log(
      `📌 Tìm thấy ${invoices.length} hóa đơn mua vào cần phân loại & hạch toán.\n`,
    );

    if (invoices.length === 0) {
      console.log(
        '✅ Tất cả hóa đơn mua vào đã được phân loại và hạch toán 100%!',
      );
      return;
    }

    let defaultBranchId: string;
    const branchRes = await client.query(
      `SELECT id FROM erp_branches WHERE is_active = true LIMIT 1`,
    );
    defaultBranchId = branchRes.rows[0]?.id;

    for (let idx = 0; idx < invoices.length; idx++) {
      const inv = invoices[idx];
      console.log(
        `[${idx + 1}/${invoices.length}] Xử lý HĐ #${inv.invoice_no} (${inv.serial_no}) - ${inv.seller_name}...`,
      );

      // Lấy chi tiết items của HĐ
      const itemsRes = await client.query(
        `SELECT id, item_code, description, quantity, unit_price, pre_vat_amount, vat_amount, total_amount 
         FROM erp_invoice_items 
         WHERE invoice_id = $1 
         ORDER BY created_at ASC`,
        [inv.id],
      );
      const items = itemsRes.rows;

      // Gọi AI phân loại
      const aiResult = await call9RouterAi(inv, items);
      console.log(
        `  🤖 AI Phân loại: ${aiResult.categoryCode} (Confidence: ${aiResult.confidence * 100}%) - ${aiResult.reason}`,
      );

      const matchedCat = catMap.get(aiResult.categoryCode);
      const categoryId = matchedCat ? matchedCat.id : null;

      // Xác định tài khoản Nợ
      const debitAccountCode =
        CATEGORY_DEFAULT_ACCOUNT_MAP[aiResult.categoryCode] || 'T0003';
      const debitAccountId = coaMap.get(debitAccountCode) || coaT0003;

      if (!debitAccountId || !coa331) {
        console.error(
          `  ❌ Không tìm thấy tài khoản kế toán (${debitAccountCode} / 331), bỏ qua hạch toán.`,
        );
        continue;
      }

      const branchId = inv.branch_id || defaultBranchId;
      const invDate = inv.invoice_date
        ? new Date(inv.invoice_date)
        : new Date();
      const dateStr = invDate.toISOString().slice(0, 10).replace(/-/g, '');
      const prefix = `HĐM-${dateStr}`;

      // Lấy sequence trong ngày
      const lastEntryRes = await client.query(
        `SELECT entry_no FROM erp_journal_entries 
         WHERE branch_id = $1 AND entry_no LIKE $2 
         ORDER BY entry_no DESC LIMIT 1`,
        [branchId, `${prefix}-%`],
      );

      let nextCount = 1;
      if (lastEntryRes.rows.length > 0) {
        const lastEntryNo = lastEntryRes.rows[0].entry_no;
        const parts = lastEntryNo.split('-');
        if (parts.length >= 3) {
          const parsedSeq = parseInt(parts[2], 10);
          if (!isNaN(parsedSeq)) nextCount = parsedSeq + 1;
        }
      }

      const ts3 = String(Date.now()).slice(-3).padStart(3, '0');
      const seqStr = String(nextCount).padStart(3, '0');
      const entryNo = `${prefix}-${seqStr}-${ts3}`;

      const invRef = inv.serial_no
        ? `${inv.invoice_no}-${inv.serial_no}`
        : inv.invoice_no;
      const defaultDesc =
        inv.description || `Hạch toán hóa đơn ${inv.invoice_no}`;
      const fullDesc = `${invRef}_${defaultDesc}`;

      const preVat = Math.round(Number(inv.pre_vat_amount || 0) * 100) / 100;
      const vat = Math.round(Number(inv.vat_amount || 0) * 100) / 100;
      const total = Math.round(Number(inv.total_amount || 0) * 100) / 100;

      console.log(
        `  📝 Số CT: ${entryNo} | Nợ ${debitAccountCode}: ${preVat.toLocaleString()}đ, Thuế 1331: ${vat.toLocaleString()}đ | Có 331: ${total.toLocaleString()}đ`,
      );

      if (!isDryRun) {
        // 1. Cập nhật Category vào erp_invoices
        if (categoryId) {
          await client.query(
            `UPDATE erp_invoices SET category_id = $1, updated_at = NOW() WHERE id = $2`,
            [categoryId, inv.id],
          );
        }

        // 2. Xóa bút toán cũ nếu có
        if (inv.journal_entry_id) {
          await client.query(
            `UPDATE erp_journal_entries SET is_deleted = true WHERE id = $1`,
            [inv.journal_entry_id],
          );
        }
        await client.query(
          `UPDATE erp_journal_entries SET is_deleted = true WHERE source_id = $1 AND source_type = 'INVOICE'`,
          [inv.id],
        );

        // 3. Tạo Bút toán mới
        const insJeRes = await client.query(
          `
          INSERT INTO erp_journal_entries (
            entry_no, branch_id, date, document_date, description, subject_name,
            source_type, source_id, reference, status, is_deleted, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, 'INVOICE', $7, $8, 'POSTED', false, NOW(), NOW())
          RETURNING id
        `,
          [
            entryNo,
            branchId,
            invDate,
            invDate,
            fullDesc,
            inv.seller_name,
            inv.id,
            invRef,
          ],
        );

        const jeId = insJeRes.rows[0].id;

        // 4. Tạo các dòng định khoản
        if (
          preVat > 0 &&
          vat > 0 &&
          coa1331 &&
          Math.abs(preVat + vat - total) <= 1.0
        ) {
          // Nợ DebitAccount
          await client.query(
            `
            INSERT INTO erp_journal_entry_lines (journal_entry_id, account_id, debit, credit, description, sort, created_at, updated_at)
            VALUES ($1, $2, $3, 0, $4, 1, NOW(), NOW())
          `,
            [jeId, debitAccountId, preVat, `${invRef}_${defaultDesc}`],
          );

          // Nợ 1331
          await client.query(
            `
            INSERT INTO erp_journal_entry_lines (journal_entry_id, account_id, debit, credit, description, sort, created_at, updated_at)
            VALUES ($1, $2, $3, 0, $4, 2, NOW(), NOW())
          `,
            [jeId, coa1331, vat, `${invRef}_Thuế GTGT đầu vào`],
          );

          // Có 331
          await client.query(
            `
            INSERT INTO erp_journal_entry_lines (journal_entry_id, account_id, debit, credit, description, sort, created_at, updated_at)
            VALUES ($1, $2, 0, $3, $4, 3, NOW(), NOW())
          `,
            [jeId, coa331, total, `${invRef}_Phải trả người bán`],
          );
        } else {
          // Hạch toán gộp
          await client.query(
            `
            INSERT INTO erp_journal_entry_lines (journal_entry_id, account_id, debit, credit, description, sort, created_at, updated_at)
            VALUES ($1, $2, $3, 0, $4, 1, NOW(), NOW())
          `,
            [jeId, debitAccountId, total, `${invRef}_${defaultDesc}`],
          );

          await client.query(
            `
            INSERT INTO erp_journal_entry_lines (journal_entry_id, account_id, debit, credit, description, sort, created_at, updated_at)
            VALUES ($1, $2, 0, $3, $4, 2, NOW(), NOW())
          `,
            [jeId, coa331, total, `${invRef}_Phải trả người bán`],
          );
        }

        // 5. Cập nhật trạng thái POSTED vào invoice
        await client.query(
          `
          UPDATE erp_invoices 
          SET posting_status = 'POSTED', 
              journal_entry_id = $1, 
              posting_date = $2, 
              updated_at = NOW()
          WHERE id = $3
        `,
          [jeId, invDate.toISOString().slice(0, 10), inv.id],
        );

        console.log(
          `  ✅ Đã lưu thành công Bút toán ${entryNo} cho HĐ #${inv.invoice_no}\n`,
        );
      }
    }

    console.log(
      '================================================================',
    );
    console.log(`🎉 HOÀN TẤT XỬ LÝ TOÀN BỘ ${invoices.length} HÓA ĐƠN!`);
    console.log(
      '================================================================',
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});

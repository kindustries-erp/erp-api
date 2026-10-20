import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name: string, defaultValue?: string): string | undefined => {
  const arg = args.find((a) => a.startsWith(`--${name}=`));
  if (arg) return arg.split('=')[1];
  return defaultValue;
};

const isExecute = args.includes('--execute');
const isDryRun = args.includes('--dry-run') || !isExecute;
const fromDate = getArg('from', '2025-01-01')!;
const toDate = getArg('to');
const envFile = getArg('env-file', '.env.greenway-production');

const envPath = path.isAbsolute(envFile!)
  ? envFile!
  : path.resolve(process.cwd(), envFile!);

if (fs.existsSync(envPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const databaseUrl = getArg('database-url') || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error(`❌ Không tìm thấy DATABASE_URL từ ${envPath}`);
  process.exit(1);
}

interface AccountSummary {
  code: string;
  name: string;
  debit: number;
  credit: number;
}

async function run() {
  console.log('===============================================================');
  console.log('🚀 ERP HISTORICAL BATCH ACCOUNTING RUNNER (2025 - PRESENT)');
  console.log('===============================================================');
  console.log(`📁 Config env: ${envPath}`);
  console.log(`📅 Quét dữ liệu từ ngày: ${fromDate}${toDate ? ` đến ${toDate}` : ''}`);
  console.log(`🔍 Chế độ: ${isDryRun ? 'DRY-RUN (Chỉ kiểm toán, KHÔNG ghi DB)' : '⚠️ THỰC THI (Ghi vào DB)'}`);
  console.log('===============================================================\n');

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    // 1. Load Chart of Accounts lookup
    console.log('🔍 Đang kiểm tra danh mục tài khoản kế toán...');
    const coaRes = await client.query(
      `SELECT id, account_code, account_name FROM erp_chart_of_accounts WHERE is_deleted = false`
    );
    const coaMap = new Map<string, { id: string; name: string }>();
    for (const r of coaRes.rows) {
      coaMap.set(r.account_code, { id: r.id, name: r.account_name });
    }

    const getAccountId = (code: string, fallbackCodes: string[] = []): { id: string; code: string; name: string } | null => {
      if (coaMap.has(code)) {
        return { id: coaMap.get(code)!.id, code, name: coaMap.get(code)!.name };
      }
      for (const fc of fallbackCodes) {
        if (coaMap.has(fc)) {
          return { id: coaMap.get(fc)!.id, code: fc, name: coaMap.get(fc)!.name };
        }
      }
      return null;
    };

    const acc1121 = getAccountId('1121');
    const acc1111 = getAccountId('1111');
    const acc131 = getAccountId('131');
    const acc331 = getAccountId('331');
    const acc1331 = getAccountId('1331', ['133']);
    const acc33311 = getAccountId('33311', ['3331']);
    const accT0001 = getAccountId('T0001', ['0001', 'T000', '000']);
    const accT0002 = getAccountId('T0002', ['0002', 'T000', '000']);
    const accT0003 = getAccountId('T0003', ['0003', 'T000', '000']);

    console.log('📌 Mapping tài khoản:');
    console.log(` - Tiền gửi (1121): ${acc1121 ? acc1121.code : '❌ THIẾU'}`);
    console.log(` - Tiền mặt (1111): ${acc1111 ? acc1111.code : '❌ THIẾU'}`);
    console.log(` - Phải thu KH (131): ${acc131 ? acc131.code : '❌ THIẾU'}`);
    console.log(` - Phải trả NCC (331): ${acc331 ? acc331.code : '❌ THIẾU'}`);
    console.log(` - Thuế GTGT vào (1331): ${acc1331 ? acc1331.code : '❌ THIẾU'}`);
    console.log(` - Thuế GTGT ra (33311): ${acc33311 ? acc33311.code : '❌ THIẾU'}`);
    console.log(` - Treo Sao kê (T0001): ${accT0001 ? accT0001.code : '❌ THIẾU'}`);
    console.log(` - Treo HĐ Bán (T0002): ${accT0002 ? accT0002.code : '❌ THIẾU'}`);
    console.log(` - Treo HĐ Mua (T0003): ${accT0003 ? accT0003.code : '❌ THIẾU'}\n`);

    if (!acc131 || !acc331 || !accT0001 || !accT0002 || !accT0003) {
      console.error('❌ Thiếu tài khoản trung gian hoặc tài khoản công nợ cơ bản. Vui lòng chạy migration tạo tài khoản trước.');
      process.exit(1);
    }

    // 2. Tra cứu chi nhánh mặc định nếu chứng từ thiếu branchId
    const branchRes = await client.query(
      `SELECT id, name FROM erp_branches WHERE is_active = true ORDER BY id ASC LIMIT 1`
    );
    const defaultBranchId = branchRes.rows.length > 0 ? branchRes.rows[0].id : null;
    if (!defaultBranchId) {
      console.error('❌ Không tìm thấy chi nhánh hợp lệ nào trong hệ thống!');
      process.exit(1);
    }

    // 3. Quét các bút toán lịch sử đã tồn tại để KHÔNG BAO GIỜ ghi đè
    const existingEntriesRes = await client.query(
      `SELECT DISTINCT source_id, source_type FROM erp_journal_entries WHERE is_deleted = false`
    );
    const postedSourceIds = new Set<string>();
    for (const r of existingEntriesRes.rows) {
      if (r.source_id) postedSourceIds.add(`${r.source_type}:${r.source_id}`);
    }
    console.log(`🔒 Bút toán đã tồn tại trong DB: ${postedSourceIds.size} chứng từ (sẽ bảo toàn nguyên vẹn, không ghi đè)\n`);

    // 4. Quét Hóa đơn từ fromDate
    console.log('📋 Đang quét danh sách Hóa đơn từ 2025...');
    let invoiceQuery = `
      SELECT id, invoice_no, serial_no, direction, invoice_date, total_amount, vat_amount, pre_vat_amount, 
             seller_name, buyer_name, branch_id, description, posting_status
      FROM erp_invoices
      WHERE is_deleted = false AND invoice_date >= $1
    `;
    const invoiceParams: any[] = [fromDate];
    if (toDate) {
      invoiceQuery += ` AND invoice_date <= $2`;
      invoiceParams.push(toDate);
    }
    invoiceQuery += ` ORDER BY invoice_date ASC, id ASC`;

    const invoiceRes = await client.query(invoiceQuery, invoiceParams);
    console.log(`📊 Tìm thấy ${invoiceRes.rows.length} hóa đơn trong kỳ.`);

    // 5. Quét Sao kê từ fromDate
    console.log('💳 Đang quét danh sách Giao dịch Sao kê & Sổ quỹ từ 2025...');
    let txnQuery = `
      SELECT t.id, t.source_type, t.trans_date, t.debit_amount, t.credit_amount, 
             t.description, t.accounting_description, t.reference_number, t.correspondent_name,
             t.branch_id, t.correspondent_accounting_account_id,
             ba.accounting_account_id as bank_accounting_account_id,
             cb.accounting_account_id as cash_accounting_account_id
      FROM erp_bank_transactions t
      LEFT JOIN erp_bank_accounts ba ON ba.id = t.bank_account_id AND ba.is_deleted = false
      LEFT JOIN erp_cash_books cb ON cb.id = t.cash_book_id AND cb.is_deleted = false
      WHERE t.is_deleted = false AND t.trans_date >= $1
    `;
    const txnParams: any[] = [fromDate];
    if (toDate) {
      txnQuery += ` AND t.trans_date <= $2`;
      txnParams.push(toDate);
    }
    txnQuery += ` ORDER BY t.trans_date ASC, t.id ASC`;

    const txnRes = await client.query(txnQuery, txnParams);
    console.log(`📊 Tìm thấy ${txnRes.rows.length} giao dịch sao kê/sổ quỹ trong kỳ.`);

    // 6. Quét toàn bộ Net-Off đã liên kết
    console.log('🔗 Đang nạp liên kết Cấn trừ (Net-Off) hiện có...');
    const netoffRes = await client.query(
      `SELECT n.id, n.bank_transaction_id, n.invoice_id, n.net_off_amount, 
              i.direction, i.seller_name, i.buyer_name, i.invoice_no, i.serial_no, i.branch_id as invoice_branch_id
       FROM erp_invoice_voucher_netoff n
       JOIN erp_invoices i ON i.id = n.invoice_id AND i.is_deleted = false
       ORDER BY n.created_at ASC`
    );
    const netoffByTxn = new Map<string, any[]>();
    for (const no of netoffRes.rows) {
      if (!netoffByTxn.has(no.bank_transaction_id)) {
        netoffByTxn.set(no.bank_transaction_id, []);
      }
      netoffByTxn.get(no.bank_transaction_id)!.push(no);
    }
    console.log(`🔗 Tổng cộng ${netoffRes.rows.length} bản ghi cấn trừ đã ghi nhận.\n`);

    // 7. Mô phỏng & Tổng hợp Hạch toán
    const accountTotals = new Map<string, { code: string; name: string; debit: number; credit: number }>();
    const addPosting = (acc: { id: string; code: string; name: string }, debit: number, credit: number) => {
      if (!accountTotals.has(acc.code)) {
        accountTotals.set(acc.code, { code: acc.code, name: acc.name, debit: 0, credit: 0 });
      }
      const item = accountTotals.get(acc.code)!;
      item.debit += debit;
      item.credit += credit;
    };

    let countInvoicePosted = 0;
    let countInvoiceSkipped = 0;
    let countTxnPosted = 0;
    let countTxnSkipped = 0;

    interface PendingEntry {
      entryNo: string;
      branchId: string;
      date: Date;
      documentDate: Date;
      description: string;
      subjectName?: string;
      sourceType: string;
      sourceId: string;
      reference?: string;
      lines: { accountId: string; debit: number; credit: number; description: string }[];
    }
    const pendingEntries: PendingEntry[] = [];
    const invoicesToMarkPosted: string[] = [];

    // Helper tạo entryNo
    let seqInvoiceIn = 1;
    let seqInvoiceOut = 1;
    let seqBank = 1;
    let seqCash = 1;

    // A. Xử lý Hóa đơn
    for (const inv of invoiceRes.rows) {
      const sourceKey = `INVOICE:${inv.id}`;
      if (postedSourceIds.has(sourceKey)) {
        countInvoiceSkipped++;
        continue;
      }

      const totalAmount = Number(inv.total_amount) || 0;
      const vatAmount = Math.max(0, Number(inv.vat_amount) || 0);
      const preTaxAmount = Math.max(0, totalAmount - vatAmount);
      const branchId = inv.branch_id || defaultBranchId;
      const docDate = new Date(inv.invoice_date);

      if (totalAmount <= 0) {
        countInvoiceSkipped++;
        continue;
      }

      if (inv.direction === 'IN') {
        // Mua vào: Nợ T0003 (tiền hàng) + Nợ 1331 (thuế) / Có 331 (tổng tiền)
        const lines: { accountId: string; debit: number; credit: number; description: string }[] = [];
        const desc = `HĐ Mua vào số ${inv.invoice_no || ''} - ${inv.seller_name || ''}`;

        if (preTaxAmount > 0) {
          lines.push({ accountId: accT0003.id, debit: preTaxAmount, credit: 0, description: desc });
          addPosting(accT0003, preTaxAmount, 0);
        }
        if (vatAmount > 0 && acc1331) {
          lines.push({ accountId: acc1331.id, debit: vatAmount, credit: 0, description: `${desc} (Thuế GTGT)` });
          addPosting(acc1331, vatAmount, 0);
        } else if (vatAmount > 0) {
          lines.push({ accountId: accT0003.id, debit: vatAmount, credit: 0, description: `${desc} (Thuế GTGT gộp)` });
          addPosting(accT0003, vatAmount, 0);
        }

        lines.push({ accountId: acc331.id, debit: 0, credit: totalAmount, description: desc });
        addPosting(acc331, 0, totalAmount);

        const entryNo = `HĐM-${inv.invoice_date ? String(inv.invoice_date).slice(0, 10).replace(/-/g, '') : '2025'}-${String(seqInvoiceIn++).padStart(4, '0')}`;
        pendingEntries.push({
          entryNo,
          branchId,
          date: docDate,
          documentDate: docDate,
          description: desc,
          subjectName: inv.seller_name || undefined,
          sourceType: 'INVOICE',
          sourceId: inv.id,
          reference: inv.invoice_no,
          lines,
        });
        invoicesToMarkPosted.push(inv.id);
        countInvoicePosted++;
      } else if (inv.direction === 'OUT') {
        // Bán ra: Nợ 131 (tổng tiền) / Có T0002 (doanh thu treo) + Có 33311 (thuế)
        const lines: { accountId: string; debit: number; credit: number; description: string }[] = [];
        const desc = `HĐ Bán ra số ${inv.invoice_no || ''} - ${inv.buyer_name || ''}`;

        lines.push({ accountId: acc131.id, debit: totalAmount, credit: 0, description: desc });
        addPosting(acc131, totalAmount, 0);

        if (preTaxAmount > 0) {
          lines.push({ accountId: accT0002.id, debit: 0, credit: preTaxAmount, description: desc });
          addPosting(accT0002, 0, preTaxAmount);
        }
        if (vatAmount > 0 && acc33311) {
          lines.push({ accountId: acc33311.id, debit: 0, credit: vatAmount, description: `${desc} (Thuế GTGT)` });
          addPosting(acc33311, 0, vatAmount);
        } else if (vatAmount > 0) {
          lines.push({ accountId: accT0002.id, debit: 0, credit: vatAmount, description: `${desc} (Thuế GTGT gộp)` });
          addPosting(accT0002, 0, vatAmount);
        }

        const entryNo = `HĐB-${inv.invoice_date ? String(inv.invoice_date).slice(0, 10).replace(/-/g, '') : '2025'}-${String(seqInvoiceOut++).padStart(4, '0')}`;
        pendingEntries.push({
          entryNo,
          branchId,
          date: docDate,
          documentDate: docDate,
          description: desc,
          subjectName: inv.buyer_name || undefined,
          sourceType: 'INVOICE',
          sourceId: inv.id,
          reference: inv.invoice_no,
          lines,
        });
        invoicesToMarkPosted.push(inv.id);
        countInvoicePosted++;
      }
    }

    // B. Xử lý Sao kê & Sổ quỹ
    for (const txn of txnRes.rows) {
      const sourceKey = `${txn.source_type}:${txn.id}`;
      if (postedSourceIds.has(sourceKey)) {
        countTxnSkipped++;
        continue;
      }

      const isReceipt = Number(txn.credit_amount) > 0;
      const totalAmount = isReceipt ? Number(txn.credit_amount) : Number(txn.debit_amount);
      if (totalAmount <= 0) {
        countTxnSkipped++;
        continue;
      }

      const branchId = txn.branch_id || defaultBranchId;
      const docDate = new Date(txn.trans_date);
      const baseDesc = txn.accounting_description || txn.description || 'Giao dịch ngân hàng';

      // Xác định tài khoản tiền
      let moneyAccount = acc1121;
      if (txn.source_type === 'BANK') {
        const explicitId = txn.bank_accounting_account_id;
        if (explicitId) {
          const matched = Array.from(coaMap.entries()).find(([_, v]) => v.id === explicitId);
          if (matched) moneyAccount = { id: explicitId, code: matched[0], name: matched[1].name };
        }
      } else if (txn.source_type === 'CASH') {
        moneyAccount = acc1111;
        const explicitId = txn.cash_accounting_account_id;
        if (explicitId) {
          const matched = Array.from(coaMap.entries()).find(([_, v]) => v.id === explicitId);
          if (matched) moneyAccount = { id: explicitId, code: matched[0], name: matched[1].name };
        }
      }

      if (!moneyAccount) {
        countTxnSkipped++;
        continue;
      }

      // Xác định đối ứng (net-off hoặc T0001)
      const linkedNetOffs = netoffByTxn.get(txn.id) || [];
      const defaultCounterpart = txn.correspondent_accounting_account_id
        ? { id: txn.correspondent_accounting_account_id, code: 'CORRESPONDENT', name: 'Đối ứng chọn tay' }
        : accT0001;

      if (linkedNetOffs.length === 0) {
        // Chưa netoff -> Nợ Tiền / Có T0001 (hoặc ngược lại)
        const debitAcc = isReceipt ? moneyAccount : defaultCounterpart;
        const creditAcc = isReceipt ? defaultCounterpart : moneyAccount;

        addPosting(debitAcc, totalAmount, 0);
        addPosting(creditAcc, 0, totalAmount);

        const prefix = txn.source_type === 'BANK' ? (isReceipt ? 'UNT' : 'UNC') : (isReceipt ? 'PT' : 'PC');
        const entryNo = `${prefix}-${String(txn.trans_date).slice(0, 10).replace(/-/g, '')}-${String(txn.source_type === 'BANK' ? seqBank++ : seqCash++).padStart(4, '0')}`;

        pendingEntries.push({
          entryNo,
          branchId,
          date: docDate,
          documentDate: docDate,
          description: baseDesc,
          subjectName: txn.correspondent_name || undefined,
          sourceType: txn.source_type,
          sourceId: txn.id,
          reference: txn.reference_number,
          lines: [
            { accountId: debitAcc.id, debit: totalAmount, credit: 0, description: baseDesc },
            { accountId: creditAcc.id, debit: 0, credit: totalAmount, description: baseDesc },
          ],
        });
        countTxnPosted++;
      } else {
        // Đã có netoff -> Phân bổ theo từng dòng net-off
        let netOffTotal = 0;
        let subIndex = 0;
        for (const no of linkedNetOffs) {
          const noAmount = Number(no.net_off_amount) || 0;
          if (noAmount <= 0) continue;
          netOffTotal += noAmount;

          const counterpartAcc = no.direction === 'IN' ? acc331 : acc131;
          const debitAcc = isReceipt ? moneyAccount : counterpartAcc;
          const creditAcc = isReceipt ? counterpartAcc : moneyAccount;

          addPosting(debitAcc, noAmount, 0);
          addPosting(creditAcc, 0, noAmount);

          const subject = no.direction === 'IN' ? no.seller_name : no.buyer_name;
          const invRef = no.serial_no ? `${no.invoice_no}-${no.serial_no}` : no.invoice_no;
          const lineDesc = `${invRef ? `${invRef} - ` : ''}${baseDesc}`;

          const prefix = txn.source_type === 'BANK' ? (isReceipt ? 'UNT' : 'UNC') : (isReceipt ? 'PT' : 'PC');
          const entryNo = `${prefix}-${String(txn.trans_date).slice(0, 10).replace(/-/g, '')}-${String(txn.source_type === 'BANK' ? seqBank++ : seqCash++).padStart(4, '0')}${subIndex > 0 ? String.fromCharCode(97 + subIndex) : ''}`;
          subIndex++;

          pendingEntries.push({
            entryNo,
            branchId,
            date: docDate,
            documentDate: docDate,
            description: lineDesc,
            subjectName: subject || txn.correspondent_name || undefined,
            sourceType: txn.source_type,
            sourceId: txn.id,
            reference: txn.reference_number,
            lines: [
              { accountId: debitAcc.id, debit: noAmount, credit: 0, description: lineDesc },
              { accountId: creditAcc.id, debit: 0, credit: noAmount, description: lineDesc },
            ],
          });
        }

        // Phần dư nếu còn
        const remaining = Math.round((totalAmount - netOffTotal) * 100) / 100;
        if (remaining > 0.01) {
          const debitAcc = isReceipt ? moneyAccount : defaultCounterpart;
          const creditAcc = isReceipt ? defaultCounterpart : moneyAccount;

          addPosting(debitAcc, remaining, 0);
          addPosting(creditAcc, 0, remaining);

          const prefix = txn.source_type === 'BANK' ? (isReceipt ? 'UNT' : 'UNC') : (isReceipt ? 'PT' : 'PC');
          const entryNo = `${prefix}-${String(txn.trans_date).slice(0, 10).replace(/-/g, '')}-${String(txn.source_type === 'BANK' ? seqBank++ : seqCash++).padStart(4, '0')}${String.fromCharCode(97 + subIndex)}`;

          pendingEntries.push({
            entryNo,
            branchId,
            date: docDate,
            documentDate: docDate,
            description: `${baseDesc} (Phần còn lại chưa netoff)`,
            subjectName: txn.correspondent_name || undefined,
            sourceType: txn.source_type,
            sourceId: txn.id,
            reference: txn.reference_number,
            lines: [
              { accountId: debitAcc.id, debit: remaining, credit: 0, description: baseDesc },
              { accountId: creditAcc.id, debit: 0, credit: remaining, description: baseDesc },
            ],
          });
        }
        countTxnPosted++;
      }
    }

    // 8. Báo cáo Tổng hợp & Cân đối Kế toán (Audit Verification)
    console.log('\n===============================================================');
    console.log('📊 BÁO CÁO KIỂM TOÁN TỔNG HỢP PHÁT SINH (AUDIT SUMMARY)');
    console.log('===============================================================');
    console.log(`- Tổng Hóa đơn dự kiến hạch toán: ${countInvoicePosted} (Bỏ qua: ${countInvoiceSkipped})`);
    console.log(`- Tổng Giao dịch Sao kê dự kiến hạch toán: ${countTxnPosted} (Bỏ qua: ${countTxnSkipped})`);
    console.log(`- Tổng Bút toán Nhật ký chung sẽ sinh: ${pendingEntries.length}`);
    console.log('---------------------------------------------------------------');
    console.log('MÃ TK  | TÊN TÀI KHOẢN                     | TỔNG PHÁT SINH NỢ    | TỔNG PHÁT SINH CÓ');
    console.log('-------+----------------------------------+----------------------+----------------------');

    let grandTotalDebit = 0;
    let grandTotalCredit = 0;

    const sortedAccounts = Array.from(accountTotals.values()).sort((a, b) => a.code.localeCompare(b.code));
    for (const acc of sortedAccounts) {
      grandTotalDebit += acc.debit;
      grandTotalCredit += acc.credit;
      const formattedDebit = acc.debit.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
      const formattedCredit = acc.credit.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
      console.log(
        `${acc.code.padEnd(6)} | ${acc.name.slice(0, 32).padEnd(32)} | ${formattedDebit.padStart(20)} | ${formattedCredit.padStart(20)}`
      );
    }

    console.log('-------+----------------------------------+----------------------+----------------------');
    const grandDebitStr = grandTotalDebit.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    const grandCreditStr = grandTotalCredit.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    console.log(
      `TỔNG   | TOÀN BỘ HỆ THỐNG                 | ${grandDebitStr.padStart(20)} | ${grandCreditStr.padStart(20)}`
    );

    const delta = Math.abs(grandTotalDebit - grandTotalCredit);
    console.log(`\n⚖️ ĐỘ LỆCH CÂN ĐỐI (DELTA): ${delta.toFixed(4)} VNĐ`);
    if (delta < 0.01) {
      console.log('✅ TUYỆT VỜI: TỔNG NỢ = TỔNG CÓ (CÂN ĐỐI 100% THEO CHUẨN KẾ TOÁN KÉP)');
    } else {
      console.error('❌ CẢNH BÁO: TỔNG NỢ KHÁC TỔNG CÓ! Cần kiểm tra lại trước khi thực thi!');
      if (isExecute) {
        console.error('⛔ Huỷ lệnh execute vì phát hiện mất cân đối kế toán!');
        process.exit(1);
      }
    }

    // 9. THỰC THI GHI VÀO DATABASE (Nếu có cờ --execute)
    if (isExecute) {
      console.log('\n===============================================================');
      console.log('⚡ BẮT ĐẦU THỰC THI GHI BÚT TOÁN VÀO DATABASE PRODUCTION...');
      console.log('===============================================================');

      await client.query('BEGIN');

      const batchInsertSize = 500;
      let insertedEntries = 0;

      for (let i = 0; i < pendingEntries.length; i += batchInsertSize) {
        const batch = pendingEntries.slice(i, i + batchInsertSize);
        for (const entry of batch) {
          // Insert journal entry
          const jeRes = await client.query(
            `INSERT INTO erp_journal_entries 
              (entry_no, branch_id, date, document_date, description, subject_name, source_type, source_id, reference, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
             RETURNING id`,
            [
              entry.entryNo,
              entry.branchId,
              entry.date,
              entry.documentDate,
              entry.description,
              entry.subjectName,
              entry.sourceType,
              entry.sourceId,
              entry.reference,
            ]
          );
          const jeId = jeRes.rows[0].id;

          // Insert lines
          for (let lineIndex = 0; lineIndex < entry.lines.length; lineIndex++) {
            const line = entry.lines[lineIndex];
            await client.query(
              `INSERT INTO erp_journal_entry_lines
                (journal_entry_id, account_id, debit, credit, description, line_order, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
              [jeId, line.accountId, line.debit, line.credit, line.description, lineIndex + 1]
            );
          }
          insertedEntries++;
        }
        console.log(`⏳ Đã ghi ${insertedEntries}/${pendingEntries.length} bút toán...`);
      }

      // Đánh dấu Hóa đơn đã POSTED
      if (invoicesToMarkPosted.length > 0) {
        console.log(`📝 Cập nhật trạng thái POSTED cho ${invoicesToMarkPosted.length} hóa đơn...`);
        for (let i = 0; i < invoicesToMarkPosted.length; i += 1000) {
          const chunk = invoicesToMarkPosted.slice(i, i + 1000);
          await client.query(
            `UPDATE erp_invoices SET posting_status = 'POSTED', updated_at = NOW() WHERE id = ANY($1::uuid[])`,
            [chunk]
          );
        }
      }

      await client.query('COMMIT');
      console.log('🎉 THÀNH CÔNG: Đã hạch toán toàn bộ số liệu lịch sử từ 2025 vào Nhật ký chung!');
    } else {
      console.log('\n💡 ĐÂY LÀ CHẾ ĐỘ DRY-RUN. Không có bất kỳ dữ liệu nào bị thay đổi trong database.');
      console.log('👉 Để thực thi ghi thật vào DB, hãy chạy lại với cờ: --execute');
    }

  } catch (error) {
    if (isExecute) {
      await client.query('ROLLBACK');
    }
    console.error('❌ LỖI TRONG QUÁ TRÌNH XỬ LÝ:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Load config from .env.greenway-production
const envCandidates = [
  path.resolve(__dirname, '../../../.env.greenway-production'),
  path.resolve(process.cwd(), '.env.greenway-production'),
  '/home/dev/repos/erp/erp-api/.env.greenway-production',
];

let dbUrl = process.env.DATABASE_URL;

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/^DATABASE_URL=(.+)$/m);
    if (match) {
      dbUrl = match[1].trim();
      break;
    }
  }
}

if (!dbUrl) {
  console.error(
    'DATABASE_URL not found in environment or .env.greenway-production',
  );
  process.exit(1);
}

export interface ExactMatchItem {
  topology: 'TOPOLOGY_1_1' | 'TOPOLOGY_N_1' | 'TOPOLOGY_1_N';
  groupKey: 'GROUP_4_INSURANCE' | 'GROUP_5_SME_RETAIL';
  partnerBrand: string;
  score: number;
  matchSignals: string;

  // Invoice Info
  invoiceId: string;
  invoiceNo: string;
  serialNo: string;
  invoiceDate: string;
  branchName: string;
  buyerName: string;
  buyerTaxCode: string;
  licensePlate: string;
  settlementOrder: string;
  invoiceTotalAmount: number;
  invoiceRemainingAmount: number;
  netOffAmount: number;

  // Bank Transaction Info
  bankTxnId: string;
  transDate: string;
  bankOrCash: string;
  accountNumber: string;
  referenceNumber: string;
  creditAmount: number;
  txnRemainingAmount: number;
  correspondentName: string;
  description: string;
}

export function cleanPlate(p: string | null | undefined): string {
  if (!p) return '';
  return p.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

export function extractPlatesFromText(text: string): string[] {
  if (!text) return [];
  // Tiền xử lý các số đơn lẻ bị cách bởi khoảng trắng do lỗi wrap text ngân hàng (ví dụ: "50H-410.4 7" -> "50H-410.47")
  const normalized = text.replace(
    /([0-9]{2}[A-Z]{1,2}[-.\s]?[0-9]{3}[-.]?[0-9])\s+([0-9])\b/gi,
    '$1$2',
  );

  const results: string[] = [];

  // Cách 1: Tokenize
  const tokens = normalized.split(/[\s,;:|()/-]+/);
  for (const token of tokens) {
    const cleaned = cleanPlate(token);
    if (/^[0-9]{2}[A-Z]{1,2}[0-9]{4,5}$/.test(cleaned)) {
      results.push(cleaned);
    }
  }

  // Cách 2: Bắt token liền kề
  for (let i = 0; i < tokens.length - 1; i++) {
    const combined = cleanPlate(tokens[i] + tokens[i + 1]);
    if (/^[0-9]{2}[A-Z]{1,2}[0-9]{4,5}$/.test(combined)) {
      results.push(combined);
    }
  }

  return Array.from(new Set(results));
}

export function isInternalTransfer(desc: string, corrName: string): boolean {
  const combined = (desc + ' ' + (corrName || '')).toLowerCase();
  return (
    combined.includes('chuyen von noi bo') ||
    combined.includes('chuyển vốn nội bộ') ||
    combined.includes('rut von') ||
    combined.includes('rút vốn') ||
    combined.includes('nop tien mat vao tk') ||
    combined.includes('nộp tiền mặt vào tk') ||
    combined.includes('thanh toan luong') ||
    combined.includes('thanh toán lương')
  );
}

export async function runExactNetoffSimulation(
  client: Client,
  startDate = '2025-10-01',
  endDate = '2026-09-30',
): Promise<{ matches: ExactMatchItem[]; complexCases: any[] }> {
  // 1. Query all valid OUT invoices with remaining balance
  const invsRes = await client.query(
    `
    WITH inv_classified AS (
      SELECT 
        inv.id,
        inv.invoice_no,
        inv.serial_no,
        inv.invoice_date,
        inv.buyer_name,
        inv.buyer_personal_name,
        inv.buyer_tax_code,
        inv.buyer_cccd,
        inv.license_plate,
        inv.settlement_order,
        inv.total_amount,
        inv.tax_invoice_status,
        inv.branch_id,
        b.name as branch_name,
        COALESCE(SUM(no.net_off_amount), 0) as already_netoff,
        (inv.total_amount - COALESCE(SUM(no.net_off_amount), 0)) as remaining_amount,
        CASE 
          WHEN (inv.buyer_name ILIKE '%VINFAST%' OR COALESCE(inv.buyer_personal_name, '') ILIKE '%VINFAST%') THEN 'GROUP_3_VINFAST'
          WHEN (inv.buyer_name ILIKE '%GSM%' OR inv.buyer_name ILIKE '%DI CHUYEN XANH%') THEN 'GROUP_2_GSM'
          WHEN (
            inv.buyer_name ~* 'bảo hiểm|pjico|bảo việt|bao viet|mic|dbv|bảo minh|bao minh|bảo long|bao long|pvi|pti|vbi|bsh|uic|tasco|liberty|hàng không|vietinbank|bưu điện|techcom'
            OR COALESCE(inv.description, '') ~* 'bảo hiểm|pjico|bảo việt|bao viet|mic|dbv|bảo minh|bao minh|bảo long|bao long|pvi|pti|vbi|bsh|uic|tasco|liberty|hàng không|vietinbank|bưu điện|techcom'
          ) THEN 'GROUP_4_INSURANCE'
          ELSE 'GROUP_5_SME_RETAIL'
        END as group_key
      FROM erp_invoices inv
      LEFT JOIN erp_branches b ON inv.branch_id = b.id
      LEFT JOIN erp_invoice_voucher_netoff no ON no.invoice_id = inv.id
      WHERE inv.direction = 'OUT'
        AND inv.is_deleted = false
        AND inv.status != 'CANCELLED'
        AND inv.tax_invoice_status IN (1, 2)
        AND inv.invoice_date >= $1 AND inv.invoice_date <= $2
      GROUP BY inv.id, b.name
      HAVING (inv.total_amount - COALESCE(SUM(no.net_off_amount), 0)) > 0
      ORDER BY inv.invoice_date ASC, inv.invoice_no ASC
    )
    SELECT * FROM inv_classified
    WHERE group_key = 'GROUP_4_INSURANCE' OR group_key = 'GROUP_5_SME_RETAIL'
  `,
    [startDate, endDate],
  );

  // 2. Query all incoming bank transactions with remaining balance
  const txnsRes = await client.query(
    `
    SELECT 
      txn.id,
      (txn.trans_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh') as trans_date,
      txn.reference_number,
      txn.seq_no,
      txn.description,
      txn.credit_amount,
      txn.correspondent_name,
      txn.correspondent_account,
      ba.bank_name,
      ba.account_number,
      cb.name as cash_book_name,
      COALESCE(SUM(no.net_off_amount), 0) as used_netoff,
      (txn.credit_amount - COALESCE(SUM(no.net_off_amount), 0)) as remaining_amount
    FROM erp_bank_transactions txn
    LEFT JOIN erp_bank_accounts ba ON txn.bank_account_id = ba.id
    LEFT JOIN erp_cash_books cb ON txn.cash_book_id = cb.id
    LEFT JOIN erp_invoice_voucher_netoff no ON no.bank_transaction_id = txn.id
    WHERE txn.is_deleted = false
      AND txn.credit_amount > 0
      AND (txn.trans_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date >= $1::date
      AND (txn.trans_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= $2::date
    GROUP BY txn.id, ba.bank_name, ba.account_number, cb.name
    HAVING (txn.credit_amount - COALESCE(SUM(no.net_off_amount), 0)) > 0
    ORDER BY txn.trans_date ASC
  `,
    [startDate, endDate],
  );

  const invoices = invsRes.rows;
  const txns = txnsRes.rows;

  const matches: ExactMatchItem[] = [];
  const usedInvIds = new Set<string>();
  const usedTxnTracker = new Map<string, number>();

  // =========================================================================
  // TOPOLOGY 2: NHIỀU HÓA ĐƠN - 1 SAO KÊ GỘP (N - 1 = 100% TIỀN BỒI THƯỜNG / LÔ)
  // =========================================================================
  for (const txn of txns) {
    const curUsed = usedTxnTracker.get(txn.id) || 0;
    const txnRemaining = parseFloat(txn.remaining_amount) - curUsed;
    if (txnRemaining <= 0) continue;

    const desc = (txn.description || '').toUpperCase();
    const corr = (txn.correspondent_name || '').toUpperCase();
    if (isInternalTransfer(desc, corr)) continue;

    const platesInTxn = extractPlatesFromText(desc + ' ' + corr);
    if (platesInTxn.length === 0) continue;

    // Tìm các HĐ chưa khớp có BSX nằm trong trích yếu giao dịch
    const candidateInvs = invoices.filter((inv) => {
      if (usedInvIds.has(inv.id)) return false;
      const plate = cleanPlate(inv.license_plate);
      return plate && platesInTxn.includes(plate);
    });

    if (candidateInvs.length >= 2) {
      const sumInv = candidateInvs.reduce(
        (sum, inv) => sum + parseFloat(inv.remaining_amount),
        0,
      );
      if (Math.abs(sumInv - txnRemaining) < 1.0) {
        // Khớp chính xác 100% tổng tiền lô N-1
        let partnerBrand = 'BẢO HIỂM / KHÁCH LÔ';
        if (
          desc.includes('PVI') ||
          candidateInvs[0].buyer_name?.includes('PVI')
        )
          partnerBrand = 'PVI';
        else if (
          desc.includes('PJICO') ||
          candidateInvs[0].buyer_name?.includes('PJICO')
        )
          partnerBrand = 'PJICO';
        else if (
          desc.includes('BSH') ||
          candidateInvs[0].buyer_name?.includes('BSH')
        )
          partnerBrand = 'BSH';
        else if (
          desc.includes('BAO VIET') ||
          candidateInvs[0].buyer_name?.includes('BẢO VIỆT')
        )
          partnerBrand = 'BẢO VIỆT';

        for (const inv of candidateInvs) {
          const invRem = parseFloat(inv.remaining_amount);
          matches.push({
            topology: 'TOPOLOGY_N_1',
            groupKey: inv.group_key,
            partnerBrand,
            score: 100,
            matchSignals: `Khớp Lô Bồi Thường Gộp (${candidateInvs.length} xe: ${platesInTxn.join(', ')}) + 100% Tổng Tiền (${sumInv.toLocaleString()} đ)`,
            invoiceId: inv.id,
            invoiceNo: inv.invoice_no,
            serialNo: inv.serial_no || '',
            invoiceDate: inv.invoice_date
              ? new Date(inv.invoice_date).toISOString().substring(0, 10)
              : '',
            branchName: inv.branch_name || 'Nam Sài Gòn',
            buyerName: inv.buyer_name || inv.buyer_personal_name || 'Khách lẻ',
            buyerTaxCode: inv.buyer_tax_code || '',
            licensePlate: inv.license_plate || '',
            settlementOrder: inv.settlement_order || '',
            invoiceTotalAmount: parseFloat(inv.total_amount),
            invoiceRemainingAmount: invRem,
            netOffAmount: invRem,
            bankTxnId: txn.id,
            transDate: txn.trans_date
              ? new Date(txn.trans_date).toISOString().substring(0, 10)
              : '',
            bankOrCash: txn.bank_name || txn.cash_book_name || 'Ngân hàng',
            accountNumber: txn.account_number || '',
            referenceNumber: txn.reference_number || '',
            creditAmount: parseFloat(txn.credit_amount),
            txnRemainingAmount: txnRemaining,
            correspondentName: txn.correspondent_name || '',
            description: txn.description || '',
          });
          usedInvIds.add(inv.id);
        }
        usedTxnTracker.set(txn.id, curUsed + sumInv);
      }
    }
  }

  // =========================================================================
  // TOPOLOGY 1: KHỚP ĐƠN LẺ 1 - 1 (1 HĐ : 1 SAO KÊ = 100% TIỀN) VỚI DISAMBIGUATION
  // =========================================================================
  for (const inv of invoices) {
    if (usedInvIds.has(inv.id)) continue;
    const invRemaining = parseFloat(inv.remaining_amount);
    const invPlate = cleanPlate(inv.license_plate);
    const invNo = (inv.invoice_no || '').trim();
    const invDate = inv.invoice_date ? new Date(inv.invoice_date).getTime() : 0;
    const buyerName = (inv.buyer_name || inv.buyer_personal_name || '').trim();

    // 1. Tìm tất cả các giao dịch sao kê có số tiền khớp chính xác 100%
    const candidateTxns = txns.filter((txn) => {
      const curUsed = usedTxnTracker.get(txn.id) || 0;
      const txnRemain = parseFloat(txn.remaining_amount) - curUsed;
      if (txnRemain <= 0) return false;
      return Math.abs(txnRemain - invRemaining) < 1.0;
    });

    if (candidateTxns.length === 0) continue;

    // Áp dụng Quy trình Phân định Đa tầng (Multi-Tier Disambiguation)
    let qualifiedMatches: {
      txn: any;
      score: number;
      signals: string[];
      partnerBrand: string;
    }[] = [];

    for (const txn of candidateTxns) {
      const desc = (txn.description || '').toUpperCase();
      const corr = (txn.correspondent_name || '').toUpperCase();
      if (isInternalTransfer(desc, corr)) continue;

      const signals: string[] = [];
      let score = 0;
      let partnerBrand =
        inv.group_key === 'GROUP_4_INSURANCE' ? 'BẢO HIỂM' : 'SME / KHÁCH LẺ';

      // 1. Hard Identifiers (Biển số xe, Số HĐ, Mã Lệnh SC)
      const descClean = desc.replace(/[^A-Z0-9]/g, '');
      const platesInTxn = extractPlatesFromText(desc + ' ' + corr);

      if (
        invPlate &&
        invPlate.length >= 5 &&
        (platesInTxn.includes(invPlate) ||
          desc.includes(invPlate) ||
          descClean.includes(invPlate))
      ) {
        signals.push(`Khớp BSX: ${inv.license_plate}`);
        score += 50;
      }

      if (
        invNo &&
        (desc.includes(`HD ${invNo}`) ||
          desc.includes(`HD${invNo}`) ||
          desc.includes(`HĐ ${invNo}`) ||
          desc.includes(`HĐ${invNo}`))
      ) {
        signals.push(`Khớp Số HĐ: ${invNo}`);
        score += 40;
      }

      if (
        inv.settlement_order &&
        inv.settlement_order.length >= 4 &&
        desc.includes(inv.settlement_order.toUpperCase())
      ) {
        signals.push(`Khớp Lệnh SC: ${inv.settlement_order}`);
        score += 40;
      }

      // 2. Partner Matching
      if (buyerName) {
        const buyerUpper = buyerName.toUpperCase();
        if (
          buyerUpper.includes('PJICO') &&
          (desc.includes('PJICO') || corr.includes('PJICO'))
        ) {
          signals.push('Khớp Hãng: PJICO');
          score += 30;
          partnerBrand = 'PJICO';
        } else if (
          (buyerUpper.includes('BẢO VIỆT') ||
            buyerUpper.includes('BAO VIET')) &&
          (desc.includes('BAO VIET') || desc.includes('BCIN'))
        ) {
          signals.push('Khớp Hãng: BẢO VIỆT');
          score += 30;
          partnerBrand = 'BẢO VIỆT';
        } else if (
          buyerUpper.includes('MIC') &&
          (desc.includes('MIC') || corr.includes('MIC'))
        ) {
          signals.push('Khớp Hãng: MIC');
          score += 30;
          partnerBrand = 'MIC';
        } else if (
          buyerUpper.includes('DBV') &&
          (desc.includes('DBV') || corr.includes('DBV'))
        ) {
          signals.push('Khớp Hãng: DBV');
          score += 30;
          partnerBrand = 'DBV';
        } else if (
          buyerUpper.includes('TECHCOM') &&
          (desc.includes('TCBI') || desc.includes('TECHCOM'))
        ) {
          signals.push('Khớp Hãng: TECHCOM (TCBI)');
          score += 30;
          partnerBrand = 'TECHCOM TCBI';
        } else if (
          buyerUpper.includes('PVI') &&
          (desc.includes('PVI') || corr.includes('PVI'))
        ) {
          signals.push('Khớp Hãng: PVI');
          score += 30;
          partnerBrand = 'PVI';
        } else if (
          buyerUpper.includes('BSH') &&
          (desc.includes('BSH') || corr.includes('BSH'))
        ) {
          signals.push('Khớp Hãng: BSH');
          score += 30;
          partnerBrand = 'BSH';
        } else if (
          buyerUpper.includes('MINH ĐĂNG') &&
          (desc.includes('MINH DANG') || corr.includes('MINH DANG'))
        ) {
          signals.push('Khớp Doanh nghiệp: MINH ĐĂNG');
          score += 30;
          partnerBrand = 'MINH ĐĂNG';
        } else if (
          buyerUpper.includes('TRƯỜNG NAM') &&
          (desc.includes('TRUONG NAM') || corr.includes('TRUONG NAM'))
        ) {
          signals.push('Khớp Doanh nghiệp: TRƯỜNG NAM');
          score += 30;
          partnerBrand = 'TRƯỜNG NAM';
        } else if (
          buyerUpper.includes('LOAN VY') &&
          (desc.includes('LOAN VY') || corr.includes('LOAN VY'))
        ) {
          signals.push('Khớp Doanh nghiệp: LOAN VY');
          score += 30;
          partnerBrand = 'LOAN VY';
        } else if (
          buyerUpper.includes('ACTR') &&
          (desc.includes('ACTR') || corr.includes('ACTR'))
        ) {
          signals.push('Khớp Doanh nghiệp: ACTR');
          score += 30;
          partnerBrand = 'ACTR';
        }
      }

      // 3. POS Machine Match
      if (desc.includes('MS01T') || desc.includes('POS')) {
        signals.push('Máy POS Quẹt Thẻ');
        const txnDate = txn.trans_date ? new Date(txn.trans_date).getTime() : 0;
        const dayDiff = Math.abs(txnDate - invDate) / (1000 * 3600 * 24);
        if (dayDiff <= 3) {
          signals.push(
            `Cùng thời điểm phát sinh (Lệch ${Math.round(dayDiff)} ngày)`,
          );
          score += 20;
        }
      }

      // Bắt buộc score >= 50 (Có Hard Identifier hoặc Partner + Time)
      if (score >= 50) {
        qualifiedMatches.push({ txn, score, signals, partnerBrand });
      }
    }

    if (qualifiedMatches.length === 1) {
      const best = qualifiedMatches[0];
      const txn = best.txn;
      const curUsed = usedTxnTracker.get(txn.id) || 0;
      const txnRemaining = parseFloat(txn.remaining_amount) - curUsed;

      matches.push({
        topology: 'TOPOLOGY_1_1',
        groupKey: inv.group_key,
        partnerBrand: best.partnerBrand,
        score: Math.min(100, best.score),
        matchSignals:
          best.signals.join(' | ') +
          ` | 100% Số Tiền (${invRemaining.toLocaleString()} đ)`,
        invoiceId: inv.id,
        invoiceNo: inv.invoice_no,
        serialNo: inv.serial_no || '',
        invoiceDate: inv.invoice_date
          ? new Date(inv.invoice_date).toISOString().substring(0, 10)
          : '',
        branchName: inv.branch_name || 'Nam Sài Gòn',
        buyerName: buyerName || 'Khách lẻ',
        buyerTaxCode: inv.buyer_tax_code || '',
        licensePlate: inv.license_plate || '',
        settlementOrder: inv.settlement_order || '',
        invoiceTotalAmount: parseFloat(inv.total_amount),
        invoiceRemainingAmount: invRemaining,
        netOffAmount: invRemaining,
        bankTxnId: txn.id,
        transDate: txn.trans_date
          ? new Date(txn.trans_date).toISOString().substring(0, 10)
          : '',
        bankOrCash: txn.bank_name || txn.cash_book_name || 'Ngân hàng',
        accountNumber: txn.account_number || '',
        referenceNumber: txn.reference_number || '',
        creditAmount: parseFloat(txn.credit_amount),
        txnRemainingAmount: txnRemaining,
        correspondentName: txn.correspondent_name || '',
        description: txn.description || '',
      });

      usedInvIds.add(inv.id);
      usedTxnTracker.set(txn.id, curUsed + invRemaining);
    } else if (qualifiedMatches.length > 1) {
      // Có nhiều hơn 1 GD cùng đạt chuẩn -> Chọn GD có khoảng cách ngày gần nhất
      qualifiedMatches.sort((a, b) => {
        const dateA = a.txn.trans_date
          ? new Date(a.txn.trans_date).getTime()
          : 0;
        const dateB = b.txn.trans_date
          ? new Date(b.txn.trans_date).getTime()
          : 0;
        return Math.abs(dateA - invDate) - Math.abs(dateB - invDate);
      });

      const best = qualifiedMatches[0];
      const secondBest = qualifiedMatches[1];
      const diffA = Math.abs(
        (best.txn.trans_date ? new Date(best.txn.trans_date).getTime() : 0) -
          invDate,
      );
      const diffB = Math.abs(
        (secondBest.txn.trans_date
          ? new Date(secondBest.txn.trans_date).getTime()
          : 0) - invDate,
      );

      // Nếu GD tốt nhất có ngày gần hơn rõ rệt (hơn 3 ngày) -> Chấp nhận
      if (diffB - diffA > 3 * 24 * 3600 * 1000) {
        const txn = best.txn;
        const curUsed = usedTxnTracker.get(txn.id) || 0;
        const txnRemaining = parseFloat(txn.remaining_amount) - curUsed;

        matches.push({
          topology: 'TOPOLOGY_1_1',
          groupKey: inv.group_key,
          partnerBrand: best.partnerBrand,
          score: Math.min(95, best.score),
          matchSignals:
            best.signals.join(' | ') +
            ` | Chọn theo khoảng cách ngày gần nhất | 100% Số Tiền (${invRemaining.toLocaleString()} đ)`,
          invoiceId: inv.id,
          invoiceNo: inv.invoice_no,
          serialNo: inv.serial_no || '',
          invoiceDate: inv.invoice_date
            ? new Date(inv.invoice_date).toISOString().substring(0, 10)
            : '',
          branchName: inv.branch_name || 'Nam Sài Gòn',
          buyerName: buyerName || 'Khách lẻ',
          buyerTaxCode: inv.buyer_tax_code || '',
          licensePlate: inv.license_plate || '',
          settlementOrder: inv.settlement_order || '',
          invoiceTotalAmount: parseFloat(inv.total_amount),
          invoiceRemainingAmount: invRemaining,
          netOffAmount: invRemaining,
          bankTxnId: txn.id,
          transDate: txn.trans_date
            ? new Date(txn.trans_date).toISOString().substring(0, 10)
            : '',
          bankOrCash: txn.bank_name || txn.cash_book_name || 'Ngân hàng',
          accountNumber: txn.account_number || '',
          referenceNumber: txn.reference_number || '',
          creditAmount: parseFloat(txn.credit_amount),
          txnRemainingAmount: txnRemaining,
          correspondentName: txn.correspondent_name || '',
          description: txn.description || '',
        });

        usedInvIds.add(inv.id);
        usedTxnTracker.set(txn.id, curUsed + invRemaining);
      }
    }
  }

  // =========================================================================
  // TOPOLOGY 3: KHỚP 1 HÓA ĐƠN - NHIỀU SAO KÊ GỘP (1 - N = 100% TIỀN)
  // =========================================================================
  for (const inv of invoices) {
    if (usedInvIds.has(inv.id)) continue;
    const invPlate = cleanPlate(inv.license_plate);
    const invRemaining = parseFloat(inv.remaining_amount);

    if (invPlate && invPlate.length >= 5) {
      const candidateTxns = txns.filter((t) => {
        const curUsed = usedTxnTracker.get(t.id) || 0;
        const remain = parseFloat(t.remaining_amount) - curUsed;
        if (remain <= 0) return false;
        const desc = (
          t.description +
          ' ' +
          (t.correspondent_name || '')
        ).toUpperCase();
        const plates = extractPlatesFromText(desc);
        return (
          plates.includes(invPlate) ||
          desc.replace(/[^A-Z0-9]/g, '').includes(invPlate)
        );
      });

      if (candidateTxns.length >= 2) {
        const sumTxn = candidateTxns.reduce((sum, t) => {
          const curUsed = usedTxnTracker.get(t.id) || 0;
          return sum + (parseFloat(t.remaining_amount) - curUsed);
        }, 0);

        if (Math.abs(sumTxn - invRemaining) < 1.0) {
          for (const t of candidateTxns) {
            const curUsed = usedTxnTracker.get(t.id) || 0;
            const tRemain = parseFloat(t.remaining_amount) - curUsed;
            matches.push({
              topology: 'TOPOLOGY_1_N',
              groupKey: inv.group_key,
              partnerBrand:
                inv.group_key === 'GROUP_4_INSURANCE'
                  ? 'BẢO HIỂM'
                  : 'SME / KHÁCH LẺ',
              score: 95,
              matchSignals: `Khớp 1 HĐ nhiều đợt thanh toán theo BSX (${inv.license_plate}) + 100% Tổng Tiền (${invRemaining.toLocaleString()} đ)`,
              invoiceId: inv.id,
              invoiceNo: inv.invoice_no,
              serialNo: inv.serial_no || '',
              invoiceDate: inv.invoice_date
                ? new Date(inv.invoice_date).toISOString().substring(0, 10)
                : '',
              branchName: inv.branch_name || 'Nam Sài Gòn',
              buyerName:
                inv.buyer_name || inv.buyer_personal_name || 'Khách lẻ',
              buyerTaxCode: inv.buyer_tax_code || '',
              licensePlate: inv.license_plate || '',
              settlementOrder: inv.settlement_order || '',
              invoiceTotalAmount: parseFloat(inv.total_amount),
              invoiceRemainingAmount: invRemaining,
              netOffAmount: tRemain,
              bankTxnId: t.id,
              transDate: t.trans_date
                ? new Date(t.trans_date).toISOString().substring(0, 10)
                : '',
              bankOrCash: t.bank_name || t.cash_book_name || 'Ngân hàng',
              accountNumber: t.account_number || '',
              referenceNumber: t.reference_number || '',
              creditAmount: parseFloat(t.credit_amount),
              txnRemainingAmount: tRemain,
              correspondentName: t.correspondent_name || '',
              description: t.description || '',
            });
            usedTxnTracker.set(t.id, curUsed + tRemain);
          }
          usedInvIds.add(inv.id);
        }
      }
    }
  }

  // Danh sách các HĐ chưa khớp để chuyển sang Giai đoạn 2
  const complexCases = invoices.filter((inv) => !usedInvIds.has(inv.id));

  return { matches, complexCases };
}

export function exportExactMatchesToCsv(
  matches: ExactMatchItem[],
  outPath: string,
) {
  const headers = [
    'STT',
    'Topology Khớp',
    'Phân Nhóm',
    'Thương Hiệu / Hãng BH',
    'Độ Tin Cậy (%)',
    'Tín Hiệu Đối Soát',
    'Số HĐ',
    'Ký Hiệu HĐ',
    'Ngày HĐ',
    'Tên Khách Hàng',
    'MST / CCCD',
    'Biển Số Xe',
    'Số Lệnh SC',
    'Tổng Tiền HĐ (VNĐ)',
    'Dư Nợ Còn Lại (VNĐ)',
    'Số Tiền Cấn Trừ (VNĐ)',
    'Ngày GD Ngân Hàng',
    'Tài Khoản / Sổ Quỹ',
    'Số Tiền Thu GD (VNĐ)',
    'Dư Thu Còn Lại (VNĐ)',
    'Người Chuyển Tiền',
    'Trích Yếu Ngân Hàng',
    'Invoice ID',
    'Bank Txn ID',
  ];

  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = matches.map((m, idx) =>
    [
      idx + 1,
      m.topology,
      m.groupKey,
      m.partnerBrand,
      m.score,
      m.matchSignals,
      m.invoiceNo,
      m.serialNo,
      m.invoiceDate,
      m.buyerName,
      m.buyerTaxCode,
      m.licensePlate,
      m.settlementOrder,
      m.invoiceTotalAmount,
      m.invoiceRemainingAmount,
      m.netOffAmount,
      m.transDate,
      m.bankOrCash,
      m.creditAmount,
      m.txnRemainingAmount,
      m.correspondentName,
      m.description,
      m.invoiceId,
      m.bankTxnId,
    ]
      .map(escapeCsv)
      .join(','),
  );

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  fs.writeFileSync(outPath, csvContent, 'utf8');
}

export function exportComplexCasesToCsv(cases: any[], outPath: string) {
  const headers = [
    'STT',
    'Phân Nhóm',
    'Số HĐ',
    'Ký Hiệu HĐ',
    'Ngày HĐ',
    'Tên Khách Hàng',
    'MST / CCCD',
    'Biển Số Xe',
    'Số Lệnh SC',
    'Tổng Tiền HĐ (VNĐ)',
    'Dư Nợ Chưa Thanh Toán (VNĐ)',
    'Ghi Chú Nghiệp Vụ',
    'Invoice ID',
  ];

  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = cases.map((c, idx) =>
    [
      idx + 1,
      c.group_key,
      c.invoice_no,
      c.serial_no || '',
      c.invoice_date
        ? new Date(c.invoice_date).toISOString().substring(0, 10)
        : '',
      c.buyer_name || c.buyer_personal_name || 'Khách lẻ',
      c.buyer_tax_code || '',
      c.license_plate || '',
      c.settlement_order || '',
      c.total_amount,
      c.remaining_amount,
      'Chuyển sang Giai đoạn 2: Cần đối soát miễn thường 500k/vụ hoặc chế tài bảo hiểm',
      c.id,
    ]
      .map(escapeCsv)
      .join(','),
  );

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  fs.writeFileSync(outPath, csvContent, 'utf8');
}

async function main() {
  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    console.log(
      '=== CHẠY MÔ PHỎNG ĐỐI SOÁT GIAI ĐOẠN 1 (KHỚP 100% TIỀN NHÓM 4 & 5) ===\n',
    );

    const { matches, complexCases } = await runExactNetoffSimulation(client);

    console.log(`\n=> KẾT QUẢ ĐỐI SOÁT GIAI ĐOẠN 1:`);
    console.log(`- Tổng số bản ghi cấn trừ khớp 100% tiền: ${matches.length}`);
    const totalNetoff = matches.reduce((sum, m) => sum + m.netOffAmount, 0);
    console.log(`- Tổng số tiền cấn trừ: ${totalNetoff.toLocaleString()} VNĐ`);
    console.log(
      `- Số HĐ phức tạp/chờ duyệt chuyển sang Giai đoạn 2: ${complexCases.length}`,
    );

    const outDir =
      '/home/lio/.gemini/antigravity-ide/brain/4bc3a960-243c-4174-a18f-a6e05e0a3be7/scratch';
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const csvExact = path.join(outDir, 'preview_exact_matches_group4_5.csv');
    const csvComplex = path.join(
      outDir,
      'remaining_complex_cases_group4_5.csv',
    );

    exportExactMatchesToCsv(matches, csvExact);
    exportComplexCasesToCsv(complexCases, csvComplex);

    console.log(`\nĐã xuất file bảng kê khớp 100%: ${csvExact}`);
    console.log(`Đã xuất file bảng kê Giai đoạn 2: ${csvComplex}`);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Lỗi khi chạy mô phỏng:', err);
    process.exit(1);
  });
}

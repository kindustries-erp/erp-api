import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import {
  cleanLicensePlate,
  extractPartnerKeywords,
} from '../services/invoice-smart-netoff.service';

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

export interface MatchRecord {
  stt: number;
  subGroup: 'TIER_1A_PERFECT' | 'TIER_1B_HIGH';
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

export async function runGroup1Simulation(
  client: Client,
  startDate = '2025-10-01',
  endDate = '2026-09-30',
): Promise<MatchRecord[]> {
  // 1. Query all valid OUT invoices with remaining balance
  const invsRes = await client.query(
    `
    SELECT 
      inv.id,
      inv.invoice_no,
      inv.invoice_no_normalized,
      inv.serial_no,
      inv.invoice_date,
      inv.buyer_name,
      inv.buyer_personal_name,
      inv.buyer_tax_code,
      inv.buyer_cccd,
      inv.license_plate,
      inv.settlement_order,
      inv.total_amount,
      inv.branch_id,
      b.name as branch_name,
      COALESCE(SUM(no.net_off_amount), 0) as already_netoff,
      (inv.total_amount - COALESCE(SUM(no.net_off_amount), 0)) as remaining_amount
    FROM erp_invoices inv
    LEFT JOIN erp_branches b ON inv.branch_id = b.id
    LEFT JOIN erp_invoice_voucher_netoff no ON no.invoice_id = inv.id
    WHERE inv.direction = 'OUT'
      AND inv.is_deleted = false
      AND inv.status != 'CANCELLED'
      AND inv.invoice_date >= $1 AND inv.invoice_date <= $2
    GROUP BY inv.id, b.name
    HAVING (inv.total_amount - COALESCE(SUM(no.net_off_amount), 0)) > 0
    ORDER BY inv.invoice_date ASC, inv.invoice_no ASC
  `,
    [startDate, endDate],
  );

  // 2. Query all incoming bank transactions with remaining balance
  const txnsRes = await client.query(`
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
    GROUP BY txn.id, ba.bank_name, ba.account_number, cb.name
    HAVING (txn.credit_amount - COALESCE(SUM(no.net_off_amount), 0)) > 0
    ORDER BY txn.trans_date ASC
  `);

  const invoices = invsRes.rows;
  const txns = txnsRes.rows;

  const matches: MatchRecord[] = [];
  const usedTxnTracker = new Map<string, number>();

  let stt = 0;

  for (const inv of invoices) {
    const invRemaining = parseFloat(inv.remaining_amount);
    const invNo = (inv.invoice_no || '').trim();
    const invNoNorm = (
      inv.invoice_no_normalized || invNo.replace(/^0+/, '')
    ).trim();
    const serialNo = (inv.serial_no || '').trim();
    const buyerName = (inv.buyer_personal_name || inv.buyer_name || '').trim();
    const buyerTax = (inv.buyer_tax_code || inv.buyer_cccd || '').trim();
    const rawPlate = (inv.license_plate || '').trim();
    const compactPlate = cleanLicensePlate(rawPlate);
    const ro = (inv.settlement_order || '').trim();
    const partnerKws = extractPartnerKeywords(buyerName);

    let bestCandidate: any = null;
    let bestScore = 0;
    let bestSignals: string[] = [];
    let bestSubGroup: 'TIER_1A_PERFECT' | 'TIER_1B_HIGH' | null = null;

    for (const txn of txns) {
      const txnCredit = parseFloat(txn.credit_amount);
      const curUsed = usedTxnTracker.get(txn.id) || 0;
      const txnRemain = parseFloat(txn.remaining_amount) - curUsed;

      if (txnRemain < invRemaining - 1) continue;

      const desc = (txn.description || '').toLowerCase();
      const corr = (txn.correspondent_name || '').toLowerCase();
      const descClean = cleanLicensePlate(desc);

      const amountExact =
        Math.abs(txnRemain - invRemaining) < 1 ||
        Math.abs(txnCredit - invRemaining) < 1;
      if (!amountExact) continue;

      const signals: string[] = [];

      // Codes
      if (
        rawPlate.length >= 4 &&
        (desc.includes(rawPlate.toLowerCase()) ||
          (compactPlate.length >= 4 && descClean.includes(compactPlate)))
      ) {
        signals.push(`BSX: ${rawPlate}`);
      }
      if (ro.length >= 4 && desc.includes(ro.toLowerCase())) {
        signals.push(`Lệnh: ${ro}`);
      }
      if (
        (invNo.length > 0 && desc.includes(invNo.toLowerCase())) ||
        (invNoNorm.length >= 3 && desc.includes(invNoNorm.toLowerCase()))
      ) {
        signals.push(`Số HĐ: ${invNo}`);
      }
      if (serialNo.length >= 3 && desc.includes(serialNo.toLowerCase())) {
        signals.push(`Ký hiệu HĐ: ${serialNo}`);
      }

      // POS
      if (
        desc.includes('ms01t') ||
        desc.includes('pos') ||
        desc.includes('vnpay')
      ) {
        signals.push(`POS/QR: ${desc.substring(0, 15)}`);
      }

      // Partner / Tax
      let partnerHit = false;
      if (
        buyerTax &&
        buyerTax.length >= 5 &&
        (desc.includes(buyerTax.toLowerCase()) ||
          corr.includes(buyerTax.toLowerCase()))
      ) {
        signals.push(`MST: ${buyerTax}`);
        partnerHit = true;
      }
      for (const kw of partnerKws) {
        if (desc.includes(kw) || corr.includes(kw)) {
          signals.push(`Khách: ${kw}`);
          partnerHit = true;
          break;
        }
      }

      if (signals.length >= 2 && partnerHit) {
        if (bestScore < 95) {
          bestScore = 95;
          bestSubGroup = 'TIER_1A_PERFECT';
          bestSignals = signals;
          bestCandidate = txn;
        }
      } else if (signals.length >= 1) {
        if (bestScore < 85) {
          bestScore = 85;
          bestSubGroup = 'TIER_1B_HIGH';
          bestSignals = signals;
          bestCandidate = txn;
        }
      }
    }

    if (bestCandidate && bestSubGroup) {
      stt++;
      const actualNetOff = Math.min(
        invRemaining,
        parseFloat(bestCandidate.remaining_amount) -
          (usedTxnTracker.get(bestCandidate.id) || 0),
      );
      matches.push({
        stt,
        subGroup: bestSubGroup,
        score: bestScore,
        matchSignals: bestSignals.join(' | '),
        invoiceId: inv.id,
        invoiceNo: inv.invoice_no,
        serialNo: inv.serial_no || '',
        invoiceDate: inv.invoice_date
          ? new Date(inv.invoice_date).toISOString().substring(0, 10)
          : '',
        branchName: inv.branch_name || 'Chưa phân chi nhánh',
        buyerName: buyerName,
        buyerTaxCode: buyerTax,
        licensePlate: rawPlate,
        settlementOrder: ro,
        invoiceTotalAmount: parseFloat(inv.total_amount),
        invoiceRemainingAmount: invRemaining,
        netOffAmount: actualNetOff,
        bankTxnId: bestCandidate.id,
        transDate: bestCandidate.trans_date
          ? new Date(bestCandidate.trans_date).toISOString().substring(0, 10)
          : '',
        bankOrCash:
          bestCandidate.bank_name ||
          bestCandidate.cash_book_name ||
          'Ngân hàng',
        accountNumber: bestCandidate.account_number || '',
        referenceNumber: bestCandidate.reference_number || '',
        creditAmount: parseFloat(bestCandidate.credit_amount),
        txnRemainingAmount:
          parseFloat(bestCandidate.remaining_amount) -
          (usedTxnTracker.get(bestCandidate.id) || 0),
        correspondentName: bestCandidate.correspondent_name || '',
        description: bestCandidate.description || '',
      });

      const cur = usedTxnTracker.get(bestCandidate.id) || 0;
      usedTxnTracker.set(bestCandidate.id, cur + actualNetOff);
    }
  }

  return matches;
}

export function exportMatchesToCsv(matches: MatchRecord[], outputPath: string) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headers = [
    'STT',
    'Phân Nhóm',
    'Điểm Khớp (%)',
    'Tín Hiệu Định Danh',
    'Chi Nhánh',
    'Số HĐ',
    'Ký Hiệu HĐ',
    'Ngày Lập HĐ',
    'Tên Người Mua / Khách Hàng',
    'MST / CCCD',
    'Biển Số Xe',
    'Số Lệnh SC (RO)',
    'Tổng Tiền HĐ (VNĐ)',
    'Dư Nợ Cần Cấn Trừ (VNĐ)',
    'Số Tiền Cấn Trừ (VNĐ)',
    'Ngày GD Ngân Hàng',
    'Tài Khoản / Sổ Quỹ',
    'Số Tài Khoản',
    'Số Tiền Thu GD (VNĐ)',
    'Người Nộp / Đối Tác GD',
    'Nội Dung Sao Kê Ngân Hàng',
    'ID Hóa Đơn (UUID)',
    'ID Giao Dịch (UUID)',
  ];

  const rows = matches.map((m) =>
    [
      m.stt,
      m.subGroup === 'TIER_1A_PERFECT'
        ? 'Tier 1A (Perfect Match)'
        : 'Tier 1B (High Match)',
      m.score,
      m.matchSignals,
      m.branchName,
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
      m.accountNumber,
      m.creditAmount,
      m.correspondentName,
      m.description,
      m.invoiceId,
      m.bankTxnId,
    ]
      .map(escapeCsv)
      .join(','),
  );

  const csvContent =
    '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows].join('\n');
  fs.writeFileSync(outputPath, csvContent, 'utf8');
  console.log(`\n Đã xuất thành công file CSV bảng kê tại: ${outputPath}`);
}

async function main() {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  console.log(
    '===================================================================',
  );
  console.log(
    'BẮT ĐẦU CHẠY ĐỐI SOÁT DRY-RUN NHÓM 1 (TIER 1A & 1B) TRÊN GREENWAY PROD',
  );
  console.log(
    '===================================================================',
  );

  const matches = await runGroup1Simulation(client);
  await client.end();

  const tier1A = matches.filter((m) => m.subGroup === 'TIER_1A_PERFECT');
  const tier1B = matches.filter((m) => m.subGroup === 'TIER_1B_HIGH');

  const sumTier1A = tier1A.reduce((sum, m) => sum + m.netOffAmount, 0);
  const sumTier1B = tier1B.reduce((sum, m) => sum + m.netOffAmount, 0);
  const totalSum = matches.reduce((sum, m) => sum + m.netOffAmount, 0);

  console.log(`\n KẾT QUẢ ĐỐI SOÁT NHÓM 1:`);
  console.log(
    `- Tier 1A (Perfect Match): ${tier1A.length} HĐ | ${sumTier1A.toLocaleString()} VNĐ`,
  );
  console.log(
    `- Tier 1B (High Match):    ${tier1B.length} HĐ | ${sumTier1B.toLocaleString()} VNĐ`,
  );
  console.log(
    `=> TỔNG CỘNG NHÓM 1:       ${matches.length} HĐ | ${totalSum.toLocaleString()} VNĐ`,
  );

  const csvBrainPath =
    '/home/lio/.gemini/antigravity-ide/brain/4bc3a960-243c-4174-a18f-a6e05e0a3be7/scratch/preview_group1_matches.csv';
  exportMatchesToCsv(matches, csvBrainPath);
}

if (require.main === module) {
  main().catch(console.error);
}

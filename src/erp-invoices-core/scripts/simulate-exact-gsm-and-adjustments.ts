import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

export interface GsmMatchRecord {
  topology: 'TOPOLOGY_N_1' | 'TOPOLOGY_1_1';
  vehiclePlate: string;
  invoiceId: string;
  invoiceNo: string;
  serialNo: string;
  invoiceDate: string;
  buyerName: string;
  invoiceTotalAmount: number;
  invoiceRemainingAmount: number;
  netOffAmount: number;
  bankTxnId: string;
  transDate: string;
  bankName: string;
  creditAmount: number;
  txnRemainingAmount: number;
  description: string;
}

export interface AdjustmentPairRecord {
  adjInvoiceId: string;
  adjInvoiceNo: string;
  adjSerialNo: string;
  adjDate: string;
  adjTotalAmount: number;
  adjLicensePlate: string;
  adjDescription: string;

  origInvoiceId: string;
  origInvoiceNo: string;
  origSerialNo: string;
  origDate: string;
  origTotalAmount: number;
  origRemainingAmount: number;
  origLicensePlate: string;

  offsetAmount: number;
  offsetReason: string;
}

export function cleanPlate(p: string | null | undefined): string {
  if (!p) return '';
  return p.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

export function extractPlatesFromText(text: string): string[] {
  if (!text) return [];
  const normalized = text.replace(
    /([0-9]{2}[A-Z]{1,2}[-.\s]?[0-9]{3}[-.]?[0-9])\s+([0-9])\b/gi,
    '$1$2',
  );
  const results: string[] = [];
  const tokens = normalized.split(/[\s,;:|()/-]+/);
  for (const token of tokens) {
    const cleaned = cleanPlate(token);
    if (/^[0-9]{2}[A-Z]{1,2}[0-9]{4,5}$/.test(cleaned)) {
      results.push(cleaned);
    }
  }
  for (let i = 0; i < tokens.length - 1; i++) {
    const combined = cleanPlate(tokens[i] + tokens[i + 1]);
    if (/^[0-9]{2}[A-Z]{1,2}[0-9]{4,5}$/.test(combined)) {
      results.push(combined);
    }
  }
  return Array.from(new Set(results));
}

export async function findExactGsmMatches(
  client: Client,
): Promise<GsmMatchRecord[]> {
  // 1. Query GSM Invoices with remaining balance
  const invRes = await client.query(`
    SELECT 
      inv.id, inv.invoice_no, inv.serial_no, inv.invoice_date, inv.buyer_name,
      inv.license_plate, inv.settlement_order, inv.total_amount, inv.tax_invoice_status, inv.description,
      COALESCE(SUM(no.net_off_amount), 0) as already_netoff,
      (inv.total_amount - COALESCE(SUM(no.net_off_amount), 0)) as remaining_amount
    FROM erp_invoices inv
    LEFT JOIN erp_invoice_voucher_netoff no ON no.invoice_id = inv.id
    WHERE inv.direction = 'OUT' AND inv.is_deleted = false
      AND inv.status != 'CANCELLED' AND inv.tax_invoice_status IN (1, 2)
      AND (
        inv.buyer_name ILIKE '%GSM%' 
        OR inv.buyer_name ILIKE '%DI CHUYEN XANH%'
        OR COALESCE(inv.buyer_personal_name, '') ILIKE '%GSM%'
      )
    GROUP BY inv.id
    HAVING (inv.total_amount - COALESCE(SUM(no.net_off_amount), 0)) > 0.01
    ORDER BY inv.invoice_date ASC, inv.invoice_no ASC;
  `);

  // 2. Query available bank transactions
  const txnRes = await client.query(`
    SELECT 
      t.id, (t.trans_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh') as trans_date,
      t.credit_amount, t.description, t.correspondent_name, ba.bank_name,
      COALESCE(SUM(no.net_off_amount), 0) as already_used,
      (t.credit_amount - COALESCE(SUM(no.net_off_amount), 0)) as remaining_amount
    FROM erp_bank_transactions t
    LEFT JOIN erp_bank_accounts ba ON t.bank_account_id = ba.id
    LEFT JOIN erp_invoice_voucher_netoff no ON no.bank_transaction_id = t.id
    WHERE t.is_deleted = false AND t.credit_amount > 0
    GROUP BY t.id, ba.bank_name
    HAVING (t.credit_amount - COALESCE(SUM(no.net_off_amount), 0)) > 0.01
    ORDER BY t.trans_date ASC;
  `);

  const invoices = invRes.rows;
  const txns = txnRes.rows;

  const matches: GsmMatchRecord[] = [];
  const usedInvIds = new Set<string>();
  const usedTxnTracker = new Map<string, number>();

  // A. Quét N-1 (Nhiều HĐ gộp = 1 GD Sao kê/POS đúng 100% tiền)
  for (const t of txns) {
    const curUsed = usedTxnTracker.get(t.id) || 0;
    const tRemain = parseFloat(t.remaining_amount) - curUsed;
    if (tRemain <= 0) continue;

    const desc = (
      t.description +
      ' ' +
      (t.correspondent_name || '')
    ).toUpperCase();
    const plates = extractPlatesFromText(desc);

    if (plates.length >= 1) {
      const candidateInvs = invoices.filter((inv) => {
        if (usedInvIds.has(inv.id)) return false;
        const p = cleanPlate(inv.license_plate);
        return p && plates.includes(p);
      });

      if (candidateInvs.length >= 2) {
        const sumInv = candidateInvs.reduce(
          (sum, inv) => sum + parseFloat(inv.remaining_amount),
          0,
        );
        if (Math.abs(sumInv - tRemain) < 1.0) {
          for (const inv of candidateInvs) {
            const invRem = parseFloat(inv.remaining_amount);
            matches.push({
              topology: 'TOPOLOGY_N_1',
              vehiclePlate: inv.license_plate,
              invoiceId: inv.id,
              invoiceNo: inv.invoice_no,
              serialNo: inv.serial_no,
              invoiceDate: inv.invoice_date
                ? new Date(inv.invoice_date).toISOString().slice(0, 10)
                : '',
              buyerName: inv.buyer_name,
              invoiceTotalAmount: parseFloat(inv.total_amount),
              invoiceRemainingAmount: invRem,
              netOffAmount: invRem,
              bankTxnId: t.id,
              transDate: t.trans_date
                ? new Date(t.trans_date).toISOString().slice(0, 10)
                : '',
              bankName: t.bank_name || 'Ngân hàng/POS',
              creditAmount: parseFloat(t.credit_amount),
              txnRemainingAmount: tRemain,
              description: t.description,
            });
            usedInvIds.add(inv.id);
          }
          usedTxnTracker.set(t.id, curUsed + sumInv);
        }
      }
    }
  }

  // B. Quét 1-1 (1 HĐ = 1 GD Sao kê đúng 100% tiền)
  for (const inv of invoices) {
    if (usedInvIds.has(inv.id)) continue;
    const invAmt = parseFloat(inv.remaining_amount);
    const invPlate = cleanPlate(inv.license_plate);

    for (const t of txns) {
      const curUsed = usedTxnTracker.get(t.id) || 0;
      const tRemain = parseFloat(t.remaining_amount) - curUsed;
      if (tRemain <= 0 || Math.abs(tRemain - invAmt) >= 1.0) continue;

      const desc = (
        t.description +
        ' ' +
        (t.correspondent_name || '')
      ).toUpperCase();
      const plates = extractPlatesFromText(desc);

      if (
        invPlate &&
        invPlate.length >= 5 &&
        (plates.includes(invPlate) ||
          desc.replace(/[^A-Z0-9]/g, '').includes(invPlate))
      ) {
        matches.push({
          topology: 'TOPOLOGY_1_1',
          vehiclePlate: inv.license_plate,
          invoiceId: inv.id,
          invoiceNo: inv.invoice_no,
          serialNo: inv.serial_no,
          invoiceDate: inv.invoice_date
            ? new Date(inv.invoice_date).toISOString().slice(0, 10)
            : '',
          buyerName: inv.buyer_name,
          invoiceTotalAmount: parseFloat(inv.total_amount),
          invoiceRemainingAmount: invAmt,
          netOffAmount: invAmt,
          bankTxnId: t.id,
          transDate: t.trans_date
            ? new Date(t.trans_date).toISOString().slice(0, 10)
            : '',
          bankName: t.bank_name || 'Ngân hàng/POS',
          creditAmount: parseFloat(t.credit_amount),
          txnRemainingAmount: tRemain,
          description: t.description,
        });
        usedInvIds.add(inv.id);
        usedTxnTracker.set(t.id, curUsed + invAmt);
        break;
      }
    }
  }

  return matches;
}

export async function findExactAdjustmentPairs(
  client: Client,
): Promise<AdjustmentPairRecord[]> {
  const res = await client.query(`
    SELECT 
      adj.id as adj_id, adj.invoice_no as adj_no, adj.serial_no as adj_serial, adj.invoice_date as adj_date,
      adj.total_amount as adj_amount, adj.license_plate as adj_plate, adj.settlement_order as adj_ro, adj.description as adj_desc,
      orig.id as orig_id, orig.invoice_no as orig_no, orig.serial_no as orig_serial, orig.invoice_date as orig_date,
      orig.total_amount as orig_total, orig.license_plate as orig_plate,
      COALESCE(SUM(no.net_off_amount), 0) as orig_already_netoff,
      (orig.total_amount - COALESCE(SUM(no.net_off_amount), 0)) as orig_remaining
    FROM erp_invoices adj
    JOIN erp_invoices orig ON (
      orig.direction = 'OUT' AND orig.is_deleted = false
      AND (
        (adj.related_invoice_no IS NOT NULL AND orig.invoice_no = adj.related_invoice_no AND (adj.related_serial_no IS NULL OR orig.serial_no = adj.related_serial_no))
        OR (adj.license_plate IS NOT NULL AND orig.license_plate = adj.license_plate AND ABS(orig.total_amount + adj.total_amount) < 1.0)
      )
    )
    LEFT JOIN erp_invoice_voucher_netoff no ON no.invoice_id = orig.id
    WHERE adj.direction = 'OUT' AND adj.total_amount < 0 AND adj.is_deleted = false
    GROUP BY adj.id, adj.invoice_no, adj.serial_no, adj.invoice_date, adj.total_amount, adj.license_plate, adj.settlement_order, adj.description,
             orig.id, orig.invoice_no, orig.serial_no, orig.invoice_date, orig.total_amount, orig.license_plate
    ORDER BY adj.invoice_date ASC;
  `);

  const pairs: AdjustmentPairRecord[] = [];
  const usedAdjIds = new Set<string>();
  const usedOrigTracker = new Map<string, number>();

  for (const r of res.rows) {
    if (usedAdjIds.has(r.adj_id)) continue;

    const adjAmt = Math.abs(parseFloat(r.adj_amount));
    const origRem =
      parseFloat(r.orig_remaining) - (usedOrigTracker.get(r.orig_id) || 0);

    if (origRem <= 0) continue;

    const offsetAmount = Math.min(adjAmt, origRem);

    pairs.push({
      adjInvoiceId: r.adj_id,
      adjInvoiceNo: r.adj_no,
      adjSerialNo: r.adj_serial,
      adjDate: r.adj_date
        ? new Date(r.adj_date).toISOString().slice(0, 10)
        : '',
      adjTotalAmount: parseFloat(r.adj_amount),
      adjLicensePlate: r.adj_plate || '',
      adjDescription: r.adj_desc || '',

      origInvoiceId: r.orig_id,
      origInvoiceNo: r.orig_no,
      origSerialNo: r.orig_serial,
      origDate: r.orig_date
        ? new Date(r.orig_date).toISOString().slice(0, 10)
        : '',
      origTotalAmount: parseFloat(r.orig_total),
      origRemainingAmount: origRem,
      origLicensePlate: r.orig_plate || '',

      offsetAmount,
      offsetReason: `Bù trừ triệt tiêu hóa đơn điều chỉnh giảm HĐ ${r.adj_no} (${Number(r.adj_amount).toLocaleString()} đ) với HĐ gốc ${r.orig_no} (${Number(r.orig_total).toLocaleString()} đ)`,
    });

    usedAdjIds.add(r.adj_id);
    const curUsed = usedOrigTracker.get(r.orig_id) || 0;
    usedOrigTracker.set(r.orig_id, curUsed + offsetAmount);
  }

  return pairs;
}

export function exportGsmMatchesToCsv(
  matches: GsmMatchRecord[],
  outPath: string,
) {
  const headers = [
    'STT',
    'Topology Khớp',
    'Biển Số Xe',
    'Số HĐ',
    'Ký Hiệu HĐ',
    'Ngày HĐ',
    'Tên Khách Hàng',
    'Tổng Tiền HĐ (VNĐ)',
    'Dư Nợ Còn Lại (VNĐ)',
    'Số Tiền Cấn Trừ (VNĐ)',
    'Ngày GD Ngân Hàng',
    'Tài Khoản / Sổ Quỹ',
    'Số Tiền Thu GD (VNĐ)',
    'Dư Thu Còn Lại (VNĐ)',
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
      m.vehiclePlate,
      m.invoiceNo,
      m.serialNo,
      m.invoiceDate,
      m.buyerName,
      m.invoiceTotalAmount,
      m.invoiceRemainingAmount,
      m.netOffAmount,
      m.transDate,
      m.bankName,
      m.creditAmount,
      m.txnRemainingAmount,
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

export function exportAdjustmentPairsToCsv(
  pairs: AdjustmentPairRecord[],
  outPath: string,
) {
  const headers = [
    'STT',
    'Số HĐ Điều Chỉnh',
    'Ký Hiệu ĐC',
    'Ngày HĐ ĐC',
    'Số Tiền ĐC Giảm (VNĐ)',
    'Biển Số Xe',
    'Số HĐ Gốc',
    'Ký Hiệu Gốc',
    'Ngày HĐ Gốc',
    'Tổng Tiền Gốc (VNĐ)',
    'Dư Nợ Gốc (VNĐ)',
    'Số Tiền Bù Trừ (VNĐ)',
    'Lý Do Nghiệp Vụ',
    'HĐ ĐC ID',
    'HĐ Gốc ID',
  ];

  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = pairs.map((p, idx) =>
    [
      idx + 1,
      p.adjInvoiceNo,
      p.adjSerialNo,
      p.adjDate,
      p.adjTotalAmount,
      p.adjLicensePlate,
      p.origInvoiceNo,
      p.origSerialNo,
      p.origDate,
      p.origTotalAmount,
      p.origRemainingAmount,
      p.offsetAmount,
      p.offsetReason,
      p.adjInvoiceId,
      p.origInvoiceId,
    ]
      .map(escapeCsv)
      .join(','),
  );

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  fs.writeFileSync(outPath, csvContent, 'utf8');
}

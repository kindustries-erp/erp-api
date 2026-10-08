import { GarageCashflowStatsDto } from '../dto/garage-cashflow-query.dto';

export interface SettlementCalcItem {
  settlementType: 'RECEIPT' | 'PAYMENT' | string;
  amount: number | string;
  caseId?: string | null;
}

/**
 * Pure Engine tính toán thống kê dòng tiền và cân đối số dư công nợ.
 * Tuân thủ Pattern C (/api-service-refactor): 100% độc lập, không phụ thuộc NestJS DI.
 */

export function calculateCashflowStats(
  items: SettlementCalcItem[],
): GarageCashflowStatsDto {
  let totalReceipts = 0;
  let totalPayments = 0;
  const uniqueCases = new Set<string>();

  for (const item of items) {
    const amt = Math.abs(Number(item.amount || 0));
    const isReceipt = String(item.settlementType).toUpperCase() === 'RECEIPT';

    if (isReceipt) {
      totalReceipts += amt;
    } else {
      totalPayments += amt;
    }

    if (item.caseId) {
      uniqueCases.add(String(item.caseId));
    }
  }

  return {
    totalReceipts,
    totalPayments,
    netCashflow: totalReceipts - totalPayments,
    totalTransactions: items.length,
    linkedCasesCount: uniqueCases.size,
  };
}

export function computeCaseBalancesAfterSettlement(
  targetRevenue: number,
  receiptSettlements: Array<{ amount: number | string }>,
): { totalPaid: number; remaining: number } {
  const safeTarget = Math.max(0, Number(targetRevenue || 0));
  const totalPaid = receiptSettlements.reduce((sum, item) => {
    return sum + Math.max(0, Number(item.amount || 0));
  }, 0);

  const remaining = Math.max(0, safeTarget - totalPaid);

  return {
    totalPaid,
    remaining,
  };
}

export function sanitizePaymentMethod(
  method?: string,
  hasBankTxn?: boolean,
): 'BANK_TRANSFER' | 'CASH' | 'POS' | 'OTHER' {
  if (!method) {
    return hasBankTxn ? 'BANK_TRANSFER' : 'CASH';
  }
  const upper = method.toUpperCase();
  if (upper === 'BANK_TRANSFER' || upper === 'CHUYEN_KHOAN') {
    return 'BANK_TRANSFER';
  }
  if (upper === 'CASH' || upper === 'TIEN_MAT') {
    return 'CASH';
  }
  if (upper === 'POS' || upper === 'SMARTPAY') {
    return 'POS';
  }
  return 'OTHER';
}

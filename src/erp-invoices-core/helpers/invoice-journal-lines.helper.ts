export interface InvoiceJournalLine {
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface BuildInvoiceJournalLinesInput {
  debitAccountId: string;
  vatAccountId: string | null;
  apAccountId: string;
  preVat: number;
  vat: number;
  total: number;
  invoiceRef: string;
  defaultDesc: string;
}

/**
 * Dựng các dòng bút toán cho hóa đơn mua vào:
 * - Tách được Tiền hàng + Thuế (tổng khớp trong 1đ): Nợ TK đích + Nợ 1331 / Có 331
 * - Ngược lại: gộp toàn bộ vào TK Nợ đích / Có 331
 */
export function buildInvoiceJournalLines(
  input: BuildInvoiceJournalLinesInput,
): InvoiceJournalLine[] {
  const {
    debitAccountId,
    vatAccountId,
    apAccountId,
    preVat,
    vat,
    total,
    invoiceRef,
    defaultDesc,
  } = input;

  if (
    preVat > 0 &&
    vat > 0 &&
    Math.abs(preVat + vat - total) <= 1.0 &&
    vatAccountId
  ) {
    return [
      {
        accountId: debitAccountId,
        debit: preVat,
        credit: 0,
        description: `${invoiceRef}_${defaultDesc}`,
      },
      {
        accountId: vatAccountId,
        debit: vat,
        credit: 0,
        description: `${invoiceRef}_Thuế GTGT đầu vào`,
      },
      {
        accountId: apAccountId,
        debit: 0,
        credit: total,
        description: `${invoiceRef}_Phải trả người bán`,
      },
    ];
  }

  return [
    {
      accountId: debitAccountId,
      debit: total,
      credit: 0,
      description: `${invoiceRef}_${defaultDesc}`,
    },
    {
      accountId: apAccountId,
      debit: 0,
      credit: total,
      description: `${invoiceRef}_Phải trả người bán`,
    },
  ];
}

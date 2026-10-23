const MAX_PARTNER_NAME_LENGTH = 40;

export interface InvoiceProgressRefInput {
  invoiceNo?: string | null;
  serialNo?: string | null;
  partnerName?: string | null;
}

/** Tham chiếu hóa đơn ngắn gọn cho dòng tiến trình: `HĐ 1847 · C26MSP · TÊN ĐỐI TÁC` */
export function formatInvoiceProgressRef({
  invoiceNo,
  serialNo,
  partnerName,
}: InvoiceProgressRefInput): string {
  const parts: string[] = [];
  const no = invoiceNo?.trim();
  const serial = serialNo?.trim();
  const partner = partnerName?.trim();

  if (no) parts.push(`HĐ ${no}`);
  if (serial) parts.push(serial);
  if (partner) {
    parts.push(
      partner.length > MAX_PARTNER_NAME_LENGTH
        ? `${partner.slice(0, MAX_PARTNER_NAME_LENGTH - 1)}…`
        : partner,
    );
  }
  return parts.join(' · ');
}

/**
 * Extract settlement order and license plate from invoice descriptions/notes/items.
 * Mutates the invoice object in-place.
 * Accepts `any` to stay compatible with both raw create objects and full entities.
 */
export function extractInvoiceMetadata(invoice: any): void {
  const fullDesc = [
    invoice.description,
    invoice.notes,
    ...(invoice.items || []).map((i) => i.description),
  ]
    .filter(Boolean)
    .join(' | ');

  // Extract Lệnh quyết toán (-WO- or GR-)
  const woMatch = fullDesc.match(/(\S*-WO-\S*|GR-\S*)/i);
  if (woMatch) {
    let wo = woMatch[0];
    if (wo.toUpperCase().startsWith('QT')) {
      wo = wo.substring(2);
    }
    invoice.settlementOrder = wo;
  }

  // Extract Biển số xe (e.g. 50E82434, 50H-38666, 89A-482.19, etc.)
  const plateMatch = fullDesc.match(/\d{2}[A-ZĐ][A-Z0-9]?[-.\s]?\d{4,5}/i);
  if (plateMatch) {
    invoice.licensePlate = plateMatch[0];
  }
}

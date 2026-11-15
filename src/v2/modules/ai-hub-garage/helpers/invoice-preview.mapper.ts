import { AiExtractionResult } from '@/v2/core/ai-hub-core';
import { GarageItemMatch } from '@/v2/modules/items-garage/helpers/garage-item-match.helper';
import { InvoicePreviewResponseDto } from '../dto/invoice-preview-response.dto';
import {
  GarageInvoiceExtraction,
  lineTypeOf,
  sumLineAmounts,
} from './garage-invoice-extraction.helper';

/** Mã cảnh báo trả cho client; client tự dịch sang câu chữ. */
export const PREVIEW_WARNINGS = {
  skippedLines: 'SKIPPED_LINES',
  missingPrice: 'MISSING_UNIT_PRICE',
  totalMismatch: 'TOTAL_MISMATCH',
} as const;

/** Lệch quá 15% giữa tổng dòng (trước thuế) và tổng hóa đơn thì cảnh báo; VAT cao nhất 10%. */
const TOTAL_TOLERANCE = 0.15;

/** Ghép kết quả đọc hóa đơn với kết quả đối chiếu danh mục thành bản xem trước. Hàm thuần. */
export function toInvoicePreview(
  extraction: AiExtractionResult<GarageInvoiceExtraction>,
  matches: GarageItemMatch[],
): InvoicePreviewResponseDto {
  const { invoice, lines, skippedLines } = extraction.data;
  const warnings: string[] = [];
  if (skippedLines > 0) warnings.push(PREVIEW_WARNINGS.skippedLines);
  if (lines.some((line) => line.unitPrice === null)) {
    warnings.push(PREVIEW_WARNINGS.missingPrice);
  }
  const lineTotal = sumLineAmounts(lines);
  if (
    invoice.total &&
    lineTotal > 0 &&
    Math.abs(invoice.total - lineTotal) / invoice.total > TOTAL_TOLERANCE
  ) {
    warnings.push(PREVIEW_WARNINGS.totalMismatch);
  }

  return {
    invoice,
    lines: lines.map((line, index) => {
      const match = matches[index];
      return {
        itemName: line.itemName,
        itemCode: match.item?.itemCode ?? match.suggestedCode ?? null,
        unit: line.unit ?? match.item?.unit ?? null,
        qtyRequested: line.quantity,
        estUnitPrice: line.unitPrice,
        itemType: match.itemType,
        lineType: lineTypeOf(match.itemType),
        match: {
          status: match.status,
          matchedBy: match.matchedBy,
          itemId: match.item?.id,
          catalogItemName: match.item?.itemName,
        },
      };
    }),
    warnings,
    ai: {
      tier: extraction.tier,
      model: extraction.model,
      latencyMs: extraction.latencyMs,
    },
  };
}

import {
  INVOICE_CATEGORY_CODES,
  LINE_ITEM_TYPES,
  MIN_CLASSIFY_CONFIDENCE,
} from './invoice-ai.constants';
import type {
  ClassifyInvoiceCategoryResult,
  ClassifyLineItemInput,
  ClassifyLineItemResult,
  ExtractedInvoiceResult,
  ExtractedLicensePlateResult,
} from './invoice-ai.types';

/** Callback ghi cảnh báo do handler truyền vào (parser thuần, không phụ thuộc Logger). */
export type ParseWarn = (message: string) => void;

const noopWarn: ParseWarn = () => undefined;

export function stripJsonFence(text: string): string {
  return text
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();
}

export function parseCategoryResult(
  text: string,
  warn: ParseWarn = noopWarn,
): ClassifyInvoiceCategoryResult {
  try {
    const parsed = JSON.parse(stripJsonFence(text));

    const categoryCode = INVOICE_CATEGORY_CODES.includes(parsed.categoryCode)
      ? parsed.categoryCode
      : null;
    const confidence =
      typeof parsed.confidence === 'number' ? parsed.confidence : 0;

    if (confidence < MIN_CLASSIFY_CONFIDENCE || !categoryCode) {
      return {
        categoryCode: null,
        confidence,
        reason:
          parsed.reason || 'Confidence under 0.7 or invalid category code',
        fallbackReason: categoryCode ? 'LOW_CONFIDENCE' : 'INVALID_CODE',
      };
    }

    return {
      categoryCode,
      confidence,
      reason: parsed.reason || 'Classified by 9router AI',
    };
  } catch {
    warn(`Failed to parse classification JSON: ${text.slice(0, 200)}`);
    return {
      categoryCode: null,
      confidence: 0,
      reason: 'Unparseable AI response JSON',
      fallbackReason: 'AI_ERROR',
    };
  }
}

export function parseExtractedInvoice(
  text: string,
  warn: ParseWarn = noopWarn,
): ExtractedInvoiceResult {
  try {
    return JSON.parse(stripJsonFence(text));
  } catch {
    warn(`Failed to parse extracted invoice JSON: ${text.slice(0, 200)}`);
    return { items: [], rawSummary: text };
  }
}

export function parsePlateResult(
  text: string,
  warn: ParseWarn = noopWarn,
): ExtractedLicensePlateResult {
  try {
    const parsed = JSON.parse(stripJsonFence(text));
    return {
      licensePlate: parsed.licensePlate || null,
      formattedPlate: parsed.formattedPlate || parsed.licensePlate || null,
      settlementOrder: parsed.settlementOrder || null,
      confidence:
        typeof parsed.confidence === 'number' ? parsed.confidence : 0.9,
      reason: parsed.reason || '',
    };
  } catch {
    warn(`Failed to parse license plate JSON: ${text.slice(0, 200)}`);
    return {
      licensePlate: null,
      formattedPlate: null,
      settlementOrder: null,
      confidence: 0,
      reason: text,
    };
  }
}

export function parseLineItemsResult(
  text: string,
  originalItems: ClassifyLineItemInput[],
  warn: ParseWarn = noopWarn,
): ClassifyLineItemResult[] {
  try {
    const parsed = JSON.parse(stripJsonFence(text));
    const rawList = Array.isArray(parsed.items)
      ? parsed.items
      : Array.isArray(parsed)
        ? parsed
        : [];

    return rawList.map((item: any, idx: number) => {
      const lineIndex =
        typeof item.lineIndex === 'number'
          ? item.lineIndex
          : (originalItems[idx]?.lineIndex ?? idx);
      const itemCode =
        typeof item.itemCode === 'string' && item.itemCode.trim().length > 0
          ? item.itemCode.trim()
          : null;
      const itemType = (LINE_ITEM_TYPES as readonly string[]).includes(
        item.itemType,
      )
        ? item.itemType
        : 'OTHER';
      const confidence =
        typeof item.confidence === 'number' ? item.confidence : 0.8;
      const isDiscountDeduction =
        Boolean(item.isDiscountDeduction) || itemType === 'DISCOUNT';

      return {
        lineIndex,
        itemCode,
        itemType,
        isDiscountDeduction,
        confidence,
        reason: item.reason || 'Classified by 9router AI',
      };
    });
  } catch {
    warn(
      `Failed to parse line items classification JSON: ${text.slice(0, 200)}`,
    );
    return [];
  }
}

import { Injectable, Logger } from '@nestjs/common';
import {
  InvoiceAiHandler,
  ClassifyLineItemInput,
} from '../../../ai-hub-core/handlers/invoice-ai.handler';
import {
  extractStandardItemCode,
  normalizePrefix,
} from '../../helpers/vinfast-part-code.helper';

export interface ResolveLineItemInput {
  id?: string;
  lineIndex?: number;
  description?: string | null;
  unit?: string | null;
  quantity?: number | string | null;
  unitPrice?: number | string | null;
  preVatAmount?: number | string | null;
  vatAmount?: number | string | null;
  discountAmount?: number | string | null;
  totalAmount?: number | string | null;
  sellerName?: string | null;
  sellerTaxCode?: string | null;
  buyerName?: string | null;
  existingItemCode?: string | null;
}

export interface ResolvedLineItemCode {
  id?: string;
  lineIndex: number;
  itemCode: string;
  itemType: 'PARTS' | 'SERVICE' | 'MATERIAL' | 'DISCOUNT' | 'OTHER';
  isDiscountDeduction: boolean;
  confidence: number;
  source:
    | 'EXISTING_PRESERVED'
    | 'AI_CLASSIFIED'
    | 'VINFAST_PARTS'
    | 'OEM_PARTS'
    | 'RESCUE_RULE'
    | 'DISCOUNT_RULE'
    | 'SUBCONTRACT_RULE'
    | 'SERVICE_RULE'
    | 'CONSUMABLES_RULE'
    | 'TOOLS_RULE'
    | 'ADMIN_RULE'
    | 'FALLBACK';
  reason?: string;
}

/**
 * Sub-service điều phối phân loại và gán mã hàng (item_code) chi tiết từng dòng hóa đơn.
 * Tuân thủ cơ chế Hybrid AI-First:
 * 1. Preserve Guard: Bảo toàn và chuẩn hóa tiền tố mã đã có.
 * 2. AI-First: Trích xuất bằng 9router AI theo đúng Prefix Taxonomy (VF-, PT-, VT-, DV-, CK-, CCDC-, HC-).
 * 3. Rule-based Fallback: Tự động fallback sang Regex / Vendor Matching khi AI offline hoặc low confidence.
 */
@Injectable()
export class InvoiceItemCodeResolverService {
  private readonly logger = new Logger(InvoiceItemCodeResolverService.name);

  constructor(private readonly invoiceAiHandler: InvoiceAiHandler) {}

  /**
   * Xử lý gán mã hàng cho một mảng các dòng hóa đơn (Batch Processing).
   */
  async resolveBatch(
    items: ResolveLineItemInput[],
    options?: {
      enableAi?: boolean;
      aiTier?: string;
      modelOverride?: string;
      forceAll?: boolean;
    },
  ): Promise<ResolvedLineItemCode[]> {
    if (!items || items.length === 0) return [];

    const enableAi = options?.enableAi ?? true;
    const aiTier = options?.aiTier ?? 'low';
    const forceAll = options?.forceAll ?? false;

    const results: ResolvedLineItemCode[] = [];
    const pendingAiInputs: ClassifyLineItemInput[] = [];
    const pendingAiIndices: number[] = [];

    // Bước 1: Kiểm tra Preserve Guard cho từng dòng (nếu không bật forceAll)
    items.forEach((item, idx) => {
      const lineIdx = item.lineIndex ?? idx;
      if (
        !forceAll &&
        item.existingItemCode &&
        item.existingItemCode.trim() !== '' &&
        item.existingItemCode.toUpperCase() !== 'NULL'
      ) {
        // Dòng đã có mã hợp lệ -> Giữ nguyên và chuẩn hóa tiền tố
        const preserved = extractStandardItemCode({
          existingItemCode: item.existingItemCode,
          description: item.description,
          preVatAmount: Number(item.preVatAmount || 0),
          discountAmount: Number(item.discountAmount || 0),
        });

        results[lineIdx] = {
          id: item.id,
          lineIndex: lineIdx,
          itemCode: normalizePrefix(preserved.itemCode, preserved.itemType),
          itemType: preserved.itemType,
          isDiscountDeduction: preserved.isDiscountDeduction,
          confidence: 1.0,
          source: 'EXISTING_PRESERVED',
          reason: 'Bảo toàn và chuẩn hóa tiền tố mã đã tồn tại',
        };
      } else {
        // Dòng cần phân loại -> Chuẩn bị danh sách gọi AI
        pendingAiInputs.push({
          lineIndex: lineIdx,
          description: item.description || '',
          unit: item.unit || '',
          quantity: Number(item.quantity || 1),
          unitPrice: Number(item.unitPrice || item.preVatAmount || 0),
          preVatAmount: Number(item.preVatAmount || 0),
          discountAmount: Number(item.discountAmount || 0),
          totalAmount: Number(item.totalAmount || item.preVatAmount || 0),
          sellerName: item.sellerName || '',
          sellerTaxCode: item.sellerTaxCode || '',
          buyerName: item.buyerName || '',
        });
        pendingAiIndices.push(lineIdx);
      }
    });

    // Bước 2: Gọi AI phân tích (nếu có dòng cần phân loại và bật AI)
    const aiResultsMap = new Map<number, any>();
    if (enableAi && pendingAiInputs.length > 0) {
      try {
        const aiOutputs =
          await this.invoiceAiHandler.classifyInvoiceLineItemsWithAi(
            pendingAiInputs,
            aiTier,
            options?.modelOverride,
          );
        for (const out of aiOutputs) {
          if (out.itemCode && out.confidence >= 0.7) {
            aiResultsMap.set(out.lineIndex, out);
          }
        }
      } catch (err: any) {
        this.logger.warn(
          `AI Batch classification failed, falling back to rule-based: ${err?.message}`,
        );
      }
    }

    // Bước 3: Áp dụng kết quả AI hoặc Fallback Rule-based cho từng dòng
    for (let i = 0; i < pendingAiInputs.length; i++) {
      const lineIdx = pendingAiIndices[i];
      const origItem = items.find(
        (it, idx) => (it.lineIndex ?? idx) === lineIdx,
      );
      const aiResult = aiResultsMap.get(lineIdx);

      if (aiResult && aiResult.itemCode) {
        // Áp dụng kết quả từ AI (kèm hậu kiểm normalizePrefix)
        const finalCode = normalizePrefix(aiResult.itemCode, aiResult.itemType);
        results[lineIdx] = {
          id: origItem?.id,
          lineIndex: lineIdx,
          itemCode: finalCode,
          itemType: aiResult.itemType,
          isDiscountDeduction: aiResult.isDiscountDeduction,
          confidence: aiResult.confidence,
          source: 'AI_CLASSIFIED',
          reason: aiResult.reason,
        };
      } else {
        // Fallback sang Rule-based Regex truyền thống
        const ruleRes = extractStandardItemCode({
          description: origItem?.description,
          unit: origItem?.unit,
          sellerName: origItem?.sellerName,
          sellerTaxCode: origItem?.sellerTaxCode,
          discountAmount: Number(origItem?.discountAmount || 0),
          preVatAmount: Number(origItem?.preVatAmount || 0),
        });

        const finalCode = normalizePrefix(ruleRes.itemCode, ruleRes.itemType);

        results[lineIdx] = {
          id: origItem?.id,
          lineIndex: lineIdx,
          itemCode: finalCode,
          itemType: ruleRes.itemType,
          isDiscountDeduction: ruleRes.isDiscountDeduction,
          confidence: 0.9,
          source: ruleRes.source as any,
          reason: 'Classified via Rule-based fallback regex engine',
        };
      }
    }

    return results.filter(Boolean);
  }

  /**
   * Xử lý gán mã hàng cho một dòng đơn lẻ.
   */
  async resolveSingle(
    item: ResolveLineItemInput,
    options?: {
      enableAi?: boolean;
      aiTier?: string;
      modelOverride?: string;
      forceAll?: boolean;
    },
  ): Promise<ResolvedLineItemCode> {
    const list = await this.resolveBatch([item], options);
    return (
      list[0] || {
        id: item.id,
        lineIndex: 0,
        itemCode: 'PT-CHUNG',
        itemType: 'OTHER',
        isDiscountDeduction: false,
        confidence: 0.5,
        source: 'FALLBACK',
      }
    );
  }
}

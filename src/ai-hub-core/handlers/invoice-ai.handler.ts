import { Injectable, Logger } from '@nestjs/common';
import { NineRouterClient } from '../clients/nine-router.client';
import { jsonToToon } from '../helpers/json-to-toon.helper';
import { VINFAST_TAX_CODES } from './invoice/invoice-ai.constants';
import { INVOICE_CATEGORY_SYSTEM_PROMPT } from './invoice/invoice-category.prompt';
import { INVOICE_EXTRACT_SYSTEM_PROMPT } from './invoice/invoice-extract.prompt';
import { INVOICE_LINE_ITEM_SYSTEM_PROMPT } from './invoice/invoice-line-item.prompt';
import { INVOICE_PLATE_SYSTEM_PROMPT } from './invoice/invoice-plate.prompt';
import {
  parseCategoryResult,
  parseExtractedInvoice,
  parseLineItemsResult,
  parsePlateResult,
} from './invoice/invoice-ai.parsers';
import type {
  ClassifyInvoiceCategoryResult,
  ClassifyInvoiceInput,
  ClassifyLineItemInput,
  ClassifyLineItemResult,
  ExtractedInvoiceResult,
  ExtractedLicensePlateResult,
} from './invoice/invoice-ai.types';

// Giữ tương thích ngược: các nơi khác import type/hằng số từ file handler này.
export * from './invoice/invoice-ai.types';
export { VINFAST_TAX_CODES } from './invoice/invoice-ai.constants';

@Injectable()
export class InvoiceAiHandler {
  private readonly logger = new Logger(InvoiceAiHandler.name);

  constructor(private readonly nineRouterClient: NineRouterClient) {}

  private readonly warn = (message: string): void => {
    this.logger.warn(message);
  };

  /**
   * Tự động phân loại hóa đơn đầu vào theo 14 nhóm chi phí chuẩn Thông Tư 99/2025/TT-BTC.
   * 1. Pre-check MST VinFast: Nếu trùng khớp 100% MST VinFast -> trả về ngay 'VF_PARTS' không tốn token AI.
   * 2. Gọi 9router AI (Tier low / Gemini 3.7 Flash) để phân loại nghiệp vụ chi tiết.
   * 3. Fallback an toàn: Nếu AI lỗi, timeout, hoặc confidence < 0.7 -> trả về categoryCode: null (hạch toán vào TK T0003).
   */
  async classifyInvoiceCategory(
    invoiceData: ClassifyInvoiceInput,
    tier: string = 'low',
    modelOverride?: string,
  ): Promise<ClassifyInvoiceCategoryResult> {
    const normTaxCode = String(invoiceData.sellerTaxCode || '')
      .replace(/\s+/g, '')
      .trim();

    // 1. Pre-check MST VinFast whitelist
    if (normTaxCode && VINFAST_TAX_CODES.includes(normTaxCode)) {
      return {
        categoryCode: 'VF_PARTS',
        confidence: 1.0,
        reason: `Khớp trực tiếp MST chính hãng VinFast (${normTaxCode})`,
        isVfDirectMatch: true,
      };
    }

    // 2. Chuẩn bị TOON input cho AI
    const toonData = jsonToToon({
      no: invoiceData.invoiceNo,
      serial: invoiceData.serialNo,
      sellerName: invoiceData.sellerName,
      sellerTaxCode: invoiceData.sellerTaxCode,
      buyerName: invoiceData.buyerName,
      desc: invoiceData.description,
      notes: invoiceData.notes,
      total: invoiceData.totalAmount,
      items: (invoiceData.items || []).slice(0, 30).map((it) => ({
        code: it.itemCode,
        name: it.description,
        qty: it.quantity,
        amount: it.totalAmount,
      })),
    });

    const userPrompt = `Thông tin hóa đơn đầu vào (TOON format):\n${toonData}`;

    try {
      const completion = await this.nineRouterClient.complete({
        model: modelOverride || tier,
        messages: [
          { role: 'system', content: INVOICE_CATEGORY_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.0,
      });

      const content = completion.choices[0]?.message?.content || '{}';
      return parseCategoryResult(content, this.warn);
    } catch (err: any) {
      this.logger.warn(
        `AI classify invoice failed for invoice ${invoiceData.invoiceNo}: ${err?.message}`,
      );
      return {
        categoryCode: null,
        confidence: 0,
        reason: `AI Failure: ${err?.message || 'Unknown error'}`,
        fallbackReason: 'AI_ERROR',
      };
    }
  }

  /**
   * Extract vehicle license plate from invoice description and line items using TOON format
   */
  async extractLicensePlate(
    invoiceData: {
      invoiceNo?: string;
      serialNo?: string;
      invoiceDate?: string;
      buyerName?: string;
      description?: string;
      notes?: string;
      items?: Array<{
        description: string;
        quantity?: number;
        totalAmount?: number;
      }>;
    },
    tier: string = 'low',
    modelOverride?: string,
  ): Promise<ExtractedLicensePlateResult> {
    const toonData = jsonToToon({
      no: invoiceData.invoiceNo,
      serial: invoiceData.serialNo,
      date: invoiceData.invoiceDate,
      buyer: invoiceData.buyerName,
      desc: invoiceData.description,
      notes: invoiceData.notes,
      items: (invoiceData.items || []).map((it) => ({
        name: it.description,
        qty: it.quantity,
        amount: it.totalAmount,
      })),
    });

    const userPrompt = `Dữ liệu hóa đơn (TOON format):\n${toonData}`;

    const completion = await this.nineRouterClient.complete({
      model: modelOverride || tier,
      messages: [
        { role: 'system', content: INVOICE_PLATE_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.0,
    });

    const content = completion.choices[0]?.message?.content || '{}';
    return parsePlateResult(content, this.warn);
  }

  async extractInvoiceData(
    invoiceText: string,
    tier: string = 'medium',
    modelOverride?: string,
  ): Promise<ExtractedInvoiceResult> {
    const userPrompt = `Nội dung hóa đơn cần xử lý:\n${invoiceText}`;

    const completion = await this.nineRouterClient.complete({
      model: modelOverride || tier,
      messages: [
        { role: 'system', content: INVOICE_EXTRACT_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
    });

    const content = completion.choices[0]?.message?.content || '{}';
    return parseExtractedInvoice(content, this.warn);
  }

  /**
   * Phân loại chi tiết từng dòng hàng hóa/dịch vụ trên hóa đơn bằng AI (9router Gateway).
   * Hỗ trợ trích xuất cả mã phụ tùng VinFast chính hãng, cứu hộ, chiết khấu, thầu phụ, tiện ích, vật tư.
   */
  async classifyInvoiceLineItemsWithAi(
    items: ClassifyLineItemInput[],
    tier: string = 'low',
    modelOverride?: string,
  ): Promise<ClassifyLineItemResult[]> {
    if (!items || items.length === 0) return [];

    const toonData = jsonToToon({
      lines: items.map((it) => ({
        idx: it.lineIndex,
        desc: it.description,
        unit: it.unit,
        qty: it.quantity,
        price: it.unitPrice,
        preVat: it.preVatAmount,
        disc: it.discountAmount,
        seller: it.sellerName,
        sellerTax: it.sellerTaxCode,
      })),
    });

    const userPrompt = `Danh sách các dòng hàng hóa/dịch vụ (TOON format):\n${toonData}`;

    try {
      const completion = await this.nineRouterClient.complete({
        model: modelOverride || tier,
        messages: [
          { role: 'system', content: INVOICE_LINE_ITEM_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.0,
      });

      const content = completion.choices[0]?.message?.content || '{}';
      return parseLineItemsResult(content, items, this.warn);
    } catch (err: any) {
      this.logger.warn(
        `AI classify line items failed for ${items.length} items: ${err?.message}`,
      );
      return [];
    }
  }
}

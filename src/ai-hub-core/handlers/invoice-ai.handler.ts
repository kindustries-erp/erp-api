import { Injectable, Logger } from '@nestjs/common';
import { NineRouterClient } from '../clients/nine-router.client';
import { jsonToToon } from '../helpers/json-to-toon.helper';

export interface ExtractedInvoiceItem {
  itemName: string;
  itemCode?: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  vatRate?: number;
}

export interface ExtractedInvoiceResult {
  invoiceNumber?: string;
  invoiceDate?: string;
  sellerTaxCode?: string;
  sellerName?: string;
  buyerTaxCode?: string;
  buyerName?: string;
  subtotal?: number;
  taxAmount?: number;
  totalAmount?: number;
  items: ExtractedInvoiceItem[];
  rawSummary?: string;
}

export interface ExtractedLicensePlateResult {
  licensePlate: string | null;
  formattedPlate: string | null;
  settlementOrder?: string | null;
  confidence: number;
  reason?: string;
}

@Injectable()
export class InvoiceAiHandler {
  private readonly logger = new Logger(InvoiceAiHandler.name);

  constructor(private readonly nineRouterClient: NineRouterClient) {}

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

    const systemPrompt = `Bạn là chuyên gia trích xuất dữ liệu hóa đơn của hệ thống ERP Garage Ô tô.
Nhiệm vụ: Đọc kỹ dữ liệu hóa đơn (được định dạng theo chuẩn TOON - Token-Oriented Object Notation) và trích xuất BIỂN SỐ XE cơ giới Việt Nam (nếu có).

Quy tắc nhận diện biển số xe:
- Định dạng chuẩn biển số Việt Nam: 2 chữ số tỉnh thành + 1-2 chữ cái (A-Z, Đ) + 4-5 chữ số (VD: 50F-090.80, 50H-319.73, 51D-888.01, 70H-094.82, 34A-674.52, 51N-015.34, 50H-315.42...).
- Lệnh quyết toán / Số phiếu dịch vụ (nếu có): VD GR-PDV2609-0005, 52801-WO-26-02-05-029...
- Nếu không có biển số xe trong bất kỳ dòng text nào, trả về null.

Chỉ trả về DUY NHẤT một JSON hợp lệ:
{
  "licensePlate": string | null,
  "formattedPlate": string | null,
  "settlementOrder": string | null,
  "confidence": number,
  "reason": string
}`;

    const userPrompt = `Dữ liệu hóa đơn (TOON format):\n${toonData}`;

    const completion = await this.nineRouterClient.complete({
      model: modelOverride || tier,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.0,
    });

    const content = completion.choices[0]?.message?.content || '{}';
    return this.parsePlateResult(content);
  }

  async extractInvoiceData(
    invoiceText: string,
    tier: string = 'medium',
    modelOverride?: string,
  ): Promise<ExtractedInvoiceResult> {
    const systemPrompt = `Bạn là chuyên gia trích xuất dữ liệu hóa đơn tài chính của hệ thống ERP. 
Nhiệm vụ của bạn là đọc nội dung hóa đơn (text/OCR) và chuyển đổi thành một đối tượng JSON chuẩn duy nhất theo schema:
{
  "invoiceNumber": string,
  "invoiceDate": "YYYY-MM-DD",
  "sellerTaxCode": string,
  "sellerName": string,
  "buyerTaxCode": string,
  "buyerName": string,
  "subtotal": number,
  "taxAmount": number,
  "totalAmount": number,
  "items": [
    {
      "itemName": string,
      "itemCode": string,
      "unit": string,
      "quantity": number,
      "unitPrice": number,
      "amount": number,
      "vatRate": number
    }
  ]
}
Chỉ trả về định dạng JSON hợp lệ, không bọc markdown hay thêm bất kỳ lời giải thích nào.`;

    const userPrompt = `Nội dung hóa đơn cần xử lý:\n${invoiceText}`;

    const completion = await this.nineRouterClient.complete({
      model: modelOverride || tier,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
    });

    const content = completion.choices[0]?.message?.content || '{}';
    return this.parseJsonResult(content);
  }

  private parseJsonResult(text: string): ExtractedInvoiceResult {
    try {
      const clean = text
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      return JSON.parse(clean);
    } catch (e) {
      this.logger.warn(
        `Failed to parse extracted invoice JSON: ${text.slice(0, 200)}`,
      );
      return {
        items: [],
        rawSummary: text,
      };
    }
  }

  private parsePlateResult(text: string): ExtractedLicensePlateResult {
    try {
      const clean = text
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      const parsed = JSON.parse(clean);
      return {
        licensePlate: parsed.licensePlate || null,
        formattedPlate: parsed.formattedPlate || parsed.licensePlate || null,
        settlementOrder: parsed.settlementOrder || null,
        confidence:
          typeof parsed.confidence === 'number' ? parsed.confidence : 0.9,
        reason: parsed.reason || '',
      };
    } catch (e) {
      this.logger.warn(
        `Failed to parse license plate JSON: ${text.slice(0, 200)}`,
      );
      return {
        licensePlate: null,
        formattedPlate: null,
        settlementOrder: null,
        confidence: 0,
        reason: text,
      };
    }
  }
}

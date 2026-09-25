import { Injectable, Logger } from '@nestjs/common';
import { NineRouterClient } from '../clients/nine-router.client';

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

@Injectable()
export class InvoiceAiHandler {
  private readonly logger = new Logger(InvoiceAiHandler.name);

  constructor(private readonly nineRouterClient: NineRouterClient) {}

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
}

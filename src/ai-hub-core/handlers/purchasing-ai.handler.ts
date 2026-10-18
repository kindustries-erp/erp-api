import { Injectable, Logger } from '@nestjs/common';
import { NineRouterClient } from '../clients/nine-router.client';

export interface SupplierQuoteComparison {
  recommendedSupplier: string;
  reasons: string[];
  priceComparisonSummary: string;
  leadTimeRiskAssessment: string;
  suggestedPoLines: Array<{
    itemCode: string;
    quantity: number;
    recommendedPrice: number;
  }>;
}

@Injectable()
export class PurchasingAiHandler {
  private readonly logger = new Logger(PurchasingAiHandler.name);

  constructor(private readonly nineRouterClient: NineRouterClient) {}

  async compareSupplierQuotes(params: {
    quotes: any[];
    purchaseRequirements: string;
    tier?: string;
    modelOverride?: string;
  }): Promise<SupplierQuoteComparison> {
    const systemPrompt = `Bạn là chuyên viên tối ưu hóa chuỗi cung ứng (Procurement Specialist) của hệ thống ERP.
Nhiệm vụ của bạn là phân tích và so sánh các báo giá từ các nhà cung cấp khác nhau theo tiêu chí: Đơn giá, Thời hạn thanh toán, Thời gian giao hàng, Uy tín lịch sử.
Hãy trả về JSON theo schema:
{
  "recommendedSupplier": string,
  "reasons": string[],
  "priceComparisonSummary": string,
  "leadTimeRiskAssessment": string,
  "suggestedPoLines": [
    {
      "itemCode": string,
      "quantity": number,
      "recommendedPrice": number
    }
  ]
}
Chỉ trả về JSON hợp lệ.`;

    const userPrompt = `Yêu cầu mua hàng: ${params.purchaseRequirements}
Dữ liệu báo giá các NCC:
${JSON.stringify(params.quotes, null, 2)}`;

    const completion = await this.nineRouterClient.complete({
      model: params.modelOverride || params.tier || 'medium',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
    });

    const content = completion.choices[0]?.message?.content || '{}';
    return this.parseJsonResult(content);
  }

  private parseJsonResult(text: string): SupplierQuoteComparison {
    try {
      const clean = text
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      return JSON.parse(clean);
    } catch (e) {
      this.logger.warn(
        `Failed to parse purchasing comparison JSON: ${text.slice(0, 200)}`,
      );
      return {
        recommendedSupplier: 'N/A',
        reasons: [text],
        priceComparisonSummary: 'Không thể phân tích cấu trúc tự động',
        leadTimeRiskAssessment: 'Chưa xác định',
        suggestedPoLines: [],
      };
    }
  }
}

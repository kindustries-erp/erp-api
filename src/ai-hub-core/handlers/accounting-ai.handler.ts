import { Injectable, Logger } from '@nestjs/common';
import { NineRouterClient } from '../clients/nine-router.client';

export interface AutoJournalSuggestion {
  debitAccount: string;
  creditAccount: string;
  confidence: number;
  explanation: string;
  suggestedTaxAccount?: string;
}

@Injectable()
export class AccountingAiHandler {
  private readonly logger = new Logger(AccountingAiHandler.name);

  constructor(private readonly nineRouterClient: NineRouterClient) {}

  async suggestJournalEntry(params: {
    description: string;
    amount: number;
    partnerName?: string;
    expenseCategory?: string;
    tier?: string;
    modelOverride?: string;
  }): Promise<AutoJournalSuggestion> {
    const systemPrompt = `Bạn là kế toán trưởng hệ thống ERP tuân thủ Hệ thống Tài khoản Kế toán Việt Nam (Thông tư 200/2014/TT-BTC & Thông tư 133/2016/TT-BTC).
Dựa trên mô tả nghiệp vụ kinh tế phát sinh, hãy gợi ý cặp tài khoản Nợ/Có chuẩn xác nhất và đánh giá độ tin cậy theo JSON schema:
{
  "debitAccount": string (ví dụ: "642", "1561", "242"),
  "creditAccount": string (ví dụ: "1111", "1121", "331"),
  "suggestedTaxAccount": string | null (ví dụ: "1331" nếu có thuế VAT đầu vào),
  "confidence": number (từ 0.0 đến 1.0),
  "explanation": string (giải thích ngắn gọn cơ sở định khoản)
}
Chỉ trả về JSON hợp lệ, không giải thích ngoài JSON.`;

    const userPrompt = `Nội dung nghiệp vụ: ${params.description}
Số tiền: ${params.amount} VNĐ
Đối tác / Người thụ hưởng: ${params.partnerName || 'Chưa xác định'}
Danh mục chi phí: ${params.expenseCategory || 'Chung'}`;

    const completion = await this.nineRouterClient.complete({
      model: params.modelOverride || params.tier || 'medium',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
    });

    const content = completion.choices[0]?.message?.content || '{}';
    return this.parseJsonResult(content);
  }

  private parseJsonResult(text: string): AutoJournalSuggestion {
    try {
      const clean = text
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      return JSON.parse(clean);
    } catch (e) {
      this.logger.warn(
        `Failed to parse accounting suggestion JSON: ${text.slice(0, 200)}`,
      );
      return {
        debitAccount: '642',
        creditAccount: '1111',
        confidence: 0.5,
        explanation: text,
      };
    }
  }
}

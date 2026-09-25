import { Injectable, Logger } from '@nestjs/common';
import { NineRouterClient } from '../clients/nine-router.client';

export interface InventoryAnomalyResult {
  itemCode: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  statusDescription: string;
  suggestedReorderQuantity: number;
  anomalyDetected: boolean;
  actionRequired: string;
}

@Injectable()
export class InventoryAiHandler {
  private readonly logger = new Logger(InventoryAiHandler.name);

  constructor(private readonly nineRouterClient: NineRouterClient) {}

  async analyzeInventoryRisk(params: {
    itemCode: string;
    currentStock: number;
    safetyStock: number;
    recentTransactions: any[];
    averageDailyUsage: number;
    tier?: string;
    modelOverride?: string;
  }): Promise<InventoryAnomalyResult> {
    const systemPrompt = `Bạn là chuyên gia kiểm soát kho và quản trị tồn kho hệ thống ERP.
Dựa trên dữ liệu tồn kho hiện tại, mức tồn an toàn và lịch sử xuất nhập gần đây, hãy phân tích rủi ro tồn kho (thiếu hàng hoặc đọng vốn) và phát hiện các biến động bất thường.
Trả về JSON chuẩn:
{
  "itemCode": string,
  "riskLevel": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "statusDescription": string,
  "suggestedReorderQuantity": number,
  "anomalyDetected": boolean,
  "actionRequired": string
}
Chỉ trả về JSON hợp lệ.`;

    const userPrompt = `Mã hàng: ${params.itemCode}
Tồn kho hiện tại: ${params.currentStock}
Mức tồn an toàn: ${params.safetyStock}
Mức tiêu thụ trung bình/ngày: ${params.averageDailyUsage}
Lịch sử giao dịch gần đây:
${JSON.stringify(params.recentTransactions, null, 2)}`;

    const completion = await this.nineRouterClient.complete({
      model: params.modelOverride || params.tier || 'high',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
    });

    const content = completion.choices[0]?.message?.content || '{}';
    return this.parseJsonResult(params.itemCode, content);
  }

  private parseJsonResult(
    itemCode: string,
    text: string,
  ): InventoryAnomalyResult {
    try {
      const clean = text
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      return JSON.parse(clean);
    } catch (e) {
      this.logger.warn(
        `Failed to parse inventory risk JSON: ${text.slice(0, 200)}`,
      );
      return {
        itemCode,
        riskLevel: 'MEDIUM',
        statusDescription: text,
        suggestedReorderQuantity: 0,
        anomalyDetected: false,
        actionRequired: 'Kiểm tra thủ công',
      };
    }
  }
}

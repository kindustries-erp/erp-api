import { Injectable, Logger } from '@nestjs/common';
import { NineRouterClient } from '../clients/nine-router.client';
import type { ChatMessage } from '../clients/nine-router.types';

@Injectable()
export class CopilotAiHandler {
  private readonly logger = new Logger(CopilotAiHandler.name);

  constructor(private readonly nineRouterClient: NineRouterClient) {}

  async chat(params: {
    messages: ChatMessage[];
    systemContext?: string;
    tier?: string;
    modelOverride?: string;
    temperature?: number;
  }): Promise<{ content: string; model: string; usage?: any }> {
    const defaultSystemPrompt = `Bạn là Trợ lý AI Thông minh (ERP Copilot) của hệ thống ERP.
Nhiệm vụ của bạn là hỗ trợ ban điều hành và nhân viên tra cứu thông tin, giải thích quy trình kinh doanh, tóm tắt báo cáo và hướng dẫn thao tác trong hệ thống ERP.
Phong cách trả lời: Ngắn gọn, chuyên nghiệp, chính xác, lịch sự, dựa trên các thông lệ chuẩn mực kế toán và quản trị doanh nghiệp.`;

    const systemMessage: ChatMessage = {
      role: 'system',
      content: params.systemContext || defaultSystemPrompt,
    };

    const completion = await this.nineRouterClient.complete({
      model: params.modelOverride || params.tier || 'high',
      messages: [systemMessage, ...params.messages],
      temperature: params.temperature !== undefined ? params.temperature : 0.3,
    });

    const content = completion.choices[0]?.message?.content || '';
    return {
      content,
      model: completion.model,
      usage: completion.usage,
    };
  }
}

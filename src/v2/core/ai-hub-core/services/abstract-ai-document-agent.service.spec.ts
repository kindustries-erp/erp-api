import { UnprocessableEntityException } from '@nestjs/common';
import {
  AiCompletionRequest,
  AiGatewayPort,
  AiTier,
} from '../contracts/ai-hub.contract';
import { AiJsonParseError } from '../helpers/ai-json.helper';
import { AbstractAiDocumentAgentService } from './abstract-ai-document-agent.service';

class DemoAgent extends AbstractAiDocumentAgentService<{ total: number }> {
  protected readonly featureCode = 'DEMO';
  protected readonly systemPrompt = 'SYS';
  protected readonly userPrompt = 'USER';
  constructor(gateway: AiGatewayPort) {
    super(gateway);
  }
  protected resolveTier(): AiTier {
    return 'low';
  }
  protected normalize(raw: Record<string, unknown>) {
    if (typeof raw.total !== 'number')
      throw new AiJsonParseError('thiếu total');
    return { total: raw.total };
  }
}

describe('AbstractAiDocumentAgentService', () => {
  const file = {
    buffer: Buffer.from('x'),
    mimeType: 'application/pdf',
    fileName: 'hd.pdf',
  };
  const reply = (content: string) => ({
    content,
    tier: 'low' as const,
    model: 'm-low',
    usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    latencyMs: 5,
  });

  it('gọi gateway theo tier, không ghi nội dung tài liệu vào meta', async () => {
    const complete = jest.fn().mockResolvedValue(reply('{"total": 10}'));
    const agent = new DemoAgent({ complete });

    const result = await agent.extract(file, { actorUserId: 'u1' });

    expect(result).toEqual({
      data: { total: 10 },
      tier: 'low',
      model: 'm-low',
      latencyMs: 5,
    });
    const request = complete.mock.calls[0][0] as AiCompletionRequest;
    expect(request.tier).toBe('low');
    expect(request.featureCode).toBe('DEMO');
    expect(request.actorUserId).toBe('u1');
    expect(request.timeoutMs).toBeUndefined();
    expect(request.meta).toEqual({
      fileName: 'hd.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1,
    });
  });

  it('truyền timeout riêng của lớp con xuống gateway', async () => {
    class SlowAgent extends DemoAgent {
      protected resolveTimeoutMs() {
        return 120000;
      }
    }
    const complete = jest.fn().mockResolvedValue(reply('{"total": 1}'));

    await new SlowAgent({ complete }).extract(file);

    expect(complete.mock.calls[0][0].timeoutMs).toBe(120000);
  });

  it('trả 422 khi model không trả JSON hoặc thiếu dữ liệu', async () => {
    const complete = jest.fn().mockResolvedValue(reply('không đọc được'));
    await expect(new DemoAgent({ complete }).extract(file)).rejects.toThrow(
      UnprocessableEntityException,
    );
    complete.mockResolvedValue(reply('{"total":"x"}'));
    await expect(new DemoAgent({ complete }).extract(file)).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('giữ nguyên lỗi của gateway', async () => {
    const complete = jest.fn().mockRejectedValue(new Error('503'));
    await expect(new DemoAgent({ complete }).extract(file)).rejects.toThrow(
      '503',
    );
  });
});

import { ConfigService } from '@nestjs/config';
import { AiGatewayClient } from '@/v2/modules/ai-hub-gateway/services/ai-gateway.client';
import { GarageInvoiceExtractService } from './garage-invoice-extract.service';

describe('GarageInvoiceExtractService', () => {
  const file = {
    buffer: Buffer.from('%PDF-'),
    mimeType: 'application/pdf',
    fileName: 'hd.pdf',
  };
  const reply = {
    content: JSON.stringify({
      invoice: { invoiceNo: 'A1' },
      lines: [{ itemName: 'Lọc dầu', quantity: 2, unitPrice: 150000 }],
    }),
    tier: 'low',
    model: 'm-low',
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    latencyMs: 1,
  };

  function build(tierEnv?: string, timeoutEnv?: string) {
    const complete = jest.fn().mockResolvedValue(reply);
    const env: Record<string, string | undefined> = {
      AI_HUB_GARAGE_INVOICE_TIER: tierEnv,
      AI_HUB_GARAGE_INVOICE_TIMEOUT_MS: timeoutEnv,
    };
    const service = new GarageInvoiceExtractService(
      { complete } as unknown as AiGatewayClient,
      { get: (key: string) => env[key] } as unknown as ConfigService,
    );
    return { service, complete };
  }

  it('mặc định dùng tier low và mã tính năng GARAGE_PR_INVOICE', async () => {
    const { service, complete } = build();

    const result = await service.extract(file, { actorUserId: 'u1' });

    expect(complete.mock.calls[0][0]).toMatchObject({
      tier: 'low',
      featureCode: 'GARAGE_PR_INVOICE',
      temperature: 0,
      timeoutMs: 120000,
    });
    expect(result.data.lines[0]).toMatchObject({
      itemName: 'Lọc dầu',
      quantity: 2,
    });
  });

  it('đổi tier qua env AI_HUB_GARAGE_INVOICE_TIER, giá trị lạ quay về low', async () => {
    const high = build('high');
    await high.service.extract(file);
    expect(high.complete.mock.calls[0][0].tier).toBe('high');

    const invalid = build('gemini-pro');
    await invalid.service.extract(file);
    expect(invalid.complete.mock.calls[0][0].tier).toBe('low');
  });

  it('timeout đọc hóa đơn đổi qua env, giá trị không hợp lệ quay về 120 giây', async () => {
    const custom = build(undefined, '180000');
    await custom.service.extract(file);
    expect(custom.complete.mock.calls[0][0].timeoutMs).toBe(180000);

    const invalid = build(undefined, '10');
    await invalid.service.extract(file);
    expect(invalid.complete.mock.calls[0][0].timeoutMs).toBe(120000);
  });
});

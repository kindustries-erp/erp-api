import { GarageProcurementOrderCommandService } from './procurement-order-command.service';

describe('GarageProcurementOrderCommandService.prepareLines - chuẩn hóa mã hàng', () => {
  it('đưa dòng qua resolver danh mục (cho tạo mã) trong transaction đang chạy', async () => {
    const resolved = [{ itemCode: 'PT-000001' }];
    const resolver = { resolveLines: jest.fn().mockResolvedValue(resolved) };
    const svc = new GarageProcurementOrderCommandService(
      {} as never,
      {} as never,
      {} as never,
      resolver as never,
    );
    const manager = {} as never;
    const lines = [{ itemName: 'Lọc dầu' }] as never;

    const result = await (
      svc as unknown as {
        prepareLines(m: unknown, l: unknown): Promise<unknown>;
      }
    ).prepareLines(manager, lines);

    expect(resolver.resolveLines).toHaveBeenCalledWith(manager, lines);
    expect(result).toBe(resolved);
  });
});

import { InventoryMovementsGarageAdjustmentCommandService } from './inventory-movements-garage-adjustment-command.service';

describe('InventoryMovementsGarageAdjustmentCommandService', () => {
  it('điều chỉnh: chiều lấy từ đầu vào của từng dòng (IN tăng, OUT giảm)', () => {
    const service = new InventoryMovementsGarageAdjustmentCommandService(
      {} as never,
      {} as never,
      {} as never,
    ) as any;
    expect(
      service.resolveDirection({
        itemCode: 'P1',
        itemName: 'x',
        qty: 1,
        direction: 'IN',
      }),
    ).toBe('IN');
    expect(
      service.resolveDirection({
        itemCode: 'P1',
        itemName: 'x',
        qty: 1,
        direction: 'OUT',
      }),
    ).toBe('OUT');
    expect(service.transactionType).toBe('ADJUSTMENT');
    expect(service.docType).toBe('GARAGE_STOCK_ADJUSTMENT');
  });
});

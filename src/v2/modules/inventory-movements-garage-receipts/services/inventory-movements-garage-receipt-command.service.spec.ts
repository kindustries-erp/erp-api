import { InventoryMovementsGarageReceiptCommandService } from './inventory-movements-garage-receipt-command.service';

describe('InventoryMovementsGarageReceiptCommandService', () => {
  it('nhập: mọi dòng là IN, loại giao dịch RECEIPT, mã chứng từ GARAGE_STOCK_RECEIPT', () => {
    const service = new InventoryMovementsGarageReceiptCommandService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    ) as any;
    expect(service.resolveDirection()).toBe('IN');
    expect(service.transactionType).toBe('RECEIPT');
    expect(service.docType).toBe('GARAGE_STOCK_RECEIPT');
  });
});

describe('InventoryMovementsGarageReceiptCommandService.prepareLines', () => {
  it('phiếu nhập tạo mã thiếu', async () => {
    const resolveLines = jest.fn().mockResolvedValue([]);
    const service = new InventoryMovementsGarageReceiptCommandService(
      {} as never,
      {} as never,
      {} as never,
      { resolveLines } as never,
    ) as any;
    await service.prepareLines({}, []);
    expect(resolveLines).toHaveBeenCalledWith({}, []);
  });
});

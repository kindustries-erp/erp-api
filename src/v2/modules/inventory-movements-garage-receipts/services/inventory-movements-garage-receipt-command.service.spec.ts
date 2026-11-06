import { InventoryMovementsGarageReceiptCommandService } from './inventory-movements-garage-receipt-command.service';

describe('InventoryMovementsGarageReceiptCommandService', () => {
  it('nhập: mọi dòng là IN, loại giao dịch RECEIPT, mã chứng từ GARAGE_STOCK_RECEIPT', () => {
    const service = new InventoryMovementsGarageReceiptCommandService(
      {} as never,
      {} as never,
      {} as never,
    ) as any;
    expect(service.resolveDirection()).toBe('IN');
    expect(service.transactionType).toBe('RECEIPT');
    expect(service.docType).toBe('GARAGE_STOCK_RECEIPT');
  });
});

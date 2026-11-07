import { InventoryMovementsGarageIssueCommandService } from './inventory-movements-garage-issue-command.service';

describe('InventoryMovementsGarageIssueCommandService', () => {
  it('xuất: mọi dòng là OUT, loại giao dịch ISSUE, mã chứng từ GARAGE_STOCK_ISSUE', () => {
    const service = new InventoryMovementsGarageIssueCommandService(
      {} as never,
      {} as never,
      {} as never,
    ) as any;
    expect(
      service.resolveDirection({ itemCode: 'P1', itemName: 'x', qty: 1 }),
    ).toBe('OUT');
    expect(service.transactionType).toBe('ISSUE');
    expect(service.docType).toBe('GARAGE_STOCK_ISSUE');
  });
});

import { INVENTORY_MOVEMENTS_GARAGE_LEDGER } from '@/v2/modules/inventory-movements-garage-ledger/config/inventory-movements-garage-ledger.config';
import { GarageProcurementFlowStockAdapter } from './garage-procurement-flow-stock.adapter';

const doc = {
  branchId: 'b1',
  documentType: 'GOODS_RECEIPT_GARAGE',
  documentId: 'r1',
  transactionDate: new Date('2026-11-11'),
  createdBy: 'u1',
};

describe('GarageProcurementFlowStockAdapter', () => {
  it('post: dòng IN/RECEIPT có giá vốn, qua sổ garage', async () => {
    const engine = { post: jest.fn(), reverse: jest.fn() };
    const adapter = new GarageProcurementFlowStockAdapter(engine as never);
    const manager = {} as never;
    await adapter.post(manager, {
      ...doc,
      lines: [
        {
          itemCode: 'P1',
          itemName: 'Phụ tùng',
          unit: 'Cái',
          qty: 2,
          unitCost: 10,
        },
      ],
    });
    expect(engine.post).toHaveBeenCalledWith(
      manager,
      INVENTORY_MOVEMENTS_GARAGE_LEDGER,
      expect.objectContaining({
        documentType: 'GOODS_RECEIPT_GARAGE',
        documentId: 'r1',
      }),
      [
        expect.objectContaining({
          itemCode: 'P1',
          direction: 'IN',
          transactionType: 'RECEIPT',
          qty: 2,
          unitCost: 10,
        }),
      ],
    );
  });

  it('reverse: đảo theo chứng từ gốc', async () => {
    const engine = { post: jest.fn(), reverse: jest.fn() };
    const adapter = new GarageProcurementFlowStockAdapter(engine as never);
    const manager = {} as never;
    await adapter.reverse(manager, doc);
    expect(engine.reverse).toHaveBeenCalledWith(
      manager,
      INVENTORY_MOVEMENTS_GARAGE_LEDGER,
      expect.objectContaining({ documentId: 'r1' }),
    );
  });
});

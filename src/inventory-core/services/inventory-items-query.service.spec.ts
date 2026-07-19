import { InventoryItemsQueryService } from './inventory-items-query.service';

describe('InventoryItemsQueryService invariants', () => {
  it('getBalances should return availableQty = qtyOnHand - qtyReserved for each item', async () => {
    const balanceRepo = {
      find: jest.fn().mockResolvedValue([
        { itemId: 'i1', qtyOnHand: '10.000', qtyReserved: '4.000' },
        { itemId: 'i2', qtyOnHand: '3.500', qtyReserved: '1.250' },
      ]),
    } as any;

    const service = new InventoryItemsQueryService({} as any, balanceRepo);

    const result = await service.getBalances('i1,i2');

    expect(result.data.i1).toEqual({
      qtyOnHand: 10,
      qtyReserved: 4,
      availableQty: 6,
    });
    expect(result.data.i2).toEqual({
      qtyOnHand: 3.5,
      qtyReserved: 1.25,
      availableQty: 2.25,
    });

    expect(result.data.i1.availableQty).toBe(
      result.data.i1.qtyOnHand - result.data.i1.qtyReserved,
    );
    expect(result.data.i2.availableQty).toBe(
      result.data.i2.qtyOnHand - result.data.i2.qtyReserved,
    );
  });
});

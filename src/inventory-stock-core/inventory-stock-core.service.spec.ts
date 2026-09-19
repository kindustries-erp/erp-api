import { InventoryStockCoreService } from './inventory-stock-core.service';

describe('InventoryStockCoreService - stock_tab filter specs', () => {
  let service: InventoryStockCoreService;
  let balanceRepo: any;
  let itemRepo: any;
  let transactionRepo: any;

  let queryBuilderMock: any;

  beforeEach(() => {
    const andWhereClauses: string[] = [];

    queryBuilderMock = {
      leftJoin: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockImplementation((clause: string) => {
        andWhereClauses.push(clause);
        return queryBuilderMock;
      }),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      setParameters: jest.fn().mockReturnThis(),
      getQuery: jest
        .fn()
        .mockReturnValue('SELECT item.id FROM erp_inventory_items item'),
      getParameters: jest.fn().mockReturnValue({}),
      clone: jest.fn().mockImplementation(() => queryBuilderMock),
      getCount: jest.fn().mockResolvedValue(1),
      getRawOne: jest.fn().mockResolvedValue({
        total_on_hand_qty: '10',
        total_reserved_qty: '2',
        total_stock_value: '100000',
      }),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'item-1',
          sku: 'SKU001',
          itemName: 'Item 1',
          status: 'ACTIVE',
          uom: { name: 'Cái' },
          itemType: { code: 'RAW' },
        },
      ]),
      getRawMany: jest.fn().mockResolvedValue([{ value: 'SKU001' }]),
      _andWhereClauses: andWhereClauses,
    };

    itemRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilderMock),
    };

    balanceRepo = {
      find: jest.fn().mockResolvedValue([
        {
          itemId: 'item-1',
          qtyOnHand: 10,
          qtyReserved: 2,
          inventoryValue: 100000,
          updatedAt: new Date(),
        },
      ]),
    };

    transactionRepo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          total_received_qty: '20',
          total_issued_qty: '10',
          total_adjusted_qty: '0',
          total_positive_adjusted_qty: '0',
          total_negative_adjusted_qty: '0',
        }),
        getRawMany: jest.fn().mockResolvedValue([
          {
            itemId: 'item-1',
            receivedQty: '20',
            issuedQty: '10',
            adjustedQty: '0',
          },
        ]),
      }),
    };

    service = new InventoryStockCoreService(
      balanceRepo,
      itemRepo,
      transactionRepo,
    );
  });

  describe('findAll with stock_tab', () => {
    it('should filter COALESCE(b.qtyOnHand, 0) > 0 when stock_tab is IN_STOCK', async () => {
      await service.findAll({
        page: 1,
        pageSize: 20,
        stock_tab: 'IN_STOCK',
      });

      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'COALESCE(b.qtyOnHand, 0) > 0',
      );
    });

    it('should filter COALESCE(b.qtyOnHand, 0) = 0 when stock_tab is OUT_OF_STOCK', async () => {
      await service.findAll({
        page: 1,
        pageSize: 20,
        stock_tab: 'OUT_OF_STOCK',
      });

      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'COALESCE(b.qtyOnHand, 0) = 0',
      );
    });

    it('should filter COALESCE(b.qtyOnHand, 0) < 0 when stock_tab is NEGATIVE', async () => {
      await service.findAll({
        page: 1,
        pageSize: 20,
        stock_tab: 'NEGATIVE',
      });

      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'COALESCE(b.qtyOnHand, 0) < 0',
      );
    });

    it('should support camelCase stockTab fallback', async () => {
      await service.findAll({
        page: 1,
        pageSize: 20,
        stockTab: 'IN_STOCK',
      });

      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'COALESCE(b.qtyOnHand, 0) > 0',
      );
    });

    it('should not add stock filter when stock_tab is ALL or empty', async () => {
      await service.findAll({
        page: 1,
        pageSize: 20,
        stock_tab: 'ALL',
      });

      const calls = queryBuilderMock.andWhere.mock.calls;
      const hasStockFilter = calls.some((c: any[]) =>
        c[0]?.includes('qtyOnHand'),
      );
      expect(hasStockFilter).toBe(false);
    });
  });

  describe('getColumnOptions with stockTab', () => {
    it('should apply stockTab filter in getColumnOptions', async () => {
      await service.getColumnOptions(
        'item_code',
        undefined,
        1,
        20,
        undefined,
        'IN_STOCK',
      );

      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'COALESCE(b.qtyOnHand, 0) > 0',
      );
    });

    it('should query tracking_policy column options with trackingPolicy.code', async () => {
      await service.getColumnOptions(
        'tracking_policy',
        undefined,
        1,
        20,
        undefined,
        'ALL',
      );

      expect(queryBuilderMock.leftJoin).toHaveBeenCalledWith(
        'item.trackingPolicy',
        'trackingPolicy',
      );
      expect(queryBuilderMock.select).toHaveBeenCalledWith(
        'DISTINCT trackingPolicy.code',
        'value',
      );
    });
  });

  describe('tracking_policy search & filters', () => {
    it('should return tracking_policy_code and tracking_policy_name in findAll', async () => {
      queryBuilderMock.getMany.mockResolvedValueOnce([
        {
          id: 'item-1',
          sku: 'SKU001',
          itemName: 'Item 1',
          status: 'ACTIVE',
          uom: { name: 'Cái' },
          itemType: { code: 'RAW' },
          trackingPolicy: {
            id: 'tp-1',
            code: 'SERIAL',
            name: 'Theo dõi Serial',
          },
        },
      ]);

      const res = await service.findAll({
        page: 1,
        pageSize: 20,
      });

      expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledWith(
        'item.trackingPolicy',
        'trackingPolicy',
      );
      expect(res.items[0]).toHaveProperty('tracking_policy_code', 'SERIAL');
      expect(res.items[0]).toHaveProperty(
        'tracking_policy_name',
        'Theo dõi Serial',
      );
    });

    it('should apply tracking_policy column search', async () => {
      await service.findAll({
        page: 1,
        pageSize: 20,
        searches: JSON.stringify({ tracking_policy: 'SERIAL' }),
      });

      expect(queryBuilderMock.andWhere).toHaveBeenCalled();
    });

    it('should apply tracking_policy column filters', async () => {
      await service.findAll({
        page: 1,
        pageSize: 20,
        filters: JSON.stringify({ tracking_policy: ['SERIAL', 'VEHICLE'] }),
      });

      expect(queryBuilderMock.andWhere).toHaveBeenCalled();
    });

    it('should calculate and return grand total summary across all matching items', async () => {
      const res = await service.findAll({
        page: 1,
        pageSize: 20,
      });

      expect(res).toHaveProperty('summary');
      expect(res.summary).toEqual({
        total_received_qty: 20,
        total_issued_qty: 10,
        total_adjusted_qty: 0,
        total_positive_adjusted_qty: 0,
        total_negative_adjusted_qty: 0,
        total_on_hand_qty: 10,
        total_reserved_qty: 2,
        total_stock_value: 100000,
      });
    });
  });
});

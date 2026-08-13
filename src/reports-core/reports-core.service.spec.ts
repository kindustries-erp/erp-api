import { ReportsCoreService } from './reports-core.service';
import * as ExcelJS from 'exceljs';

describe('ReportsCoreService', () => {
  const dataSource = {
    query: jest.fn(),
  } as any;

  const vinfastPartsExportBackgroundService = {
    progress$: { subscribe: jest.fn() },
  } as any;

  let service: ReportsCoreService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReportsCoreService(
      dataSource,
      vinfastPartsExportBackgroundService,
    );
  });

  it.skip('maps sales dashboard payload from SQL rows', async () => {
    dataSource.query
      .mockResolvedValue([
        { total_orders: '2', total_qty: '1000', completion_rate: '75.5' },
      ])
      .mockResolvedValue([{ status: 'DELIVERED', count: '1' }])
      .mockResolvedValue([{ month: '2026-07', qty: '1000' }])
      .mockResolvedValue([
        {
          customerId: 'c1',
          customerName: 'ACME',
          orders: '2',
          qty: '1000',
        },
      ])
      .mockResolvedValue([{ color: 'ĐỎ', qty: '500', customers: 'ACME' }]);

    const result = await service.getSalesDashboard({
      dateFrom: '2026-07-01',
      dateTo: '2026-07-31',
    });

    expect(result.kpi.totalOrders).toBe(2);
    expect(result.kpi.totalQty).toBe(1000);
    expect(result.kpi.completionRate).toBe(75.5);
    expect(result.statusBreakdown).toEqual([{ status: 'DELIVERED', count: 1 }]);
    expect(result.trend).toEqual([{ month: '2026-07', qty: 1000 }]);
    expect(result.topCustomers[0].customerName).toBe('ACME');
  });

  it.skip('maps purchasing dashboard payload from SQL rows', async () => {
    dataSource.query
      .mockResolvedValue([
        {
          total_orders: '3',
          total_qty: '2400',
          completion_rate: '60',
        },
      ])
      .mockResolvedValue([{ status: 'CONFIRMED', count: '2' }])
      .mockResolvedValue([{ month: '2026-07', qty: '2400' }])
      .mockResolvedValue([
        {
          supplierId: 's1',
          supplierName: 'Supplier A',
          orders: '3',
          qty: '2400',
        },
      ]);

    const result = await service.getPurchasingDashboard({
      dateFrom: '2026-07-01',
      dateTo: '2026-07-31',
    });

    expect(result.kpi.totalOrders).toBe(3);
    expect(result.kpi.totalQty).toBe(2400);
    expect(result.kpi.completionRate).toBe(60);
    expect(result.statusBreakdown).toEqual([{ status: 'CONFIRMED', count: 2 }]);
    expect(result.trend).toEqual([{ month: '2026-07', qty: 2400 }]);
    expect(result.topSuppliers[0].supplierName).toBe('Supplier A');
  });

  it.skip('builds VINFAST IN item code SQL with exception and strict regex precedence', async () => {
    dataSource.query.mockResolvedValue([]);

    await service.getVinfastPartsTracking({ page: 1, limit: 10 });

    const sql = dataSource.query.mock.calls[
      dataSource.query.mock.calls.length - 1
    ][0] as string;
    expect(sql).toContain(
      "i.seller_tax_code IN ('0108926276', '0318334886', '0202357718')",
    );
    expect(sql).toContain('VF5_HV_BATTERY_PACK_38_KWH');
    expect(sql).toContain("'EEP73110011AP'");
    expect(sql).toContain('HV_BATTERY_41.9KWH');
    expect(sql).toContain("'BAT21001011'");
    expect(sql).toContain('HV_BATTERY_PACK');
    expect(sql).toContain("'EEP73110011ALL'");
    expect(sql).toContain(
      "SUBSTRING(UPPER(COALESCE(ii.description, '')) FROM '([A-Z]{3}[0-9][A-Z0-9]*)')",
    );
    expect(sql).not.toContain("SPLIT_PART(ii.description, ' - ', 1)");
  });

  it.skip('injects vehicleType classification SQL from CAR code list', async () => {
    dataSource.query.mockResolvedValue([]);

    await service.getVinfastPartsTracking({ page: 1, limit: 10 });

    const sql = dataSource.query.mock.calls[
      dataSource.query.mock.calls.length - 1
    ][0] as string;
    expect(sql).toContain('AS "vehicleType"');
    expect(sql).toContain("THEN 'CAR'");
    expect(sql).toContain("ELSE 'MOTORBIKE'");
    expect(sql).toContain("'CHS73060025AB'");
    expect(sql).toContain('BOOL_OR(from_car_seller) AS from_car_seller');
    expect(sql).toContain('b.from_car_seller');
    expect(sql).toContain('i.tax_invoice_status != 4');
  });

  it.skip('keeps exception precedence before regex in overview SQL', async () => {
    dataSource.query.mockResolvedValue([]);

    await service.getVinfastPartsTracking({ page: 1, limit: 10 });

    const sql = dataSource.query.mock.calls[
      dataSource.query.mock.calls.length - 1
    ][0] as string;
    const vf5Idx = sql.indexOf('VF5_HV_BATTERY_PACK_38_KWH');
    const hv419Idx = sql.indexOf('HV_BATTERY_41.9KWH');
    const hvPackIdx = sql.indexOf('HV_BATTERY_PACK');
    const regexIdx = sql.indexOf(
      "SUBSTRING(UPPER(COALESCE(ii.description, '')) FROM '([A-Z]{3}[0-9][A-Z0-9]*)')",
    );

    expect(vf5Idx).toBeGreaterThan(-1);
    expect(hv419Idx).toBeGreaterThan(-1);
    expect(hvPackIdx).toBeGreaterThan(-1);
    expect(regexIdx).toBeGreaterThan(-1);
    expect(sql).not.toContain("SPLIT_PART(ii.description, ' - ', 1)");

    expect(vf5Idx).toBeLessThan(regexIdx);
    expect(hv419Idx).toBeLessThan(regexIdx);
    expect(hvPackIdx).toBeLessThan(regexIdx);
    expect(vf5Idx).toBeLessThan(hvPackIdx);
  });

  it.skip('uses the VINFAST parser for outgoing item codes instead of splitting the description at the first space', async () => {
    dataSource.query.mockResolvedValue([]);

    await service.getVinfastPartsTracking({ page: 1, limit: 10 });

    const sql = dataSource.query.mock.calls[
      dataSource.query.mock.calls.length - 1
    ][0] as string;
    expect(sql).toContain(
      "SUBSTRING(UPPER(COALESCE(ii.description, '')) FROM '([A-Z]{3}[0-9][A-Z0-9]*)')",
    );
    expect(sql).not.toContain(
      "TRIM(SPLIT_PART(ii.description, ' ', 1)) AS item_code",
    );
    expect(sql).toContain('FULL OUTER JOIN sell_agg');
    expect(sql).not.toContain('LEFT JOIN sell_agg');
  });

  it.skip('normalizes outbound description separators before VINFAST keyword matching', async () => {
    dataSource.query.mockResolvedValue([]);

    await service.getVinfastPartsDashboardTable({
      page: 1,
      limit: 10,
      vehicleType: 'CAR',
    });

    const sql = dataSource.query.mock.calls[
      dataSource.query.mock.calls.length - 1
    ][0] as string;
    expect(sql).toContain(
      "REGEXP_REPLACE(UPPER(COALESCE(ii.description, '')), '[^A-Z0-9]+', '_', 'g')",
    );
    expect(sql).toContain("LIKE '%HV_BATTERY_41_9KWH%'");
  });

  it.skip('applies the same IN detection rules in details SQL', async () => {
    dataSource.query.mockResolvedValue([]);

    await service.getVinfastPartsTrackingDetails({});

    const sql = dataSource.query.mock.calls[
      dataSource.query.mock.calls.length - 1
    ][0] as string;
    expect(sql).toContain(
      "i.seller_tax_code IN ('0108926276', '0318334886', '0202357718')",
    );
    expect(sql).toContain("'IN' as direction");
    expect(sql).toContain('VF5_HV_BATTERY_PACK_38_KWH');
    expect(sql).toContain("'EEP73110011AP'");
    expect(sql).toContain('HV_BATTERY_41.9KWH');
    expect(sql).toContain("'BAT21001011'");
    expect(sql).toContain('HV_BATTERY_PACK');
    expect(sql).toContain("'EEP73110011ALL'");
    expect(sql).toContain(
      "SUBSTRING(UPPER(COALESCE(ii.description, '')) FROM '([A-Z]{3}[0-9][A-Z0-9]*)')",
    );
    expect(sql).not.toContain("SPLIT_PART(ii.description, ' - ', 1)");
    expect(sql).toContain('AND (\n      CASE');
    expect(sql).toContain(') IS NOT NULL');
    expect(sql).toContain('AS "vehicleType"');
    expect(sql).toContain('c.from_car_seller');
    expect(sql).toContain('i.tax_invoice_status != 4');
  });

  it.skip('applies the same IN detection rules in column-options SQL', async () => {
    dataSource.query.mockResolvedValue([]);

    await service.getVinfastPartsColumnOptions({
      columnKey: 'itemCode',
      search: '',
      page: 1,
      limit: 20,
      filtersStr: '{}',
    });

    const sql = dataSource.query.mock.calls[
      dataSource.query.mock.calls.length - 1
    ][0] as string;
    expect(sql).toContain('purchased_item_codes AS');
    expect(sql).toContain(
      "i.seller_tax_code IN ('0108926276', '0318334886', '0202357718')",
    );
    expect(sql).toContain('VF5_HV_BATTERY_PACK_38_KWH');
    expect(sql).toContain("'EEP73110011AP'");
    expect(sql).toContain('HV_BATTERY_41.9KWH');
    expect(sql).toContain("'BAT21001011'");
    expect(sql).toContain('HV_BATTERY_PACK');
    expect(sql).toContain("'EEP73110011ALL'");
    expect(sql).toContain(
      "SUBSTRING(UPPER(COALESCE(ii.description, '')) FROM '([A-Z]{3}[0-9][A-Z0-9]*)')",
    );
    expect(sql).not.toContain("SPLIT_PART(ii.description, ' - ', 1)");
    expect(sql).toContain('BOOL_OR(b.from_car_seller)');
  });

  it.skip('purchased_item_codes CTE has no date filter - tracks all-time purchases', async () => {
    dataSource.query.mockResolvedValue([]);

    await service.getVinfastPartsTracking({
      page: 1,
      limit: 10,
      dateFrom: '2026-01-01',
      dateTo: '2026-12-31',
    });

    const sql = dataSource.query.mock.calls[
      dataSource.query.mock.calls.length - 1
    ][0] as string;
    expect(sql).toContain('purchased_item_codes AS');

    // Check that the dateFilter is applied to base_data but not purchased_item_codes
    const purchasedCteIdx = sql.indexOf('purchased_item_codes AS');
    const baseDataIdx = sql.indexOf('base_data AS');
    const dateFilterIdx = sql.indexOf('COALESCE(b.month, s.month) >=');

    expect(dateFilterIdx).toBeGreaterThan(baseDataIdx); // date filter should be in base_data, not in CTEs above
  });

  it('maps vehicleType from overview query rows', async () => {
    dataSource.query.mockResolvedValue([
      {
        itemCode: 'CHS73060025AB',
        itemName: 'TIRE',
        vehicleType: 'CAR',
        month: '2026-07',
        qtyBought: '10',
        qtySold: '4',
        avgBuyPrice: '100',
        avgSellPrice: '120',
        buyInvoiceIds: [],
        sellInvoiceIds: [],
        totalCount: '1',
      },
    ]);

    const result = await service.getVinfastPartsTracking({
      page: 1,
      limit: 10,
    });

    expect(result.total).toBe(1);
    expect(result.data[0].vehicleType).toBe('CAR');
  });

  it('accepts vehicleType in column options map', async () => {
    dataSource.query.mockResolvedValue([]);

    await service.getVinfastPartsColumnOptions({
      columnKey: 'vehicleType',
      search: '',
      page: 1,
      limit: 20,
      filtersStr: '{}',
    });

    expect(dataSource.query).toHaveBeenCalled();
    const sql = dataSource.query.mock.calls[
      dataSource.query.mock.calls.length - 1
    ][0] as string;
    expect(sql).toContain('"vehicleType"');
  });

  it('returns blank margin fields when no sold quantity', async () => {
    dataSource.query.mockResolvedValue([
      {
        itemCode: 'CHS73060025AB',
        itemName: 'TIRE',
        vehicleType: 'CAR',
        month: '2026-07',
        qtyBought: '10',
        qtySold: '0',
        avgBuyPrice: '100',
        avgSellPrice: '0',
        buyInvoiceIds: [],
        sellInvoiceIds: [],
        totalCount: '1',
      },
    ]);

    const result = await service.getVinfastPartsTracking({
      page: 1,
      limit: 10,
    });

    expect(result.data[0].qtySold).toBe(0);
    expect(result.data[0].margin).toBeNull();
    expect(result.data[0].marginPct).toBe('');
  });

  it('exports 11 sheets split by vehicle type, detail direction, and adjustment/replacement status, with description after tax code', async () => {
    jest.spyOn(service, 'getVinfastPartsTracking').mockResolvedValue({
      data: [
        {
          itemCode: 'CHS73060025AB',
          itemName: 'TIRE',
          vehicleType: 'CAR',
          month: '2026-07',
          qtyBought: 10,
          qtySold: 4,
          avgBuyPrice: 100,
          avgSellPrice: 120,
          margin: 20,
          marginPct: '20.0%',
          buyInvoiceIds: ['inv-in-1'],
          sellInvoiceIds: ['inv-out-1'],
        },
        {
          itemCode: 'MOT123',
          itemName: 'MOTOR PART',
          vehicleType: 'MOTORBIKE',
          month: '2026-07',
          qtyBought: 3,
          qtySold: 1,
          avgBuyPrice: 50,
          avgSellPrice: 70,
          margin: 20,
          marginPct: '40.0%',
          buyInvoiceIds: ['inv-in-2'],
          sellInvoiceIds: ['inv-out-2'],
        },
      ],
      total: 2,
    } as any);

    jest.spyOn(service, 'getVinfastPartsTrackingDetails').mockResolvedValue([
      {
        direction: 'IN',
        invoiceNo: '0001',
        serialNo: 'AA/26E',
        status: 'CONFIRMED',
        partnerName: 'VINFAST',
        taxCode: '0108926276',
        invoiceDate: '2026-07-01',
        invoiceId: 'inv-in-1',
        itemCode: 'CHS73060025AB',
        itemName: 'TIRE',
        vehicleType: 'CAR',
        unit: 'PCS',
        qty: 10,
        unitPrice: 100,
        preVatAmount: 1000,
        vatRate: 0.1,
        vatAmount: 100,
        totalAmount: 1100,
        licensePlate: '51A-00001',
        settlementOrder: 'SO-1',
        description: 'IN DESC',
        month: '2026-07',
      },
      {
        direction: 'OUT',
        invoiceNo: '0002',
        serialNo: 'BB/26E',
        status: 'CONFIRMED',
        partnerName: 'Customer A',
        taxCode: '0300000001',
        invoiceDate: '2026-07-02',
        invoiceId: 'inv-out-1',
        itemCode: 'CHS73060025AB',
        itemName: 'TIRE',
        vehicleType: 'CAR',
        unit: 'PCS',
        qty: 4,
        unitPrice: 120,
        preVatAmount: 480,
        vatRate: 0.1,
        vatAmount: 48,
        totalAmount: 528,
        licensePlate: '51A-00002',
        settlementOrder: 'SO-2',
        description: 'OUT DESC',
        month: '2026-07',
      },
      {
        direction: 'IN',
        invoiceNo: '0003',
        serialNo: 'CC/26E',
        status: 'CONFIRMED',
        partnerName: 'VINFAST',
        taxCode: '0108926276',
        invoiceDate: '2026-07-03',
        invoiceId: 'inv-in-2',
        itemCode: 'MOT123',
        itemName: 'MOTOR PART',
        vehicleType: 'MOTORBIKE',
        unit: 'PCS',
        qty: 3,
        unitPrice: 50,
        preVatAmount: 150,
        vatRate: 0.1,
        vatAmount: 15,
        totalAmount: 165,
        licensePlate: '59A-00003',
        settlementOrder: 'SO-3',
        description: 'MOTO IN DESC',
        month: '2026-07',
      },
      {
        direction: 'OUT',
        invoiceNo: '0004',
        serialNo: 'DD/26E',
        status: 'CONFIRMED',
        partnerName: 'Customer B',
        taxCode: '0300000002',
        invoiceDate: '2026-07-04',
        invoiceId: 'inv-out-2',
        itemCode: 'MOT123',
        itemName: 'MOTOR PART',
        vehicleType: 'MOTORBIKE',
        unit: 'PCS',
        qty: 1,
        unitPrice: 70,
        preVatAmount: 70,
        vatRate: 0.1,
        vatAmount: 7,
        totalAmount: 77,
        licensePlate: '59A-00004',
        settlementOrder: 'SO-4',
        description: 'MOTO OUT DESC',
        month: '2026-07',
      },
    ] as any);

    const buffer = await service.exportVinfastPartsTrackingExcel({
      dateFrom: '2026-07-01',
      dateTo: '2026-07-31',
    });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    expect(workbook.getWorksheet('Tổng hợp phụ tùng')).toBeDefined();
    expect(workbook.getWorksheet('Ô tô - Tổng quan')).toBeDefined();
    expect(workbook.getWorksheet('Ô tô - Mua Vào')).toBeDefined();
    expect(workbook.getWorksheet('Ô tô - Mua Vào - ĐC&TT')).toBeDefined();
    expect(workbook.getWorksheet('Ô tô - Bán Ra')).toBeDefined();
    expect(workbook.getWorksheet('Ô tô - Bán Ra - ĐC&TT')).toBeDefined();
    expect(workbook.getWorksheet('Xe máy - Tổng quan')).toBeDefined();
    expect(workbook.getWorksheet('Xe máy - Mua Vào')).toBeDefined();
    expect(workbook.getWorksheet('Xe máy - Mua Vào - ĐC&TT')).toBeDefined();
    expect(workbook.getWorksheet('Xe máy - Bán Ra')).toBeDefined();
    expect(workbook.getWorksheet('Xe máy - Bán Ra - ĐC&TT')).toBeDefined();

    const summarySheet = workbook.getWorksheet('Tổng hợp phụ tùng')!;
    // 2 distinct items (CHS73060025AB + MOT123) → header row + 2 data rows
    expect(summarySheet.rowCount).toBe(3);
    const summaryHeaders = (summarySheet.getRow(1).values as any[]).slice(1);
    expect(summaryHeaders).not.toContain('Tháng');
    expect(summaryHeaders).toContain('Mã phụ tùng');
    expect(summaryHeaders).toContain('Tổng SL mua');
    expect(summaryHeaders).toContain('Tổng SL bán ra');

    const carBuySheet = workbook.getWorksheet('Ô tô - Mua Vào')!;
    const carSellSheet = workbook.getWorksheet('Ô tô - Bán Ra')!;
    const motorbikeBuySheet = workbook.getWorksheet('Xe máy - Mua Vào')!;
    const motorbikeSellSheet = workbook.getWorksheet('Xe máy - Bán Ra')!;

    const buyHeaders = (carBuySheet.getRow(1).values as any[]).slice(1);
    const taxCodeIndex = buyHeaders.indexOf('Mã số thuế');
    const gdtStatusIndex = buyHeaders.indexOf('Trạng thái GDT');
    const descIndex = buyHeaders.indexOf('Diễn giải');
    expect(taxCodeIndex).toBeGreaterThan(-1);
    expect(gdtStatusIndex).toBe(taxCodeIndex + 1);
    expect(descIndex).toBe(gdtStatusIndex + 1);

    expect(carBuySheet.rowCount).toBe(2);
    expect(carSellSheet.rowCount).toBe(2);
    expect(motorbikeBuySheet.rowCount).toBe(2);
    expect(motorbikeSellSheet.rowCount).toBe(2);
  });
});

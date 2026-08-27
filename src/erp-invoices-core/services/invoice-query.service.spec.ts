import { InvoiceQueryService } from './invoice-query.service';
import * as queryBuilderUtil from '../../common/utils/query-builder.util';
import * as ExcelJS from 'exceljs';

describe('InvoiceQueryService', () => {
  const createQbMock = () => {
    const qb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    return qb;
  };

  const createRawQbMock = (rows: any[] = []) => {
    const rawQb: any = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(rows),
    };
    return rawQb;
  };

  const createRepositoryMock = (qb: any, rawRows: any[] = []) => ({
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    manager: {
      query: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn().mockReturnValue(createRawQbMock(rawRows)),
    },
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('exportExcel uses applyMultiKeywordMultiFieldFilter for invoiceNo column search across invoice_no and serial_no', async () => {
    const qb = createQbMock();
    const repository = createRepositoryMock(qb) as any;

    const service = new InvoiceQueryService(repository, {
      find: jest.fn().mockResolvedValue([]),
    } as any);
    const multiFieldSpy = jest.spyOn(
      queryBuilderUtil,
      'applyMultiKeywordMultiFieldFilter',
    );

    await service.exportExcel({
      direction: 'IN',
      column_search: JSON.stringify({ invoiceNo: 'SO-123; SO-456' }),
    });

    expect(multiFieldSpy).toHaveBeenCalledWith(
      qb,
      ['inv.invoice_no', 'inv.serial_no'],
      'SO-123; SO-456',
      'invoiceNoSearch',
    );
  });

  it('exportExcel uses multi-field helper for partner search when direction is omitted', async () => {
    const qb = createQbMock();
    const repository = createRepositoryMock(qb) as any;

    const service = new InvoiceQueryService(repository, {
      find: jest.fn().mockResolvedValue([]),
    } as any);
    const multiFieldSpy = jest.spyOn(
      queryBuilderUtil,
      'applyMultiKeywordMultiFieldFilter',
    );

    await service.exportExcel({
      column_search: JSON.stringify({ partner: 'A; B' }),
    });

    expect(multiFieldSpy).toHaveBeenCalledWith(
      qb,
      [
        'inv.seller_name',
        'inv.seller_tax_code',
        'inv.buyer_name',
        'inv.buyer_personal_name',
        'inv.buyer_tax_code',
      ],
      'A; B',
      'partnerSearch',
    );
  });

  it('exportExcel places itemName and uom right after invoiceDate in Hàng hóa sheet', async () => {
    const qb = createQbMock();
    qb.getMany.mockResolvedValue([
      {
        id: 'inv-1',
        invoiceDate: '2026-07-31',
        serialNo: 'C26ABC',
        invoiceNo: '12345',
        sellerName: 'CÔNG TY TNHH ABC',
        sellerTaxCode: '0123456789',
        sellerAddress: 'Q1',
        preVatAmount: 100000,
        vatRate: '8',
        vatAmount: 8000,
        totalAmount: 108000,
        licensePlate: '51A-12345',
        settlementOrder: 'WO-001',
        description: 'Phi dich vu',
        taxInvoiceStatus: 1,
        branchId: null,
        items: [
          {
            description: 'Loc gio dieu hoa',
            unit: 'Cai',
            quantity: 2,
            unitPrice: 50000,
            preVatAmount: 100000,
            vatRate: '8',
            vatAmount: 8000,
            totalAmount: 108000,
          },
        ],
      },
    ]);

    const repository = createRepositoryMock(qb) as any;

    const service = new InvoiceQueryService(repository, {
      find: jest.fn().mockResolvedValue([]),
    } as any);
    const buffer = await service.exportExcel({ direction: 'IN' });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const detailedSheet = workbook.getWorksheet('Hàng hóa');
    expect(detailedSheet).toBeDefined();

    const headers = detailedSheet!.getRow(1).values as any[];
    expect(headers[1]).toBe('Ngày phát hành');
    expect(headers[2]).toBe('Tên hàng hóa, dịch vụ');
    expect(headers[3]).toBe('Đơn vị tính');
  });

  it('exportExcel adds Tổng quan hàng hóa sheet without invoiceDate column', async () => {
    const qb = createQbMock();
    qb.getMany.mockResolvedValue([
      {
        id: 'inv-1',
        invoiceDate: '2026-07-31',
        serialNo: 'C26ABC',
        invoiceNo: '12345',
        sellerName: 'CÔNG TY TNHH ABC',
        sellerTaxCode: '0123456789',
        sellerAddress: 'Q1',
        preVatAmount: 300000,
        vatRate: '8',
        vatAmount: 24000,
        totalAmount: 324000,
        licensePlate: '51A-12345',
        settlementOrder: 'WO-001',
        description: 'Phi dich vu',
        taxInvoiceStatus: 1,
        branchId: null,
        items: [
          {
            description: 'Loc gio dieu hoa',
            unit: 'Cai',
            quantity: 2,
            unitPrice: 50000,
            preVatAmount: 100000,
            vatRate: '8',
            vatAmount: 8000,
            totalAmount: 108000,
          },
          {
            description: 'Loc gio dieu hoa',
            unit: 'Cai',
            quantity: 4,
            unitPrice: 50000,
            preVatAmount: 200000,
            vatRate: '8',
            vatAmount: 16000,
            totalAmount: 216000,
          },
        ],
      },
    ]);

    const repository = createRepositoryMock(qb) as any;

    const service = new InvoiceQueryService(repository, {
      find: jest.fn().mockResolvedValue([]),
    } as any);
    const buffer = await service.exportExcel({ direction: 'IN' });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const overviewSheet = workbook.getWorksheet('Tổng quan hàng hóa');
    expect(overviewSheet).toBeDefined();

    const headers = overviewSheet!.getRow(1).values as any[];
    expect(headers).toContain('Tên hàng hóa, dịch vụ');
    expect(headers).toContain('Số lượng');
    expect(headers).not.toContain('Ngày phát hành');

    const firstDataRow = overviewSheet!.getRow(2).values as any[];
    expect(firstDataRow[1]).toBe('Loc gio dieu hoa');
    expect(firstDataRow[2]).toBe('Cai');
    expect(firstDataRow[3]).toBe(6);
    expect(firstDataRow[5]).toBe(300000);
    expect(firstDataRow[6]).toBe(24000);
    expect(firstDataRow[7]).toBe(324000);
  });

  it('uses normalized discount values in the overview sheet for export reports', async () => {
    const qb = createQbMock();
    qb.getMany.mockResolvedValue([
      {
        id: 'inv-1',
        invoiceDate: '2026-07-31',
        serialNo: 'C26ABC',
        invoiceNo: '12345',
        buyerName: 'CÔNG TY TNHH ABC',
        buyerTaxCode: '0110269067',
        buyerAddress: 'Q1',
        preVatAmount: 200000,
        vatRate: '0',
        vatAmount: 0,
        totalAmount: 200000,
        discountAmount: 200000,
        direction: 'OUT',
        description: 'Header line\nSecond line',
        taxInvoiceStatus: 1,
        branchId: null,
        items: [
          {
            description: 'Chiết khấu cuối kỳ',
            unit: 'Lần',
            quantity: 1,
            unitPrice: 200000,
            preVatAmount: 200000,
            vatRate: '0',
            vatAmount: 0,
            totalAmount: 200000,
            discountAmount: 200000,
          },
        ],
      },
    ]);

    const repository = createRepositoryMock(qb) as any;
    const service = new InvoiceQueryService(repository, {
      find: jest.fn().mockResolvedValue([]),
    } as any);
    const buffer = await service.exportExcel({ direction: 'OUT' });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const overviewSheet = workbook.getWorksheet('Tổng quan hàng hóa');
    const overviewRows =
      overviewSheet!.getRows(2, overviewSheet!.rowCount - 1) || [];
    const discountRow = overviewRows.find((row) => {
      const cellValue = row.getCell(1).value;
      const normalizedCellValue =
        typeof cellValue === 'string'
          ? cellValue
          : typeof cellValue === 'number'
            ? `${cellValue}`
            : '';
      return normalizedCellValue.trim() === 'Chiết khấu cuối kỳ';
    });

    expect(discountRow).toBeDefined();
    expect(discountRow!.getCell(5).value).toBe(-200000);
    expect(discountRow!.getCell(7).value).toBe(-200000);
  });

  it('findAllItems queries items and returns paginated result with summary', async () => {
    const itemQb: any = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      clone: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          total_quantity: '5',
          total_pre_vat_amount: '1000000',
          total_vat_amount: '100000',
          total_discount_amount: '0',
          total_amount: '1100000',
        }),
      }),
      getCount: jest.fn().mockResolvedValue(1),
      select: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        {
          id: 'item-uuid-1',
          invoice_id: 'inv-uuid-1',
          item_code: 'VT-01',
          description: 'Lốp xe VinFast',
          unit: 'Cái',
          quantity: '5',
          unit_price: '200000',
          pre_vat_amount: '1000000',
          vat_rate: '10',
          vat_amount: '100000',
          discount_amount: '0',
          total_amount: '1100000',
          invoice_subcategory: 'NORMAL',
          invoice_no: '0000123',
          serial_no: '1C24TYY',
          invoice_date: '2026-08-20',
          direction: 'IN',
          status: 'CONFIRMED',
          posting_status: 'POSTED',
          seller_name: 'VinFast Auto',
          seller_tax_code: '0108926276',
        },
      ]),
    };

    const itemRepo: any = {
      createQueryBuilder: jest.fn().mockReturnValue(itemQb),
    };

    const service = new InvoiceQueryService(
      {} as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
      itemRepo,
    );

    const result = await service.findAllItems({
      direction: 'IN',
      search: 'VinFast',
      page: 1,
      pageSize: 20,
    });

    expect(itemRepo.createQueryBuilder).toHaveBeenCalledWith('ii');
    expect(result.total).toBe(1);
    expect(result.items.length).toBe(1);
    expect(result.items[0].itemCode).toBe('VT-01');
    expect(result.items[0].description).toBe('Lốp xe VinFast');
    expect(result.items[0].sellerName).toBe('VinFast Auto');
    expect(result.summary.totalAmount).toBe(1100000);
    expect(result.summary.totalQuantity).toBe(5);
  });

  it('getItemColumnOptions returns distinct options for item columns', async () => {
    const itemQb: any = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      clone: jest.fn().mockReturnValue({
        getCount: jest.fn().mockResolvedValue(2),
      }),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawMany: jest
        .fn()
        .mockResolvedValue([{ value: 'Bánh xe' }, { value: 'Lốp xe' }]),
    };

    const itemRepo: any = {
      createQueryBuilder: jest.fn().mockReturnValue(itemQb),
    };

    const service = new InvoiceQueryService(
      {} as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
      itemRepo,
    );

    const res = await service.getItemColumnOptions(
      'description',
      'xe',
      1,
      20,
      undefined,
      'IN',
    );

    expect(res.total).toBe(2);
    expect(res.items).toEqual([
      { value: 'Bánh xe', label: 'Bánh xe', secondaryLabel: undefined },
      { value: 'Lốp xe', label: 'Lốp xe', secondaryLabel: undefined },
    ]);
  });
});

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

  it('exportExcel uses applyMultiKeywordFilter for invoiceNo column search', async () => {
    const qb = createQbMock();
    const repository = createRepositoryMock(qb) as any;

    const service = new InvoiceQueryService(repository);
    const multiKeywordSpy = jest.spyOn(
      queryBuilderUtil,
      'applyMultiKeywordFilter',
    );

    await service.exportExcel({
      direction: 'IN',
      column_search: JSON.stringify({ invoiceNo: 'SO-123; SO-456' }),
    });

    expect(multiKeywordSpy).toHaveBeenCalledWith(
      qb,
      'inv.invoice_no',
      'SO-123; SO-456',
      'invoiceNoSearch',
    );

    const usedRawSimplePattern = qb.andWhere.mock.calls.some(
      (call: any[]) => call[0] === 'inv.invoice_no ILIKE :invoiceNoSearch',
    );
    expect(usedRawSimplePattern).toBe(false);
  });

  it('exportExcel uses multi-field helper for partner search when direction is omitted', async () => {
    const qb = createQbMock();
    const repository = createRepositoryMock(qb) as any;

    const service = new InvoiceQueryService(repository);
    const multiFieldSpy = jest.spyOn(
      queryBuilderUtil,
      'applyMultiKeywordMultiFieldFilter',
    );

    await service.exportExcel({
      column_search: JSON.stringify({ partner: 'A; B' }),
    });

    expect(multiFieldSpy).toHaveBeenCalledWith(
      qb,
      ['inv.seller_name', 'inv.buyer_name'],
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

    const service = new InvoiceQueryService(repository);
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

    const service = new InvoiceQueryService(repository);
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
});

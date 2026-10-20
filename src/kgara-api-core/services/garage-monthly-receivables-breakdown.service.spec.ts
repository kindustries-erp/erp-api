import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GarageMonthlyReceivablesBreakdownService } from './garage-monthly-receivables-breakdown.service';
import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraCaseSettlement } from '../entities/kgara_case_settlement.entity';
import { KgaraCaseLinkedInvoice } from '../entities/kgara_case_linked_invoice.entity';
import { KgaraGrossProfit } from '../entities/kgara_gross_profit.entity';

describe('GarageMonthlyReceivablesBreakdownService', () => {
  let service: GarageMonthlyReceivablesBreakdownService;
  let mockCaseRepo: any;
  let mockSettlementRepo: any;
  let mockLinkedInvoiceRepo: any;
  let mockGrossProfitRepo: any;

  beforeEach(async () => {
    mockCaseRepo = {
      createQueryBuilder: jest.fn(),
    };
    mockSettlementRepo = {
      createQueryBuilder: jest.fn(),
    };
    mockLinkedInvoiceRepo = {
      createQueryBuilder: jest.fn(),
    };
    mockGrossProfitRepo = {
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GarageMonthlyReceivablesBreakdownService,
        {
          provide: getRepositoryToken(KgaraCase),
          useValue: mockCaseRepo,
        },
        {
          provide: getRepositoryToken(KgaraCaseSettlement),
          useValue: mockSettlementRepo,
        },
        {
          provide: getRepositoryToken(KgaraCaseLinkedInvoice),
          useValue: mockLinkedInvoiceRepo,
        },
        {
          provide: getRepositoryToken(KgaraGrossProfit),
          useValue: mockGrossProfitRepo,
        },
      ],
    }).compile();

    service = module.get<GarageMonthlyReceivablesBreakdownService>(
      GarageMonthlyReceivablesBreakdownService,
    );
  });

  it('should return empty summary when no cases found in month', async () => {
    const qb: any = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    mockCaseRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getMonthlyReceivablesBreakdown('2026-10');

    expect(result.month).toBe('2026-10');
    expect(result.summary.caseCount).toBe(0);
    expect(result.summary.totalBilled).toBe(0);
    expect(result.summary.warning.hasVatWithoutInvoice).toBe(false);
    expect(result.insuranceCompanies).toHaveLength(0);
    expect(result.customerPartners).toHaveLength(0);
  });

  it('should breakdown correctly for cases with KH, BH, linked invoices, and VAT warning', async () => {
    // 1. Mock 2 cases
    const case1: any = {
      id: 'case-1',
      soChungTu: 'GR-PDV2610-0001',
      bienSoXe: '51A-12345',
      khachHangName: 'Nguyễn Văn A',
      tienCoThue: '10000000',
      tienDaThanhToan: '2000000',
      rawData: {
        TienThanhToanKH: '6000000',
        TienThanhToanBH: '4000000',
        TienThue: '800000',
        TienThueKH: '480000',
        TienThueBH: '320000',
        XeLamBaoHiem: true,
      },
    };

    const case2: any = {
      id: 'case-2',
      soChungTu: 'GR-PDV2610-0002',
      bienSoXe: '51B-67890',
      khachHangName: 'Công ty Cổ Phần X',
      tienCoThue: '5500000',
      tienDaThanhToan: '0',
      rawData: {
        TienThanhToanKH: '5500000',
        TienThanhToanBH: '0',
        TienThue: '500000',
        TienThueKH: '500000',
        TienThueBH: '0',
        XeLamBaoHiem: false,
      },
    };

    const caseQb: any = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([case1, case2]),
    };
    mockCaseRepo.createQueryBuilder.mockReturnValue(caseQb);

    // 2. Mock gross profit: Case 1 có chi phí 6.5M
    const gpQb: any = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        {
          id: 'gp-1',
          vuViecCode: 'GR-PDV2610-0001',
          chiPhi: '6500000',
        },
      ]),
    };
    mockGrossProfitRepo.createQueryBuilder.mockReturnValue(gpQb);

    // 3. Mock settlements: Case 1 có 2M thu từ KH
    const setQb: any = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        {
          caseId: 'case-1',
          amount: '2000000',
          payerType: 'KH',
          settlementType: 'RECEIPT',
        },
      ]),
    };
    mockSettlementRepo.createQueryBuilder.mockReturnValue(setQb);

    // 3. Mock linked invoices:
    // - Case 1 có liên kết HĐ cho bên Bảo hiểm (Công ty Bảo hiểm Bảo Việt)
    // - Case 2 có VAT 500k nhưng KHÔNG có hóa đơn (vatWarning = true)
    const invQb: any = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        {
          caseId: 'case-1',
          invoiceId: 'inv-101',
          invoiceNo: '0001906',
          serialNo: 'C26TGA',
          buyerName: 'Tổng Công ty Cổ phần Bảo hiểm Bảo Việt',
          buyerTaxCode: '0100111761',
          totalAmount: '4000000',
          vatAmount: '320000',
        },
      ]),
    };
    mockLinkedInvoiceRepo.createQueryBuilder.mockReturnValue(invQb);

    const result = await service.getMonthlyReceivablesBreakdown('2026-10');

    // Kiểm tra tổng quan
    expect(result.summary.caseCount).toBe(2);
    expect(result.summary.totalBilled).toBe(15500000);
    expect(result.summary.totalPaid).toBe(2000000);
    expect(result.summary.totalRemaining).toBe(13500000);

    // Kiểm tra luồng KH
    expect(result.summary.customer.billed).toBe(11500000);
    expect(result.summary.customer.paid).toBe(2000000);
    expect(result.summary.customer.remaining).toBe(9500000);

    // Kiểm tra luồng BH
    expect(result.summary.insurance.billed).toBe(4000000);
    expect(result.summary.insurance.paid).toBe(0);
    expect(result.summary.insurance.remaining).toBe(4000000);

    // Kiểm tra Cảnh báo VAT: Case 1 phần KH có VAT 480k chưa HĐ, Case 2 có VAT 500k chưa HĐ -> Tổng VAT chưa HĐ = 980k
    expect(result.summary.warning.hasVatWithoutInvoice).toBe(true);
    expect(result.summary.warning.totalVatWithoutInvoice).toBe(980000);
    expect(result.summary.warning.casesWithVatNoInvoiceCount).toBe(2);

    // Kiểm tra danh sách Cty Bảo hiểm
    expect(result.insuranceCompanies).toHaveLength(1);
    expect(result.insuranceCompanies[0].companyName).toBe(
      'Tổng Công ty Cổ phần Bảo hiểm Bảo Việt',
    );
    expect(result.insuranceCompanies[0].hasInvoice).toBe(true);
    expect(result.insuranceCompanies[0].vatWarning).toBe(false);

    // Kiểm tra danh sách Khách hàng
    expect(result.customerPartners).toHaveLength(2);
    const case2Cust = result.customerPartners.find(
      (p) => p.customerName === 'Công ty Cổ Phần X',
    );
    expect(case2Cust).toBeDefined();
    expect(case2Cust?.vatWarning).toBe(true);
    expect(case2Cust?.hasInvoice).toBe(false);

    // Kiểm tra categorized groups (Bảo hiểm, Doanh nghiệp, Cá nhân)
    expect(result.categorized).toBeDefined();
    expect(result.categorized?.insurance.all).toHaveLength(1);
    expect(result.categorized?.insurance.all[0].partnerCategory).toBe(
      'INSURANCE',
    );
    expect(result.categorized?.insurance.all[0].invoiceCategory).toBe(
      'WITH_INVOICE',
    );
    expect(result.categorized?.insurance.withInvoice).toHaveLength(1);
    expect(result.categorized?.insurance.pendingInvoice).toHaveLength(0);

    expect(result.categorized?.enterprise.all).toHaveLength(1);
    expect(result.categorized?.enterprise.all[0].title).toBe(
      'Công ty Cổ Phần X',
    );
    expect(result.categorized?.enterprise.all[0].partnerCategory).toBe(
      'ENTERPRISE',
    );
    expect(result.categorized?.enterprise.all[0].invoiceCategory).toBe(
      'PENDING_INVOICE',
    );
    expect(result.categorized?.enterprise.pendingInvoice).toHaveLength(1);

    expect(result.categorized?.individual.all).toHaveLength(1);
    expect(result.categorized?.individual.all[0].title).toBe('Nguyễn Văn A');
    expect(result.categorized?.individual.all[0].partnerCategory).toBe(
      'INDIVIDUAL',
    );
    expect(result.categorized?.individual.all[0].invoiceCategory).toBe(
      'PENDING_INVOICE',
    );
    // Hồ sơ có cả phần BH (4 triệu) và phần KH (6 triệu): chi phí 6,5 triệu chia theo tỷ trọng
    // (KH 60% → 3,9 triệu; BH 40% → 2,6 triệu), không cộng trùng sang cả hai nhóm
    expect(result.categorized?.individual.all[0].cases[0].cost).toBe(3900000);
    expect(result.categorized?.individual.all[0].cost).toBe(3900000);
    expect(result.categorized?.insurance.all[0].cases[0].cost).toBe(2600000);
    expect(result.categorized?.insurance.all[0].cost).toBe(2600000);
  });

  it('should categorize correctly for non-VAT individual customers (NO_INVOICE)', async () => {
    const caseNoVat: any = {
      id: 'case-3',
      soChungTu: 'GR-PDV2610-0003',
      bienSoXe: '51C-99999',
      khachHangName: 'Trần Văn B (Khách lẻ)',
      tienCoThue: '2000000',
      tienDaThanhToan: '2000000',
      rawData: {
        TienThanhToanKH: '2000000',
        TienThanhToanBH: '0',
        TienThue: '0',
        TienThueKH: '0',
        TienThueBH: '0',
        XeLamBaoHiem: false,
      },
    };

    const caseQb: any = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([caseNoVat]),
    };
    mockCaseRepo.createQueryBuilder.mockReturnValue(caseQb);

    const gpQb: any = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    mockGrossProfitRepo.createQueryBuilder.mockReturnValue(gpQb);

    const setQb: any = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        {
          caseId: 'case-3',
          amount: '2000000',
          payerType: 'KH',
          settlementType: 'RECEIPT',
        },
      ]),
    };
    mockSettlementRepo.createQueryBuilder.mockReturnValue(setQb);

    const invQb: any = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    mockLinkedInvoiceRepo.createQueryBuilder.mockReturnValue(invQb);

    const result = await service.getMonthlyReceivablesBreakdown('2026-10');

    expect(result.categorized?.individual.noInvoice).toHaveLength(1);
    expect(result.categorized?.individual.noInvoice[0].partnerCategory).toBe(
      'INDIVIDUAL',
    );
    expect(result.categorized?.individual.noInvoice[0].invoiceCategory).toBe(
      'NO_INVOICE',
    );
    expect(result.categorized?.individual.noInvoice[0].hasInvoice).toBe(false);
    expect(result.categorized?.individual.noInvoice[0].hasVat).toBe(false);
    expect(result.categorized?.individual.noInvoice[0].vatWarning).toBe(false);
    expect(result.categorized?.individual.totals.billed).toBe(2000000);
    expect(result.categorized?.individual.totals.paid).toBe(2000000);
    expect(result.categorized?.individual.totals.remaining).toBe(0);
  });
});

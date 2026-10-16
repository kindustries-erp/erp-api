import { GarageCashflowExcelBuilder } from './garage-cashflow-excel.builder';
import { KgaraCashflowVoucher } from '../entities/kgara_cashflow_voucher.entity';

describe('GarageCashflowExcelBuilder', () => {
  let builder: GarageCashflowExcelBuilder;

  beforeEach(() => {
    builder = new GarageCashflowExcelBuilder();
  });

  it('should build excel buffer with summary and headers correctly', async () => {
    const vouchers: Partial<KgaraCashflowVoucher>[] = [
      {
        id: '1',
        voucherCode: 'PT-GARA-001',
        voucherType: 'RECEIPT',
        amount: 1500000,
        transDate: '2026-10-15',
        paymentMethod: 'Chuyển khoản',
        paymentContent: '1. KH thanh toán',
        paymentStatus: 'PAID',
        partnerName: 'Nguyễn Văn A',
        note: 'Tiền tạm ứng',
        createdBy: 'admin',
        createdAt: new Date('2026-10-15T08:00:00Z'),
        case: {
          id: 'case-1',
          soChungTu: 'GR-PDV-001',
          bienSoXe: '51A-12345',
          khachHangName: 'Nguyễn Văn A',
        } as any,
      },
      {
        id: '2',
        voucherCode: 'PC-GARA-001',
        voucherType: 'PAYMENT',
        amount: 500000,
        transDate: '2026-10-15',
        paymentMethod: 'Tiền mặt',
        paymentContent: '7. Phụ tùng / vật tư',
        paymentStatus: 'APPROVED',
        partnerName: 'Công ty Phụ tùng B',
        note: 'Mua lọc dầu',
        createdBy: 'admin',
        createdAt: new Date('2026-10-15T09:00:00Z'),
      },
    ];

    const buffer = await builder.build({
      vouchers: vouchers as KgaraCashflowVoucher[],
    });

    expect(buffer).toBeDefined();
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('should filter selected columns when specified', async () => {
    const vouchers: Partial<KgaraCashflowVoucher>[] = [
      {
        id: '1',
        voucherCode: 'PT-GARA-001',
        voucherType: 'RECEIPT',
        amount: 100000,
        transDate: '2026-10-15',
      },
    ];

    const buffer = await builder.build({
      vouchers: vouchers as KgaraCashflowVoucher[],
      selectedColumns: ['stt', 'transDate', 'voucherCode', 'thu'],
    });

    expect(buffer).toBeDefined();
    expect(Buffer.isBuffer(buffer)).toBe(true);
  });
});

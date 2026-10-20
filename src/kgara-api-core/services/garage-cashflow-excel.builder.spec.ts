import { Workbook } from 'exceljs';
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

  describe('nhóm dòng tiền', () => {
    const v = (
      id: string,
      voucherType: 'RECEIPT' | 'PAYMENT',
      paymentStatus: string,
      amount: number,
    ) =>
      ({
        id,
        voucherCode: id,
        voucherType,
        paymentStatus,
        amount,
        transDate: '2026-10-15',
      }) as unknown as KgaraCashflowVoucher;

    const load = async (buffer: Buffer) => {
      const wb = new Workbook();
      await wb.xlsx.load(buffer as any);
      return wb.getWorksheet('Thu chi Garage')!;
    };
    const headerIdx = (sheet: any, name: string) =>
      (sheet.getRow(4).values as unknown[]).indexOf(name);
    const sumOf = (sheet: any, col: number) =>
      (sheet.getRow(1).getCell(col).value as any).result;

    it('tổng Thu/Dự thu/Chi/Dự chi tách đúng nhóm; phiếu đã hủy không vào tổng', async () => {
      const sheet = await load(
        await builder.build({
          vouchers: [
            v('PT-PAID', 'RECEIPT', 'PAID', 1000),
            v('PT-EXP', 'RECEIPT', 'EXPECTED', 300),
            v('PT-CAN', 'RECEIPT', 'CANCELLED', 999),
            v('PC-PAID', 'PAYMENT', 'PAID', 400),
            v('PC-PEND', 'PAYMENT', 'PENDING', 100),
            v('PC-APP', 'PAYMENT', 'APPROVED', 50),
            v('PC-CAN', 'PAYMENT', 'CANCELLED', 777),
          ],
        }),
      );

      expect(sumOf(sheet, headerIdx(sheet, 'Tiền vào (Thu)'))).toBe(1000);
      expect(sumOf(sheet, headerIdx(sheet, 'Dự thu'))).toBe(300);
      expect(sumOf(sheet, headerIdx(sheet, 'Tiền ra (Chi)'))).toBe(400);
      expect(sumOf(sheet, headerIdx(sheet, 'Dự chi'))).toBe(150);

      const statusCol = headerIdx(sheet, 'Trạng thái');
      const statusOf = (rowNo: number) =>
        sheet.getRow(rowNo).getCell(statusCol).value;
      expect(statusOf(5)).toBe('Đã thu');
      expect(statusOf(6)).toBe('Dự thu');
      expect(statusOf(7)).toBe('Đã hủy');
      expect(statusOf(8)).toBe('Đã chi');
      expect(statusOf(9)).toBe('Dự chi (Chờ duyệt)');
      expect(statusOf(10)).toBe('Dự chi (Đã duyệt)');
      expect(statusOf(11)).toBe('Đã hủy');
    });

    it('chọn Thu/Chi thì kèm cột Dự thu/Dự chi tương ứng', async () => {
      const sheet = await load(
        await builder.build({
          vouchers: [v('PT-EXP', 'RECEIPT', 'EXPECTED', 300)],
          selectedColumns: ['stt', 'thu', 'chi'],
        }),
      );
      expect(headerIdx(sheet, 'Dự thu')).toBeGreaterThan(0);
      expect(headerIdx(sheet, 'Dự chi')).toBeGreaterThan(0);
    });

    it('cột Dự thu/Dự chi tô nền amber ở header, tổng và dữ liệu; cột Thu/Chi thực tế không tô', async () => {
      const sheet = await load(
        await builder.build({
          vouchers: [
            v('PT-PAID', 'RECEIPT', 'PAID', 1000),
            v('PT-EXP', 'RECEIPT', 'EXPECTED', 300),
          ],
        }),
      );
      const fillOf = (cell: any) => cell.fill?.fgColor?.argb;
      const dCol = headerIdx(sheet, 'Dự thu');
      const tCol = headerIdx(sheet, 'Tiền vào (Thu)');
      expect(fillOf(sheet.getRow(4).getCell(dCol))).toBe('FFB45309');
      expect(fillOf(sheet.getRow(1).getCell(dCol))).toBe('FFFEF3C7');
      expect(fillOf(sheet.getRow(6).getCell(dCol))).toBe('FFFFFBEB');
      expect(fillOf(sheet.getRow(4).getCell(tCol))).not.toBe('FFB45309');
      expect(fillOf(sheet.getRow(5).getCell(tCol))).not.toBe('FFFFFBEB');
    });
  });
});

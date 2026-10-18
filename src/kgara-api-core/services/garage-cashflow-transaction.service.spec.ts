import { BadRequestException } from '@nestjs/common';
import { GarageCashflowTransactionService } from './garage-cashflow-transaction.service';
import { KgaraCashflowVoucher } from '../entities/kgara_cashflow_voucher.entity';
import { KgaraCaseSettlement } from '../entities/kgara_case_settlement.entity';
import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraOperatingExpense } from '../entities/kgara_operating_expense.entity';

interface HarnessState {
  voucher?: any;
  settlement?: any;
  opex?: any;
}

function buildHarness(state: HarnessState = {}) {
  const created: Array<{ entity: unknown; data: any }> = [];
  const manager: any = {
    findOne: jest.fn(async (entity: unknown) => {
      if (entity === KgaraCashflowVoucher) return state.voucher ?? null;
      if (entity === KgaraCaseSettlement) return state.settlement ?? null;
      if (entity === KgaraOperatingExpense) return state.opex ?? null;
      if (entity === KgaraCase) return { id: 'case-1', rawData: {} };
      return null;
    }),
    find: jest.fn(async () => []),
    create: jest.fn((entity: unknown, data: any) => {
      const obj = { ...data };
      created.push({ entity, data: obj });
      return obj;
    }),
    merge: jest.fn((_e: unknown, target: any, src: any) =>
      Object.assign(target, src),
    ),
    save: jest.fn(async (a: any, b?: any) => {
      const obj = typeof a === 'function' ? b : a;
      if (!obj.id) obj.id = 'generated-id';
      return obj;
    }),
    remove: jest.fn(async () => undefined),
    delete: jest.fn(async () => undefined),
  };
  const queryRunner: any = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager,
  };
  const dataSource: any = { createQueryRunner: () => queryRunner };
  const service = new GarageCashflowTransactionService(
    {} as any,
    {} as any,
    {} as any,
    dataSource,
  );
  const createdOf = (entity: unknown) =>
    created.filter((c) => c.entity === entity).map((c) => c.data);
  return { service, manager, queryRunner, createdOf };
}

const baseDto = {
  voucherType: 'PAYMENT' as const,
  amount: 1_000_000,
  transDate: '2026-10-05',
  caseId: 'case-1',
};

describe('GarageCashflowTransactionService - quy tắc phiếu chi', () => {
  describe('createVoucher', () => {
    it('phiếu chi chưa Đã chi không tạo settlement trừ công nợ', async () => {
      const h = buildHarness();
      await h.service.createVoucher({
        ...baseDto,
        paymentStatus: 'APPROVED',
        paymentContent: '7. Phụ tùng / vật tư',
      });
      expect(h.createdOf(KgaraCaseSettlement)).toHaveLength(0);
    });

    it('phiếu chi Đã chi nội dung thường tạo settlement PAYMENT', async () => {
      const h = buildHarness();
      await h.service.createVoucher({
        ...baseDto,
        paymentStatus: 'PAID',
        paymentContent: '7. Phụ tùng / vật tư',
      });
      const settlements = h.createdOf(KgaraCaseSettlement);
      expect(settlements).toHaveLength(1);
      expect(settlements[0].settlementType).toBe('PAYMENT');
      expect(h.createdOf(KgaraOperatingExpense)).toHaveLength(0);
    });

    it('phiếu chi 10. Vật tư tiêu hao (hoặc 8. Vật tư tiêu hao) Đã chi ghi garage-opex, không trừ công nợ', async () => {
      const h = buildHarness();
      await h.service.createVoucher({
        ...baseDto,
        paymentStatus: 'PAID',
        paymentContent: '10. Vật tư tiêu hao',
      });
      expect(h.createdOf(KgaraCaseSettlement)).toHaveLength(0);
      const opex = h.createdOf(KgaraOperatingExpense);
      expect(opex).toHaveLength(1);
    });

    it('phiếu chi 4. HHBH Chờ duyệt chưa ghi garage-opex', async () => {
      const h = buildHarness();
      await h.service.createVoucher({
        ...baseDto,
        paymentStatus: 'PENDING',
        paymentContent: '4. HHBH',
      });
      expect(h.createdOf(KgaraOperatingExpense)).toHaveLength(0);
    });

    it('phiếu thu thường hoặc không truyền status tạo settlement RECEIPT', async () => {
      const h = buildHarness();
      await h.service.createVoucher({
        ...baseDto,
        voucherType: 'RECEIPT',
      });
      const settlements = h.createdOf(KgaraCaseSettlement);
      expect(settlements).toHaveLength(1);
      expect(settlements[0].settlementType).toBe('RECEIPT');
    });

    it('phiếu thu Dự thu (EXPECTED) không tạo settlement', async () => {
      const h = buildHarness();
      await h.service.createVoucher({
        ...baseDto,
        voucherType: 'RECEIPT',
        paymentStatus: 'EXPECTED',
      });
      expect(h.createdOf(KgaraCaseSettlement)).toHaveLength(0);
    });
  });

  describe('updateVoucher', () => {
    const paidVoucher = () => ({
      id: 'v1',
      voucherCode: 'PC-GARA-1',
      voucherType: 'PAYMENT',
      paymentStatus: 'PAID',
      paymentContent: '7. Phụ tùng / vật tư',
      amount: 1_000_000,
      transDate: '2026-10-05',
      caseId: 'case-1',
    });

    it('chặn đổi trạng thái khi phiếu đã Đã chi', async () => {
      const h = buildHarness({ voucher: paidVoucher() });
      await expect(
        h.service.updateVoucher('v1', { paymentStatus: 'PENDING' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(h.queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('chặn đổi loại phiếu khi đã Đã chi', async () => {
      const h = buildHarness({ voucher: paidVoucher() });
      await expect(
        h.service.updateVoucher('v1', { voucherType: 'RECEIPT' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('cho phép sửa trường khác khi giữ nguyên Đã chi', async () => {
      const h = buildHarness({ voucher: paidVoucher() });
      await expect(
        h.service.updateVoucher('v1', {
          paymentStatus: 'PAID',
          note: 'ghi chú',
        }),
      ).resolves.toBeDefined();
    });

    it('chuyển sang Đã chi tạo settlement PAYMENT', async () => {
      const h = buildHarness({
        voucher: { ...paidVoucher(), paymentStatus: 'APPROVED' },
      });
      await h.service.updateVoucher('v1', { paymentStatus: 'PAID' });
      expect(h.createdOf(KgaraCaseSettlement)).toHaveLength(1);
    });

    it('đổi nội dung sang 8 gỡ settlement và ghi opex', async () => {
      const settlement = { id: 's1', caseId: 'case-1' };
      const h = buildHarness({ voucher: paidVoucher(), settlement });
      await h.service.updateVoucher('v1', {
        paymentContent: '8. Vật tư tiêu hao',
      });
      expect(h.manager.remove).toHaveBeenCalledWith(settlement);
      expect(h.createdOf(KgaraOperatingExpense)).toHaveLength(1);
    });

    it('phiếu thu từ EXPECTED chuyển sang PAID tạo settlement RECEIPT', async () => {
      const h = buildHarness({
        voucher: {
          id: 'v1',
          voucherCode: 'PT-GARA-1',
          voucherType: 'RECEIPT',
          paymentStatus: 'EXPECTED',
          amount: 500_000,
          transDate: '2026-10-05',
          caseId: 'case-1',
        },
      });
      await h.service.updateVoucher('v1', { paymentStatus: 'PAID' });
      expect(h.createdOf(KgaraCaseSettlement)).toHaveLength(1);
    });

    it('phiếu thu từ PAID chuyển sang EXPECTED gỡ bỏ settlement', async () => {
      const settlement = { id: 's1', caseId: 'case-1' };
      const h = buildHarness({
        voucher: {
          id: 'v1',
          voucherCode: 'PT-GARA-1',
          voucherType: 'RECEIPT',
          paymentStatus: 'PAID',
          amount: 500_000,
          transDate: '2026-10-05',
          caseId: 'case-1',
        },
        settlement,
      });
      await h.service.updateVoucher('v1', { paymentStatus: 'EXPECTED' });
      expect(h.manager.remove).toHaveBeenCalledWith(settlement);
    });
  });

  describe('deleteVoucher', () => {
    it('xóa dòng garage-opex sinh từ phiếu', async () => {
      const h = buildHarness({
        voucher: {
          id: 'v1',
          voucherType: 'PAYMENT',
          voucherCode: 'PC-GARA-1',
          amount: 1,
        },
      });
      await h.service.deleteVoucher('v1');
      expect(h.manager.delete).toHaveBeenCalledWith(KgaraOperatingExpense, {
        sourceCashflowVoucherId: 'v1',
      });
    });
  });
});

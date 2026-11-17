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
  caseRow?: any;
  paidBH?: number;
}

function buildHarness(
  state: HarnessState = {},
  garageHub?: Record<string, jest.Mock>,
) {
  const created: Array<{ entity: unknown; data: any }> = [];
  const manager: any = {
    findOne: jest.fn(async (entity: unknown) => {
      if (entity === KgaraCashflowVoucher) return state.voucher ?? null;
      if (entity === KgaraCaseSettlement) return state.settlement ?? null;
      if (entity === KgaraOperatingExpense) return state.opex ?? null;
      if (entity === KgaraCase)
        return state.caseRow ?? { id: 'case-1', rawData: {} };
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
    query: jest.fn(async () => [{ paid: String(state.paidBH ?? 0) }]),
    manager,
  };
  const dataSource: any = { createQueryRunner: () => queryRunner };
  const service = new GarageCashflowTransactionService(
    {} as any,
    {} as any,
    {} as any,
    dataSource,
    undefined,
    garageHub as any,
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

describe('GarageCashflowTransactionService - đồng bộ dự thu sau khi lưu phiếu', () => {
  it('tạo phiếu gắn case thì gọi Hub đặt lại dự thu của case đó sau khi commit', async () => {
    const hub = {
      handleCashflowSettled: jest.fn().mockResolvedValue({}),
      handleCaseReceiptChanged: jest.fn().mockResolvedValue({}),
    };
    const h = buildHarness({}, hub);
    await h.service.createVoucher({ ...baseDto, voucherType: 'RECEIPT' });
    expect(h.queryRunner.commitTransaction).toHaveBeenCalled();
    expect(hub.handleCaseReceiptChanged).toHaveBeenCalledWith('case-1');
  });

  it('lỗi khi đồng bộ dự thu không làm hỏng việc lưu phiếu', async () => {
    const hub = {
      handleCashflowSettled: jest.fn().mockResolvedValue({}),
      handleCaseReceiptChanged: jest.fn().mockRejectedValue(new Error('boom')),
    };
    const h = buildHarness({}, hub);
    await expect(
      h.service.createVoucher({ ...baseDto, voucherType: 'RECEIPT' }),
    ).resolves.toBeDefined();
    expect(h.queryRunner.rollbackTransaction).not.toHaveBeenCalled();
  });
});

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

describe('GarageCashflowTransactionService - bên thanh toán KH/BH của phiếu thu', () => {
  const insuranceCase = {
    id: 'case-1',
    tienCoThue: 1_000_000,
    rawData: {
      XeLamBaoHiem: true,
      TienThanhToanBH: 800_000,
      TienThanhToanKH: 200_000,
    },
  };
  const receipt = { ...baseDto, voucherType: 'RECEIPT' as const };

  it('AC-1: số tiền khớp phần BH thì tự gán BH và trả payerType trong response', async () => {
    const h = buildHarness({ caseRow: insuranceCase });
    const res = await h.service.createVoucher({ ...receipt, amount: 800_000 });
    expect(h.createdOf(KgaraCaseSettlement)[0].payerType).toBe('BH');
    expect(res.payerType).toBe('BH');
  });

  it('AC-1: số tiền không khớp phần BH thì KH', async () => {
    const h = buildHarness({ caseRow: insuranceCase });
    await h.service.createVoucher({ ...receipt, amount: 200_000 });
    expect(h.createdOf(KgaraCaseSettlement)[0].payerType).toBe('KH');
  });

  it('AC-1: payerType gửi lên thắng tự gán', async () => {
    const h = buildHarness({ caseRow: insuranceCase });
    await h.service.createVoucher({
      ...receipt,
      amount: 800_000,
      payerType: 'KH',
    });
    expect(h.createdOf(KgaraCaseSettlement)[0].payerType).toBe('KH');
  });

  it('AC-1/AC-6: phiếu không có phần BH luôn KH; phiếu chi luôn KH', async () => {
    const h = buildHarness();
    await h.service.createVoucher({ ...receipt, amount: 800_000 });
    expect(h.createdOf(KgaraCaseSettlement)[0].payerType).toBe('KH');
    const p = buildHarness({ caseRow: insuranceCase });
    await p.service.createVoucher({
      ...baseDto,
      amount: 800_000,
      paymentStatus: 'PAID',
      paymentContent: '7. Phụ tùng / vật tư',
    });
    expect(p.createdOf(KgaraCaseSettlement)[0].payerType).toBe('KH');
  });

  describe('updateVoucher', () => {
    const existingVoucher = () => ({
      id: 'v1',
      voucherType: 'RECEIPT',
      paymentStatus: 'PAID',
      caseId: 'case-1',
      amount: 800_000,
      transDate: '2026-10-05',
    });

    it('AC-2: sửa ghi chú giữ nguyên payer đã lưu', async () => {
      const settlement = { id: 's1', payerType: 'BH' };
      const h = buildHarness({
        caseRow: insuranceCase,
        voucher: existingVoucher(),
        settlement,
      });
      await h.service.updateVoucher('v1', { note: 'đổi ghi chú' });
      expect(settlement.payerType).toBe('BH');
      expect(h.queryRunner.query).not.toHaveBeenCalled();
    });

    it('AC-2: đổi số tiền không gửi payerType thì tính lại theo số tiền mới', async () => {
      const settlement = { id: 's1', payerType: 'BH' };
      const h = buildHarness({
        caseRow: insuranceCase,
        voucher: existingVoucher(),
        settlement,
      });
      await h.service.updateVoucher('v1', { amount: 200_000 });
      expect(settlement.payerType).toBe('KH');
    });

    it('AC-2: gửi payerType thì đổi payer', async () => {
      const settlement = { id: 's1', payerType: 'BH' };
      const h = buildHarness({
        caseRow: insuranceCase,
        voucher: existingVoucher(),
        settlement,
      });
      const res = await h.service.updateVoucher('v1', { payerType: 'KH' });
      expect(settlement.payerType).toBe('KH');
      expect(res.payerType).toBe('KH');
    });

    it('AC-2: đổi sang phiếu dịch vụ khác không gửi payerType thì tính lại theo số tiền', async () => {
      const settlement = { id: 's1', payerType: 'KH' };
      const h = buildHarness({
        caseRow: { ...insuranceCase, id: 'case-2' },
        voucher: existingVoucher(),
        settlement,
      });
      await h.service.updateVoucher('v1', { caseId: 'case-2' });
      expect(settlement.payerType).toBe('BH');
    });
  });
});

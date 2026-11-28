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
  moduleRef?: unknown,
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
    moduleRef as any,
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

/** Phiếu thu hợp lệ theo luật: đã thu phải có phương thức và nội dung đúng loại. */
const receiptDto = {
  ...baseDto,
  voucherType: 'RECEIPT' as const,
  paymentMethod: 'Tiền mặt',
  paymentContent: '1. KH thanh toán',
};
/** Trường bắt buộc của phiếu chi đã chi trong các ca không quan tâm nội dung cụ thể. */
const paidFields = {
  paymentStatus: 'PAID' as const,
  paymentMethod: 'Tiền mặt',
  paymentContent: '9. Phụ tùng / vật tư',
};

describe('GarageCashflowTransactionService - đồng bộ dự thu sau khi lưu phiếu', () => {
  it('tạo phiếu gắn case thì gọi Hub đặt lại dự thu của case đó sau khi commit', async () => {
    const hub = {
      handleCashflowSettled: jest.fn().mockResolvedValue({}),
      handleCaseReceiptChanged: jest.fn().mockResolvedValue({}),
    };
    const h = buildHarness({}, hub);
    await h.service.createVoucher({ ...receiptDto });
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
      h.service.createVoucher({ ...receiptDto }),
    ).resolves.toBeDefined();
    expect(h.queryRunner.rollbackTransaction).not.toHaveBeenCalled();
  });
});

describe('GarageCashflowTransactionService - chiếu sang sổ nợ v2 sau commit', () => {
  const projectorOf = (over: Record<string, jest.Mock> = {}) => {
    const projector = {
      projectVoucher: jest.fn().mockResolvedValue(undefined),
      removeVoucher: jest.fn().mockResolvedValue(undefined),
      projectCase: jest.fn().mockResolvedValue(undefined),
      ...over,
    };
    return { projector, moduleRef: { get: jest.fn(() => projector) } };
  };

  it('tạo phiếu: chiếu phiếu vừa lưu, sau commit', async () => {
    const { projector, moduleRef } = projectorOf();
    const h = buildHarness({}, undefined, moduleRef);
    await h.service.createVoucher({ ...receiptDto });
    expect(projector.projectVoucher).toHaveBeenCalledWith('generated-id');
  });

  it('xóa phiếu: báo projector kèm vụ việc của phiếu', async () => {
    const { projector, moduleRef } = projectorOf();
    const h = buildHarness(
      {
        voucher: {
          id: 'v1',
          voucherType: 'PAYMENT',
          voucherCode: 'PC-1',
          amount: 1,
          caseId: 'case-9',
        },
      },
      undefined,
      moduleRef,
    );
    await h.service.deleteVoucher('v1');
    expect(projector.removeVoucher).toHaveBeenCalledWith('v1', 'case-9');
  });

  it('projector lỗi chỉ ghi log, phiếu V1 vẫn lưu', async () => {
    const { moduleRef } = projectorOf({
      projectVoucher: jest.fn().mockRejectedValue(new Error('v2 down')),
    });
    const h = buildHarness({}, undefined, moduleRef);
    await expect(
      h.service.createVoucher({ ...receiptDto }),
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
        paymentContent: '9. Phụ tùng / vật tư',
      });
      expect(h.createdOf(KgaraCaseSettlement)).toHaveLength(0);
    });

    it('phiếu chi Đã chi nội dung thường tạo settlement PAYMENT', async () => {
      const h = buildHarness();
      await h.service.createVoucher({ ...baseDto, ...paidFields });
      const settlements = h.createdOf(KgaraCaseSettlement);
      expect(settlements).toHaveLength(1);
      expect(settlements[0].settlementType).toBe('PAYMENT');
      expect(h.createdOf(KgaraOperatingExpense)).toHaveLength(0);
    });

    it('phiếu chi 10. Vật tư tiêu hao (hoặc 8. Vật tư tiêu hao) Đã chi ghi garage-opex, không trừ công nợ', async () => {
      const h = buildHarness();
      await h.service.createVoucher({
        ...baseDto,
        ...paidFields,
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
      await h.service.createVoucher(receiptDto);
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
      paymentMethod: 'Tiền mặt',
      paymentContent: '9. Phụ tùng / vật tư',
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

    it('đổi nội dung sang 10 gỡ settlement và ghi opex', async () => {
      const settlement = { id: 's1', caseId: 'case-1' };
      const h = buildHarness({ voucher: paidVoucher(), settlement });
      await h.service.updateVoucher('v1', {
        paymentContent: '10. Vật tư tiêu hao',
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
          paymentMethod: 'Tiền mặt',
          paymentContent: '1. KH thanh toán',
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
  const receipt = receiptDto;

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
      ...paidFields,
      amount: 800_000,
    });
    expect(p.createdOf(KgaraCaseSettlement)[0].payerType).toBe('KH');
  });

  describe('updateVoucher', () => {
    const existingVoucher = () => ({
      id: 'v1',
      voucherType: 'RECEIPT',
      paymentStatus: 'PAID',
      paymentMethod: 'Tiền mặt',
      paymentContent: '1. KH thanh toán',
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

describe('GarageCashflowTransactionService - luật nhập phiếu và map phương thức', () => {
  it('tạo phiếu chi với nội dung thu: 400 và không lưu', async () => {
    const h = buildHarness();
    await expect(
      h.service.createVoucher({
        ...baseDto,
        ...paidFields,
        paymentContent: '3. BH thanh toán',
      }),
    ).rejects.toThrow('không dùng cho phiếu chi');
    expect(h.manager.save).not.toHaveBeenCalled();
    expect(h.queryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it('tạo phiếu số tiền 0: 400', async () => {
    const h = buildHarness();
    await expect(
      h.service.createVoucher({ ...receiptDto, amount: 0 }),
    ).rejects.toThrow('Số tiền phải lớn hơn 0');
  });

  it('kiểm trên trạng thái sau merge: bỏ phiếu dịch vụ không ghi lý do bị chặn', async () => {
    const h = buildHarness({
      voucher: { ...receiptDto, id: 'v1', paymentStatus: 'PAID' },
    });
    await expect(
      h.service.updateVoucher('v1', { caseId: null as any }),
    ).rejects.toThrow('cần gắn phiếu dịch vụ');
    expect(h.queryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it('phiếu thu cũ không có trạng thái vẫn sửa được ghi chú dù nội dung ngoài danh sách', async () => {
    const h = buildHarness({
      voucher: {
        ...receiptDto,
        id: 'v1',
        paymentStatus: null,
        paymentContent: 'Dự thu hoàn tất phiếu dịch vụ',
      },
    });
    await expect(
      h.service.updateVoucher('v1', { note: 'x' }),
    ).resolves.toBeDefined();
  });

  it('Chuyển khoản khác tạo settlement BANK_TRANSFER', async () => {
    const h = buildHarness();
    await h.service.createVoucher({
      ...receiptDto,
      paymentMethod: 'Chuyển khoản khác',
    });
    expect(h.createdOf(KgaraCaseSettlement)[0].paymentMethod).toBe(
      'BANK_TRANSFER',
    );
  });

  it('chỉ đổi trạng thái: settlement mới lấy phương thức đang lưu trên phiếu', async () => {
    const h = buildHarness({
      voucher: {
        ...receiptDto,
        id: 'v1',
        paymentStatus: 'EXPECTED',
        paymentMethod: 'Chuyển khoản',
      },
    });
    await h.service.updateVoucher('v1', { paymentStatus: 'PAID' });
    expect(h.createdOf(KgaraCaseSettlement)[0].paymentMethod).toBe(
      'BANK_TRANSFER',
    );
  });
});

describe('GarageCashflowTransactionService - đối tác chỉ tự điền cho phiếu thu', () => {
  const caseRow = { id: 'case-1', khachHangName: 'Khách A', rawData: {} };

  it('tạo phiếu thu để trống đối tác thì lấy tên khách', async () => {
    const h = buildHarness({ caseRow });
    await h.service.createVoucher(receiptDto);
    expect(h.createdOf(KgaraCashflowVoucher)[0].partnerName).toBe('Khách A');
    expect(h.createdOf(KgaraCaseSettlement)[0].partnerName).toBe('Khách A');
  });

  it('tạo phiếu chi để trống đối tác thì giữ trống', async () => {
    const h = buildHarness({ caseRow });
    await h.service.createVoucher({ ...baseDto, ...paidFields });
    expect(h.createdOf(KgaraCashflowVoucher)[0].partnerName).toBeUndefined();
    expect(h.createdOf(KgaraCaseSettlement)[0].partnerName).toBeUndefined();
  });

  it('chuyển phiếu chi sang Đã chi: settlement lấy đối tác đã nhập, không lấy tên khách', async () => {
    const h = buildHarness({
      caseRow,
      voucher: {
        ...baseDto,
        ...paidFields,
        id: 'v1',
        paymentStatus: 'APPROVED',
        partnerName: 'NCC B',
      },
    });
    await h.service.updateVoucher('v1', { paymentStatus: 'PAID' });
    expect(h.createdOf(KgaraCaseSettlement)[0].partnerName).toBe('NCC B');
  });

  it('gửi null để xóa đối tác của phiếu và settlement', async () => {
    const voucher = {
      ...baseDto,
      ...paidFields,
      id: 'v1',
      partnerName: 'Khách A',
    };
    const settlement = { id: 's1', partnerName: 'Khách A' };
    const h = buildHarness({ caseRow, voucher, settlement });
    await h.service.updateVoucher('v1', { partnerName: null as any });
    expect(voucher.partnerName).toBeNull();
    expect(settlement.partnerName).toBeNull();
  });
});

describe('GarageCashflowTransactionService - _recalculateCaseDebt: đã thu = RECEIPT-only', () => {
  async function recalc(settlements: any[]) {
    const kCase: any = {
      id: 'case-1',
      tienCoThue: 1000,
      rawData: { TienDaThanhToan: 200 },
    };
    const { service, manager, queryRunner } = buildHarness({ caseRow: kCase });
    manager.find = jest.fn(async () => settlements);
    await (service as any)._recalculateCaseDebt(queryRunner, 'case-1');
    return kCase;
  }

  it('chỉ có PAYMENT: giữ đã thu Kgara báo, không đặt về 0', async () => {
    const c = await recalc([{ settlementType: 'PAYMENT', amount: 500 }]);
    expect(c.tienDaThanhToan).toBe(200);
    expect(c.tienConPhaiThanhToan).toBe(800);
  });

  it('có RECEIPT: đã thu = tổng RECEIPT', async () => {
    const c = await recalc([
      { settlementType: 'PAYMENT', amount: 500 },
      { settlementType: 'RECEIPT', amount: 300 },
    ]);
    expect(c.tienDaThanhToan).toBe(300);
    expect(c.tienConPhaiThanhToan).toBe(700);
  });
});

describe('GarageCashflowTransactionService - thông tin thanh toán QR', () => {
  it('tạo phiếu lưu field QR đã chuẩn hóa', async () => {
    const h = buildHarness();
    await h.service.createVoucher({
      ...receiptDto,
      qrBankBin: '970418',
      qrBankCode: 'BIDV',
      qrAccountNumber: ' 1234567890 ',
      qrAccountName: 'CONG TY ABC',
      qrTransferContent: '',
    });
    const [voucher] = h.createdOf(KgaraCashflowVoucher);
    expect(voucher).toMatchObject({
      qrBankBin: '970418',
      qrBankCode: 'BIDV',
      qrAccountNumber: '1234567890',
      qrAccountName: 'CONG TY ABC',
      qrTransferContent: null,
    });
    expect(voucher).not.toHaveProperty('qrCompanyAccountId');
  });

  it('cập nhật chỉ đổi field QR có gửi, giữ field QR khác', async () => {
    const voucher = {
      id: 'v1',
      voucherType: 'RECEIPT',
      paymentStatus: 'PAID',
      paymentMethod: 'Tiền mặt',
      paymentContent: '2. Tất toán',
      amount: 1_000_000,
      transDate: '2026-10-05',
      qrBankBin: '970418',
      qrAccountNumber: '111',
    };
    const h = buildHarness({ voucher });
    await h.service.updateVoucher('v1', {
      qrAccountNumber: ' 222 ',
      qrAccountName: '  ',
    });
    expect(voucher).toMatchObject({
      qrBankBin: '970418',
      qrAccountNumber: '222',
      qrAccountName: null,
    });
  });
});

describe('GarageCashflowTransactionService - đối chiếu tài khoản công ty khi lưu QR', () => {
  const MISSING_ACCOUNT = '05666c3f-5897-46f7-b952-39c703e7a6d2';

  it('tạo phiếu với qrCompanyAccountId không tồn tại: trả 400, không lưu phiếu', async () => {
    const h = buildHarness();
    await expect(
      h.service.createVoucher({
        ...baseDto,
        ...paidFields,
        qrCompanyAccountId: MISSING_ACCOUNT,
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(h.createdOf(KgaraCashflowVoucher)).toHaveLength(0);
    expect(h.manager.save).not.toHaveBeenCalled();
  });

  it('cập nhật phiếu với qrCompanyAccountId không tồn tại: trả 400, không merge phiếu', async () => {
    const h = buildHarness({
      voucher: {
        id: 'v1',
        voucherType: 'PAYMENT',
        paymentStatus: 'PENDING',
        amount: 1000,
        caseId: null,
      },
    });
    await expect(
      h.service.updateVoucher('v1', {
        qrCompanyAccountId: MISSING_ACCOUNT,
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(h.manager.merge).not.toHaveBeenCalled();
  });
});

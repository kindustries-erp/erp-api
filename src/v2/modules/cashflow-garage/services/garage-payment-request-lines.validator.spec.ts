import { BadRequestException, ConflictException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { validatePaymentRequestLines } from './garage-payment-request-lines.validator';

type Po = {
  id: string;
  orderNo: string;
  status: string;
  isDeleted: boolean;
  supplierId: string | null;
  supplierName: string | null;
  totalAmount: string;
  approvedTotal: string | null;
};

function po(over: Partial<Po> & { id: string }): Po {
  return {
    orderNo: `PO-${over.id}`,
    status: 'ISSUED',
    isDeleted: false,
    supplierId: 'sup-1',
    supplierName: 'NCC A',
    totalAmount: '1000.00',
    approvedTotal: null,
    ...over,
  };
}

/** Manager giả: trả PO theo `pos`, và tổng dòng đang hiệu lực theo `activeByPo`. */
function manager(pos: Po[], activeByPo: Record<string, string> = {}) {
  const qb = {
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(pos),
  };
  return {
    createQueryBuilder: jest.fn(() => qb),
    query: jest.fn(async (_sql: string, params: unknown[]) => [
      { s: activeByPo[params[0] as string] ?? '0' },
    ]),
  } as unknown as EntityManager;
}

describe('validatePaymentRequestLines', () => {
  it('hợp lệ: tổng và NCC đúng, đổi số tiền sang xu', async () => {
    const m = manager([po({ id: 'p1' }), po({ id: 'p2' })]);
    const out = await validatePaymentRequestLines(m, [
      { poId: 'p1', amount: 300 },
      { poId: 'p2', amount: 200.5 },
    ]);
    expect(out.totalCents).toBe(50050);
    expect(out.supplierId).toBe('sup-1');
    expect(out.lines).toEqual([
      { poId: 'p1', amountCents: 30000 },
      { poId: 'p2', amountCents: 20050 },
    ]);
  });

  it('không có dòng hoặc trùng đơn mua: bị từ chối', async () => {
    const m = manager([po({ id: 'p1' })]);
    await expect(validatePaymentRequestLines(m, [])).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      validatePaymentRequestLines(m, [
        { poId: 'p1', amount: 1 },
        { poId: 'p1', amount: 2 },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('số tiền không dương: bị từ chối', async () => {
    const m = manager([po({ id: 'p1' })]);
    await expect(
      validatePaymentRequestLines(m, [{ poId: 'p1', amount: 0 }]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('đơn mua chưa ISSUED: bị từ chối 409', async () => {
    const m = manager([po({ id: 'p1', status: 'APPROVED' })]);
    await expect(
      validatePaymentRequestLines(m, [{ poId: 'p1', amount: 10 }]),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('khác nhà cung cấp: bị từ chối', async () => {
    const m = manager([
      po({ id: 'p1' }),
      po({ id: 'p2', supplierId: 'sup-2' }),
    ]);
    await expect(
      validatePaymentRequestLines(m, [
        { poId: 'p1', amount: 10 },
        { poId: 'p2', amount: 10 },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('vượt trần (total_amount) khi chưa có approved_total', async () => {
    const m = manager([po({ id: 'p1', totalAmount: '1000.00' })], {
      p1: '900.00',
    });
    await expect(
      validatePaymentRequestLines(m, [{ poId: 'p1', amount: 100.01 }]),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      validatePaymentRequestLines(m, [{ poId: 'p1', amount: 100 }]),
    ).resolves.toBeDefined();
  });

  it('trần ưu tiên approved_total khi có', async () => {
    const m = manager([
      po({ id: 'p1', totalAmount: '1000.00', approvedTotal: '800.00' }),
    ]);
    await expect(
      validatePaymentRequestLines(m, [{ poId: 'p1', amount: 800.01 }]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('đơn mua không tồn tại: 404', async () => {
    const m = manager([]);
    await expect(
      validatePaymentRequestLines(m, [{ poId: 'missing', amount: 10 }]),
    ).rejects.toThrow('Không tìm thấy đơn mua');
  });
});

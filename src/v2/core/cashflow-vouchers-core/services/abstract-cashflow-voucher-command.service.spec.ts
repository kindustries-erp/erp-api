import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { AbstractCashflowVoucherCommandService } from './abstract-cashflow-voucher-command.service';

type Row = Record<string, any>;

function fakeManager(rows: Row[]) {
  const repo = {
    create: (r: Row) => ({ ...r }),
    exists: async ({ where }: { where: Row }) =>
      rows.some((r) => r.voucherCode === where.voucherCode),
    save: async (r: Row) => {
      if (!r.id) {
        r.id = `v${rows.length + 1}`;
        rows.push(r);
      }
      return r;
    },
    createQueryBuilder: () => ({
      setLock: () => {
        const params: Row = {};
        const qb: Row = {
          where: (_s: string, p: Row) => (Object.assign(params, p), qb),
          andWhere: (_s: string, p: Row) => (Object.assign(params, p), qb),
          getOne: async () =>
            rows.find(
              (r) =>
                r.id === params.id &&
                (!params.branchExternalId ||
                  r.branchExternalId === params.branchExternalId),
            ) ?? null,
        };
        return qb;
      },
    }),
  };
  return { getRepository: () => repo } as unknown as EntityManager;
}

class TestCommand extends AbstractCashflowVoucherCommandService {
  protected readonly voucherTarget = 'V' as never;
  protected readonly codes = {
    next: jest.fn(async () => 'PT-GARA-261117-001'),
  };
}

const input = {
  branchExternalId: 'B1',
  voucherType: 'RECEIPT' as const,
  transDate: '2026-11-17',
  amount: 500,
};

describe('AbstractCashflowVoucherCommandService', () => {
  it('create sinh mã, mặc định PENDING/KH/MANUAL, số tiền 2 chữ số', async () => {
    const rows: Row[] = [];
    const out = await new TestCommand().create(fakeManager(rows), input);
    expect(out).toMatchObject({
      voucherCode: 'PT-GARA-261117-001',
      amount: '500.00',
      status: 'PENDING',
      payerType: 'KH',
      source: 'MANUAL',
    });
  });

  it('từ chối số tiền không dương và mã trùng', async () => {
    const rows: Row[] = [{ id: 'x', voucherCode: 'DUP' }];
    const cmd = new TestCommand();
    const m = fakeManager(rows);
    await expect(cmd.create(m, { ...input, amount: 0 })).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      cmd.create(m, { ...input, voucherCode: 'DUP' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('updateDraft chỉ sửa khi còn nháp', async () => {
    const rows: Row[] = [];
    const cmd = new TestCommand();
    const m = fakeManager(rows);
    const v = await cmd.create(m, input);
    const up = await cmd.updateDraft(m, v.id, {
      amount: 800,
      note: 'a',
    } as never);
    expect(up).toMatchObject({ amount: '800.00', note: 'a' });
    rows[0].status = 'PAID';
    await expect(cmd.updateDraft(m, v.id, { amount: 1 })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('changeStatus theo luồng, CANCELLED là cuối, không có phiếu thì 404', async () => {
    const rows: Row[] = [];
    const cmd = new TestCommand();
    const m = fakeManager(rows);
    const v = await cmd.create(m, input);
    expect((await cmd.changeStatus(m, v.id, 'APPROVED')).status).toBe(
      'APPROVED',
    );
    expect((await cmd.changeStatus(m, v.id, 'PAID')).status).toBe('PAID');
    await expect(cmd.changeStatus(m, v.id, 'PENDING')).rejects.toThrow(
      BadRequestException,
    );
    await cmd.changeStatus(m, v.id, 'CANCELLED');
    await expect(cmd.changeStatus(m, v.id, 'PAID')).rejects.toThrow(
      BadRequestException,
    );
    await expect(cmd.changeStatus(m, 'none', 'PAID')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('updateActive sửa được phiếu PAID nhưng không sửa phiếu hủy', async () => {
    const rows: Row[] = [];
    const cmd = new TestCommand();
    const m = fakeManager(rows);
    const v = await cmd.create(m, { ...input, status: 'PAID' });
    const up = await cmd.updateActive(m, v.id, { amount: 900 });
    expect(up.amount).toBe('900.00');
    rows[0].status = 'CANCELLED';
    await expect(cmd.updateActive(m, v.id, { amount: 1 })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('lock và các lệnh có chi nhánh: khác chi nhánh thì 404', async () => {
    const rows: Row[] = [];
    const cmd = new TestCommand();
    const m = fakeManager(rows);
    const v = await cmd.create(m, input);
    expect((await cmd.lock(m, v.id, 'B1')).id).toBe(v.id);
    await expect(cmd.lock(m, v.id, 'B2')).rejects.toThrow(NotFoundException);
    await expect(cmd.changeStatus(m, v.id, 'PAID', 'B2')).rejects.toThrow(
      NotFoundException,
    );
  });
});

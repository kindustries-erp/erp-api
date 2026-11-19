import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CaseGarage } from '../entities/case-garage.entity';
import { CaseServiceGarage } from '../entities/case-service-garage.entity';
import { CaseLineWriter } from './case-line-writer.service';

const make = (lines: Array<Partial<CaseServiceGarage>> = []) => {
  const m = {
    create: jest.fn((_e: unknown, v: object) => ({ ...v })),
    save: jest.fn((_e: unknown, v: object) =>
      Promise.resolve(Array.isArray(v) ? v : { id: 'new', ...v }),
    ),
    delete: jest.fn(),
    count: jest.fn().mockResolvedValue(2),
    update: jest.fn(),
    find: jest.fn().mockResolvedValue(lines),
    findOne: jest.fn((entity: unknown) =>
      Promise.resolve(
        entity === CaseGarage
          ? { id: 'c1', paidAmount: '50' }
          : (lines[0] ?? null),
      ),
    ),
  };
  return { m, writer: new CaseLineWriter() };
};

const header = { id: 'c1', accountKey: 'MAIN' };

describe('CaseLineWriter', () => {
  it('replaceAll: xóa dòng cũ, lưu dòng mới (đánh số từ 1) và tính lại tổng', async () => {
    const { m, writer } = make([
      { amountWithTax: '110.00', amountBeforeTax: '100.00', partsCost: '0' },
    ]);
    await writer.replaceAll(m as never, header, [
      { productName: 'A', quantity: 1, unitPrice: 100, taxRate: 10 },
      { productName: 'B' },
    ]);
    expect(m.delete).toHaveBeenCalledWith(CaseServiceGarage, { caseId: 'c1' });
    const rows = m.save.mock.calls[0][1] as Array<{
      lineNumber: number;
      amountWithTax: string;
    }>;
    expect(rows.map((r) => r.lineNumber)).toEqual([1, 2]);
    expect(rows[0].amountWithTax).toBe('110.00');
    expect(m.update).toHaveBeenCalledWith(
      CaseGarage,
      { id: 'c1' },
      expect.objectContaining({
        totalAmountWithTax: '110.00',
        outstandingAmount: '60.00',
      }),
    );
  });

  it('add: lineNumber theo số dòng hiện có', async () => {
    const { m, writer } = make([]);
    await writer.add(m as never, header, { productName: 'C' });
    const saved = m.save.mock.calls[0][1] as { lineNumber: number };
    expect(saved.lineNumber).toBe(3);
    expect(m.update).toHaveBeenCalled();
  });

  it('findLine: không thấy dòng -> 404', async () => {
    const { m, writer } = make([]);
    await expect(writer.findLine(m as never, 'c1', 'x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('replaceOne: giữ id và lineNumber cũ khi DTO không đặt', async () => {
    const { m, writer } = make([{ id: 'l1', lineNumber: 4 }]);
    const saved = await writer.replaceOne(m as never, header, 'l1', {
      productName: 'D',
    });
    expect(saved).toMatchObject({ id: 'l1', lineNumber: 4 });
  });

  it('remove: xóa dòng rồi tính lại tổng', async () => {
    const { m, writer } = make([{ id: 'l1' }]);
    await writer.remove(m as never, 'c1', 'l1');
    expect(m.delete).toHaveBeenCalledWith(CaseServiceGarage, { id: 'l1' });
    expect(m.update).toHaveBeenCalled();
  });

  it('recompute: header không tồn tại -> 400', async () => {
    const { m, writer } = make([]);
    m.findOne.mockResolvedValueOnce(null as never);
    await expect(writer.recompute(m as never, 'c1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

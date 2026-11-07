import { ConflictException, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CashflowPurchaseOrderingService } from './cashflow-purchase-ordering.service';
import { legacyPrStatus } from '@/v2/modules/cashflow-garage/helpers/legacy-pr-status';

type Query = jest.Mock<Promise<unknown[]>, [string, unknown[]?]>;

function makeManager(header: unknown, lines: unknown[]) {
  const query: Query = jest.fn(async (sql: string) => {
    if (sql.includes('FROM cashflow_forecasts f'))
      return header ? [header] : [];
    if (sql.includes('FROM cashflow_forecast_lines')) return lines;
    return [];
  });
  return { manager: { query } as unknown as EntityManager, query };
}

const approvedHeader = {
  id: 'f1',
  status: 'OPEN',
  kind: 'PURCHASE',
  closedAt: null,
};
const line = (qtyRequested: string, qtyOrdered: string, id = 'l1') => ({
  id,
  line_type: 'GOODS' as const,
  qty_requested: qtyRequested,
  qty_ordered: qtyOrdered,
});

describe('legacyPrStatus', () => {
  it('OPEN/PARTIAL/SETTLED không đóng → APPROVED', () => {
    expect(legacyPrStatus('OPEN', null)).toBe('APPROVED');
    expect(legacyPrStatus('PARTIAL', null)).toBe('APPROVED');
    expect(legacyPrStatus('SETTLED', null)).toBe('APPROVED');
  });

  it('có dấu đóng → CLOSED, bất kể trạng thái dự chi', () => {
    expect(legacyPrStatus('SETTLED', new Date())).toBe('CLOSED');
    expect(legacyPrStatus('CANCELLED', new Date())).toBe('CLOSED');
  });

  it('CANCELLED không đóng → CANCELLED; PENDING giữ nguyên; DRAFT/REJECTED → DRAFT', () => {
    expect(legacyPrStatus('CANCELLED', null)).toBe('CANCELLED');
    expect(legacyPrStatus('DRAFT', null)).toBe('DRAFT');
    expect(legacyPrStatus('PENDING_APPROVAL', null)).toBe('PENDING_APPROVAL');
    expect(legacyPrStatus('REJECTED', null)).toBe('DRAFT');
  });
});

describe('CashflowPurchaseOrderingService', () => {
  const svc = new CashflowPurchaseOrderingService();

  it('reserve cộng số lượng vào đúng dòng', async () => {
    const { manager, query } = makeManager(approvedHeader, [line('10', '2')]);
    await svc.reserve(manager, 'f1', [{ requestLineId: 'l1', qty: 1.5 }]);
    const update = query.mock.calls.find(([sql]) => sql.startsWith('UPDATE'));
    expect(update?.[1]).toEqual(['l1', '3.5']);
  });

  it('khóa header trước khi đọc dòng (FOR UPDATE)', async () => {
    const { manager, query } = makeManager(approvedHeader, [line('10', '0')]);
    await svc.reserve(manager, 'f1', [{ requestLineId: 'l1', qty: 1 }]);
    expect(query.mock.calls[0][0]).toContain('FOR UPDATE OF f');
    expect(query.mock.calls[1][0]).toContain('FOR UPDATE');
  });

  it('từ chối khi vượt phần còn lại', async () => {
    const { manager, query } = makeManager(approvedHeader, [line('10', '8')]);
    await expect(
      svc.reserve(manager, 'f1', [{ requestLineId: 'l1', qty: 3 }]),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(query.mock.calls.some(([s]) => s.startsWith('UPDATE'))).toBe(false);
  });

  it('từ chối khi dự chi chưa duyệt (DRAFT)', async () => {
    const { manager } = makeManager(
      { ...approvedHeader, status: 'PENDING_APPROVAL' },
      [line('10', '0')],
    );
    await expect(
      svc.reserve(manager, 'f1', [{ requestLineId: 'l1', qty: 1 }]),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('từ chối khi dự chi đã đóng', async () => {
    const { manager } = makeManager(
      { ...approvedHeader, closedAt: new Date() },
      [line('10', '0')],
    );
    await expect(
      svc.reserve(manager, 'f1', [{ requestLineId: 'l1', qty: 1 }]),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('từ chối loại dòng không khớp', async () => {
    const { manager } = makeManager(approvedHeader, [line('10', '0')]);
    await expect(
      svc.reserve(manager, 'f1', [
        { requestLineId: 'l1', qty: 1, lineType: 'SERVICE' },
      ]),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('không tìm thấy dự chi → NotFound', async () => {
    const { manager } = makeManager(null, []);
    await expect(
      svc.reserve(manager, 'f1', [{ requestLineId: 'l1', qty: 1 }]),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('dòng không thuộc dự chi → NotFound', async () => {
    const { manager } = makeManager(approvedHeader, [line('10', '0')]);
    await expect(
      svc.reserve(manager, 'f1', [{ requestLineId: 'lx', qty: 1 }]),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('release trừ số lượng và không xuống dưới 0', async () => {
    const { manager, query } = makeManager(approvedHeader, [line('10', '2')]);
    await svc.release(manager, 'f1', [{ requestLineId: 'l1', qty: 5 }]);
    const update = query.mock.calls.find(([sql]) => sql.startsWith('UPDATE'));
    expect(update?.[1]).toEqual(['l1', '0']);
  });
});

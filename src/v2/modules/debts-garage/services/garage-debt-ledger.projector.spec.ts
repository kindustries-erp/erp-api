import type { EntityManager } from 'typeorm';
import { GarageDebtLedgerProjector } from './garage-debt-ledger.projector';
import type { GarageDebtOriginService } from './garage-debt-origin.service';

const kase = {
  id: 'c1',
  soChungTu: 'PDV-1',
  branchExternalId: 'B1',
  khachHangCode: 'KH1',
  khachHangName: 'An',
  tinhTrangDichVu: 3,
  tenTinhTrangDichVu: 'Kết thúc',
  tienCoThue: 1000,
  chiPhi: 400,
  ngayHoanThanhCongViec: new Date('2026-08-10T03:00:00Z'),
  excludeFromReports: false,
  excludeFromDebt: false,
  kgaraDeletedAt: null,
  rawData: {},
};

function setup(found: unknown, gp: Array<{ chi_phi: string }> = []) {
  const origins = {
    upsertOrigin: jest.fn().mockResolvedValue({ debtId: 'd', created: true }),
    voidOrigin: jest.fn().mockResolvedValue(true),
  };
  const manager = {
    getRepository: () => ({ findOne: jest.fn().mockResolvedValue(found) }),
    query: jest.fn().mockResolvedValue(gp),
  } as unknown as EntityManager;
  const projector = new GarageDebtLedgerProjector(
    origins as unknown as GarageDebtOriginService,
  );
  return { projector, origins, manager };
}

describe('GarageDebtLedgerProjector', () => {
  it('upsert khoản đang hiệu lực và void khoản còn lại (INSURER)', async () => {
    const { projector, origins, manager } = setup(kase, [{ chi_phi: '500' }]);
    const out = await projector.projectCase(manager, 'c1');
    expect(out).toEqual({ upserted: 2, voided: 1 });
    const calls = origins.upsertOrigin.mock.calls.map((c) => c[1]);
    expect(calls.find((c) => c.partyType === 'SUPPLIER').originalAmount).toBe(
      500,
    );
    expect(origins.voidOrigin).toHaveBeenCalledTimes(1);
    expect(origins.voidOrigin.mock.calls[0][1]).toMatchObject({
      sourceType: 'CASE',
      sourceId: 'c1',
      partyType: 'INSURER',
    });
  });

  it('nợ gốc mang chi nhánh ERP của vụ việc v2 cùng id', async () => {
    const { projector, origins, manager } = setup(kase);
    (manager.query as jest.Mock).mockImplementation((sql: string) =>
      Promise.resolve(
        sql.includes('FROM cases_garage') ? [{ branch_id: 'erp-gr' }] : [],
      ),
    );
    await projector.projectCase(manager, 'c1');
    const calls = origins.upsertOrigin.mock.calls.map((c) => c[1]);
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) {
      expect(c).toMatchObject({ branchId: 'erp-gr', branchExternalId: 'B1' });
    }
  });

  it('vụ việc bị xóa hoặc không còn: void cả ba khoản', async () => {
    const { projector, origins, manager } = setup(null);
    const out = await projector.projectCase(manager, 'c1');
    expect(out).toEqual({ upserted: 0, voided: 3 });
    expect(origins.upsertOrigin).not.toHaveBeenCalled();
  });

  it('chỉ upsert/void, không bao giờ đổi settled_amount (không gọi cổng settlement)', async () => {
    const { projector, origins, manager } = setup(kase);
    await projector.projectCase(manager, 'c1');
    expect(Object.keys(origins).sort()).toEqual(['upsertOrigin', 'voidOrigin']);
  });
});

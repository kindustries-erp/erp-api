import type { DataSource } from 'typeorm';
import {
  GrossProfitReportService,
  toItem,
} from './gross-profit-report.service';

function makeService() {
  const query = jest.fn((sql: string, _params?: unknown[]) =>
    Promise.resolve(
      sql.includes('COUNT(*)')
        ? [{ revenue: '300', cost: '100', profit: '200', cnt: 45 }]
        : [],
    ),
  );
  return {
    service: new GrossProfitReportService({ query } as unknown as DataSource),
    query,
  };
}

describe('GrossProfitReportService', () => {
  it('nối vụ việc theo mã và chỉ vụ việc đang hoạt động; chi nhánh là tham số', async () => {
    const { service, query } = makeService();

    await service.getReport({ branchId: 'b1', from: '2026-07-01' });

    const [sql, params] = query.mock.calls[0];
    // Nối LATERAL LIMIT 1: mã trùng không nhân dòng; trùng giữa hai chi nhánh không lộ vụ việc khác.
    expect(sql).toContain('LEFT JOIN LATERAL');
    expect(sql).toContain('c2.so_chung_tu = gp.vu_viec_code');
    expect(sql).toContain('c2.branch_external_id = gp.branch_external_id');
    expect(sql).toContain('c2.kgara_deleted_at IS NULL');
    expect(sql).toContain('LIMIT 1');
    expect(sql).not.toContain('hd_phieu_dich_vu_id');
    expect(params).toEqual(['b1', '2026-07-01']);
  });

  it('tổng bằng SQL, phân trang kẹp pageSize và offset theo trang', async () => {
    const { service, query } = makeService();

    const res = await service.getReport({
      branchId: 'b1',
      page: 2,
      pageSize: 9999,
    });

    expect(res.extraData.totals).toEqual({
      revenue: 300,
      cost: 100,
      profit: 200,
      rowCount: 45,
    });
    expect(res.pagination).toMatchObject({ page: 2, pageSize: 200, total: 45 });
    const dataSql = String(
      query.mock.calls.find(([s]) => String(s).includes('OFFSET'))?.[0],
    );
    expect(dataSql).toContain('LIMIT 200 OFFSET 200');
  });
});

describe('toItem', () => {
  const base = {
    id: 'g1',
    created_at: new Date('2026-08-01T00:00:00Z'),
    updated_at: new Date('2026-08-02T00:00:00Z'),
    vu_viec_code: 'PS1',
    doanh_thu: '1000',
    chi_phi: '400.5',
    loi_nhuan: '599.5',
  };

  it('dòng mồ côi có case = null', () => {
    const item = toItem({ ...base, case_id: null });
    expect(item.case).toBeNull();
    expect(item).toMatchObject({ revenue: 1000, cost: 400.5, profit: 599.5 });
  });

  it('dòng khớp có thông tin vụ việc', () => {
    const item = toItem({
      ...base,
      case_id: 'c1',
      so_chung_tu: 'PS1',
      bien_so_xe: '51A',
    });
    expect(item.case).toMatchObject({
      id: 'c1',
      soChungTu: 'PS1',
      bienSoXe: '51A',
    });
  });
});

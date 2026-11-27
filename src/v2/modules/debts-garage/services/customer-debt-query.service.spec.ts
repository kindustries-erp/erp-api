import {
  createSqlCapture,
  SqlCapture,
} from '@/common/testing/sql-capture.testing';
import { GARAGE_DEBT_BASELINE_DATE } from '../helpers/garage-debt-sql.helper';
import { CustomerDebtQueryService } from './customer-debt-query.service';

describe('CustomerDebtQueryService', () => {
  let cap: SqlCapture;
  let service: CustomerDebtQueryService;

  beforeEach(async () => {
    cap = await createSqlCapture();
    service = new CustomerDebtQueryService(cap.dataSource);
  });

  it('đọc sổ nợ RECEIVABLE (không còn kgara_cases), lọc chi nhánh, bỏ VOID/excluded/đã xóa, kẹp mốc theo dõi', async () => {
    await service.findPage({ branchId: 'b1', from: '2020-01-01' });

    expect(cap.calls.length).toBeGreaterThan(0);
    for (const { sql, params } of cap.calls) {
      expect(sql).toContain('debts_garage');
      expect(sql).not.toContain('kgara_cases');
      expect(sql).toContain('d.is_deleted = false');
      expect(sql).toContain("d.status <> 'VOID'");
      expect(sql).toContain('d.excluded = false');
      expect(params).toEqual(
        expect.arrayContaining(['RECEIVABLE', 'b1', GARAGE_DEBT_BASELINE_DATE]),
      );
      expect(params).not.toContain('2020-01-01');
    }
  });

  it('from sau mốc thì dùng from; to cắt về ngày', async () => {
    await service.findPage({
      branchId: 'b1',
      from: '2026-09-01',
      to: '2026-09-30 10:00:00',
    });

    expect(cap.calls[0].params).toEqual(
      expect.arrayContaining(['2026-09-01', '2026-09-30']),
    );
  });

  it('scope outstanding chỉ lấy nhóm còn nợ; scope all thì không lọc số dư', async () => {
    await service.findPage({ branchId: 'b1', scope: 'outstanding' });
    expect(cap.calls[0].sql).toContain('g.con_phai_thu > 0');

    cap.calls.length = 0;
    await service.findPage({ branchId: 'b1', scope: 'all' });
    expect(cap.calls[0].sql).not.toContain('g.con_phai_thu > 0');
  });

  it('gom theo biển số đã trim, không dùng giá trị giả; ánh xạ dòng và tổng số dòng', async () => {
    cap.respond((sql) =>
      sql.includes('COUNT(*)')
        ? [{ total: '31' }]
        : [
            {
              bien_so_xe: '51A-1',
              khach_hang_code: 'KH1',
              con_phai_thu: '200.00',
              so_phieu: 2,
            },
          ],
    );

    const res = await service.findPage({
      branchId: 'b1',
      page: 2,
      pageSize: 10,
    });

    expect(cap.calls[0].sql).toContain("COALESCE(TRIM(d.license_plate), '')");
    expect(cap.calls[0].sql).not.toContain('CHUA_CO_BKS');
    expect(res.items[0]).toMatchObject({
      licensePlate: '51A-1',
      balanceAmount: 200,
    });
    expect(res.pagination).toMatchObject({ page: 2, pageSize: 10, total: 31 });
    expect(cap.calls[cap.calls.length - 1].sql).toMatch(/LIMIT 10 OFFSET 10$/);
  });

  it('column-options: cột lạ trả rỗng không truy vấn; cột hợp lệ vẫn trong chi nhánh', async () => {
    const empty = await service.findColumnOptions(
      'raw_data',
      {},
      { branchId: 'b1' },
    );
    expect(empty.items).toEqual([]);
    expect(cap.calls).toHaveLength(0);

    await service.findColumnOptions('licensePlate', {}, { branchId: 'b1' });
    expect(cap.calls.length).toBeGreaterThan(0);
    for (const { params } of cap.calls) expect(params).toContain('b1');
  });
});

import { GarageCashflowExportService } from './garage-cashflow-export.service';
import { GARAGE_PARTNER_NAME_SQL } from '../helpers/garage-cashflow-partner';

describe('GarageCashflowExportService - bộ lọc dùng chung với danh sách', () => {
  const filtersOf = (columnFilters: Record<string, string[]>) => {
    const qb: any = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
    };
    const service = new GarageCashflowExportService({} as any, {} as any);
    (service as any).applyFilters(qb, {
      column_filters: JSON.stringify(columnFilters),
    });
    return qb.andWhere.mock.calls.map(([sql]: [unknown]) => String(sql));
  };

  it('áp lọc nhóm quá hạn', () => {
    const sql = filtersOf({ overdueDays: ['D90_PLUS'] }).join('\n');
    expect(sql).toContain("voucher.payment_status = 'EXPECTED'");
    expect(sql).toContain(':overdue_D90_PLUS_to');
  });

  it('lọc đối tác theo đúng giá trị hiển thị', () => {
    expect(filtersOf({ partnerName: ['Khách A'] })).toContain(
      `(${GARAGE_PARTNER_NAME_SQL} IN (:...cfpName))`,
    );
  });
});

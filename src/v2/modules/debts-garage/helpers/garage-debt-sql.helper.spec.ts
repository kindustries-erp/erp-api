import {
  agingSumColumns,
  AGING_COLUMN_BY_BUCKET,
  PAYABLE_EXPRS,
} from './garage-debt-sql.helper';
import { DEFAULT_AGING_BUCKETS } from '@/v2/core/debts-core';

describe('PAYABLE_EXPRS.date', () => {
  it('chỉ ép kiểu NgayKetThuc khi đúng ISO, sai format rơi về ngày phát sinh', () => {
    expect(PAYABLE_EXPRS.date).toContain("~ '^\\d{4}-\\d{2}-\\d{2}'");
    expect(PAYABLE_EXPRS.date).toContain('CASE WHEN');
    expect(PAYABLE_EXPRS.date).toContain('c.ngay_phat_sinh');
  });
});

describe('PAYABLE_EXPRS.hasPayable', () => {
  it('chỉ giữ vụ có chi phí > 0, vụ chi phí 0 dù đã chi cũng bị loại (khớp V1 và sổ nợ)', () => {
    expect(PAYABLE_EXPRS.hasPayable).toBe(`(${PAYABLE_EXPRS.cost} > 0)`);
    expect(PAYABLE_EXPRS.hasPayable).not.toContain(PAYABLE_EXPRS.paid);
  });
});

describe('agingSumColumns', () => {
  const sql = agingSumColumns('c.bal', 'c.dt');

  it('sinh đủ 4 cột mốc đúng khoảng ngày như V1', () => {
    expect(sql).toContain('<= 30 THEN');
    expect(sql).toContain('BETWEEN 31 AND 60 THEN');
    expect(sql).toContain('BETWEEN 61 AND 90 THEN');
    expect(sql).toContain('> 90 THEN');
  });

  it('mỗi mốc mặc định có tên cột', () => {
    for (const bucket of DEFAULT_AGING_BUCKETS) {
      expect(sql).toContain(`AS ${AGING_COLUMN_BY_BUCKET[bucket.key]}`);
    }
  });
});

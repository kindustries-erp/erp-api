import { reconcileRows } from './garage-debts-reconcile.compare';
import {
  PAYABLE_RECONCILE_SQL,
  RECEIVABLE_RECONCILE_SQL,
} from './garage-debts-reconcile.sql';

describe('reconcileRows', () => {
  it('ba nguồn bằng nhau thì không lệch, cộng tổng theo nguồn', () => {
    const res = reconcileRows(
      [
        {
          case_id: 'a',
          code: 'A',
          v1_bal: '100.00',
          v2_bal: 100,
          led_bal: '100',
        },
        { case_id: 'b', code: 'B', v1_bal: 50, v2_bal: 50, led_bal: 50 },
      ],
      ['bal'],
    );
    expect(res.mismatches).toEqual([]);
    expect(res.totals.bal).toEqual({ v1: 150, v2: 150, led: 150 });
  });

  it('GR-PDV2607-0063: sổ nợ treo dòng BH 6,946,100 trong khi V1 = 0 thì báo lệch', () => {
    const res = reconcileRows(
      [
        {
          case_id: 'x',
          code: 'GR-PDV2607-0063',
          v1_bal: 0,
          v2_bal: 0,
          led_bal: 6_946_100,
        },
      ],
      ['bal'],
    );
    expect(res.mismatches).toEqual([
      {
        caseId: 'x',
        code: 'GR-PDV2607-0063',
        field: 'bal',
        values: { v1: 0, v2: 0, led: 6_946_100 },
      },
    ]);
  });

  it('vụ thiếu ở một nguồn tính là 0: V1 còn 0 mà sổ nợ không có dòng thì khớp', () => {
    const res = reconcileRows(
      [{ case_id: 'z', code: 'Z', v1_bal: 0, v2_bal: '0.00', led_bal: null }],
      ['bal'],
    );
    expect(res.mismatches).toHaveLength(0);
  });

  it('so riêng từng chỉ tiêu phải trả: chỉ báo chỉ tiêu lệch', () => {
    const res = reconcileRows(
      [
        {
          case_id: 'p',
          code: 'GR-PDV2607-0007',
          v1_cost: 0,
          v1_paid: 5_350_000,
          v1_bal: 0,
          v2_cost: 0,
          v2_paid: 0,
          v2_bal: 0,
          led_cost: null,
          led_paid: null,
          led_bal: null,
        },
      ],
      ['cost', 'paid', 'bal'],
    );
    expect(res.mismatches.map((m) => m.field)).toEqual(['paid']);
  });

  it('bỏ qua lệch làm tròn dưới 0.005', () => {
    const res = reconcileRows(
      [{ case_id: 'r', v1_bal: 10.001, v2_bal: 10, led_bal: 10.004 }],
      ['bal'],
    );
    expect(res.mismatches).toHaveLength(0);
  });
});

describe('SQL đối soát', () => {
  it('phải trả ở V1 và v2 chỉ giữ vụ chi phí > 0, không còn điều kiện đã chi <> 0', () => {
    expect(PAYABLE_RECONCILE_SQL).not.toMatch(/paid"?,\s*0\)::numeric <> 0/);
    expect(PAYABLE_RECONCILE_SQL).toContain("d.direction = 'PAYABLE'");
  });

  it('chỉ đọc và lọc sổ nợ còn hiệu lực theo mốc $1', () => {
    for (const sql of [RECEIVABLE_RECONCILE_SQL, PAYABLE_RECONCILE_SQL]) {
      expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b/i);
      expect(sql).toContain("d.status <> 'VOID'");
      expect(sql).toContain('d.due_base_date >= $1');
    }
  });
});

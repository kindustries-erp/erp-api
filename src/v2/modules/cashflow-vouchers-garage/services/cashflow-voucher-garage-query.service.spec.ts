import { NotFoundException } from '@nestjs/common';
import {
  createSqlCapture,
  type SqlCapture,
} from '@/common/testing/sql-capture.testing';
import { CashflowVoucherGarage } from '../entities/cashflow-voucher-garage.entity';
import { CashflowVoucherGarageQueryService } from './cashflow-voucher-garage-query.service';

describe('CashflowVoucherGarageQueryService', () => {
  let cap: SqlCapture;
  let service: CashflowVoucherGarageQueryService;

  beforeEach(async () => {
    cap = await createSqlCapture([CashflowVoucherGarage]);
    service = new CashflowVoucherGarageQueryService(
      cap.dataSource.getRepository(CashflowVoucherGarage),
    );
  });

  it('có chọn chi nhánh ERP thì lọc branch_id, bỏ phiếu đã xóa mềm', async () => {
    await service.findPage({ branchId: 'b1' });
    expect(cap.calls.length).toBeGreaterThan(0);
    for (const { sql, params } of cap.calls) {
      expect(sql).toContain('"v"."is_deleted" = false');
      expect(sql).toMatch(/"?v"?\."?branch_id"? = \$1/);
      expect(params).toContain('b1');
    }
  });

  it('không chọn chi nhánh thì không lọc chi nhánh', async () => {
    await service.findPage({});
    for (const { sql } of cap.calls) {
      expect(sql).not.toMatch(/branch_id"? =/);
      expect(sql).not.toMatch(/branch_external_id"? =/);
    }
  });

  it('lọc loại phiếu, vụ việc, khoảng ngày; status ngoài whitelist bị bỏ qua', async () => {
    await service.findPage({
      branchId: 'b1',
      voucherType: 'RECEIPT',
      caseId: 'c1',
      status: 'PAID',
      date_from: '2026-11-01',
      date_to: '2026-11-30',
    });
    expect(cap.calls[0].params).toEqual(
      expect.arrayContaining([
        'b1',
        'RECEIPT',
        'c1',
        'PAID',
        '2026-11-01',
        '2026-11-30',
      ]),
    );
    cap.calls.length = 0;
    await service.findPage({ branchId: 'b1', status: "PAID' OR 1=1" });
    expect(cap.calls[0].params).not.toContain("PAID' OR 1=1");
  });

  it('sắp xếp mặc định theo ngày giảm dần, kèm tie-breaker id', async () => {
    await service.findPage({ branchId: 'b1' });
    expect(cap.calls[0].sql).toContain(
      'ORDER BY "v"."trans_date" DESC, "v"."id" ASC',
    );
  });

  it('findOne: phiếu khác chi nhánh coi như không tồn tại', async () => {
    cap.respond(() => []);
    await expect(service.findOne('b1', 'v1')).rejects.toThrow(
      NotFoundException,
    );
    expect(cap.calls[0].params).toEqual(expect.arrayContaining(['v1', 'b1']));
  });
});

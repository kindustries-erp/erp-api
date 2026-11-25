import { NotFoundException } from '@nestjs/common';
import {
  createSqlCapture,
  type SqlCapture,
} from '@/common/testing/sql-capture.testing';
import { DebtAllocationGarage } from '../entities/debt-allocation-garage.entity';
import { DebtGarage } from '../entities/debt-garage.entity';
import { DebtLedgerQueryService } from './debt-ledger-query.service';

describe('DebtLedgerQueryService', () => {
  let cap: SqlCapture;
  let service: DebtLedgerQueryService;

  beforeEach(async () => {
    cap = await createSqlCapture([DebtGarage, DebtAllocationGarage]);
    service = new DebtLedgerQueryService(
      cap.dataSource.getRepository(DebtGarage),
      cap.dataSource.getRepository(DebtAllocationGarage),
    );
  });

  it('có chọn chi nhánh ERP thì lọc branch_id, bỏ dòng đã xóa mềm', async () => {
    await service.findPage({ branchId: 'b1' });
    expect(cap.calls.length).toBeGreaterThan(0);
    for (const { sql, params } of cap.calls) {
      expect(sql).toContain('"d"."is_deleted" = false');
      expect(sql).toMatch(/"?d"?\."?branch_id"? = \$1/);
      expect(params).toContain('b1');
    }
  });

  it('không chọn chi nhánh thì không lọc chi nhánh', async () => {
    await service.findPage({});
    for (const { sql } of cap.calls) {
      expect(sql).not.toMatch(/branch_id"? =/);
      expect(sql).not.toContain('"d"."branch_external_id" =');
    }
  });

  it('lọc theo chiều, loại đối tượng, vụ việc; status ngoài whitelist bị bỏ qua', async () => {
    await service.findPage({
      branchId: 'b1',
      direction: 'RECEIVABLE',
      partyType: 'INSURER',
      caseId: 'c1',
      status: 'OPEN',
    });
    expect(cap.calls[0].params).toEqual(
      expect.arrayContaining(['RECEIVABLE', 'INSURER', 'c1', 'OPEN']),
    );

    cap.calls.length = 0;
    await service.findPage({ branchId: 'b1', status: "OPEN' OR 1=1" });
    expect(cap.calls[0].params).not.toContain("OPEN' OR 1=1");
  });

  it('findAllocations: khoản nợ khác chi nhánh coi như không tồn tại', async () => {
    cap.respond(() => []);
    await expect(service.findAllocations('b1', 'debt-1')).rejects.toThrow(
      NotFoundException,
    );
    const sql = cap.calls[0];
    expect(sql.params).toEqual(expect.arrayContaining(['debt-1', 'b1']));
  });
});

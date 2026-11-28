import type { DataSource, EntityManager } from 'typeorm';
import { KgaraCashflowVoucher } from '@/kgara-api-core/entities/kgara_cashflow_voucher.entity';
import { KgaraCaseSettlement } from '@/kgara-api-core/entities/kgara_case_settlement.entity';
import { KgaraCase } from '@/kgara-api-core/entities/kgara_case.entity';
import { CaseGarage } from '../../cases-garage/entities/case-garage.entity';
import { CashflowVoucherGarage } from '../../cashflow-vouchers-garage/entities/cashflow-voucher-garage.entity';
import { DebtAllocationGarage } from '../../debts-garage/entities/debt-allocation-garage.entity';
import { DebtGarage } from '../../debts-garage/entities/debt-garage.entity';

/** Id chi nhánh ERP coi như không tồn tại trong DB giả. */
export const MISSING_BRANCH_ID = '00000000-0000-4000-8000-00000000dead';

export type Row = Record<string, any>;

/**
 * DB giả trong bộ nhớ cho integration spec của orchestrator: các bảng thật (entity), transaction có snapshot
 * và rollback khi lỗi, đủ các hình dạng truy vấn mà settlement/command/allocation dùng.
 * KHÔNG thay Postgres: không kiểm khóa dòng hay ghi đồng thời thật.
 */
export function createInMemoryLedger() {
  const tables = new Map<unknown, Row[]>([
    [DebtGarage, []],
    [DebtAllocationGarage, []],
    [CashflowVoucherGarage, []],
    [KgaraCase, []],
    [CaseGarage, []],
    [KgaraCashflowVoucher, []],
    [KgaraCaseSettlement, []],
  ]);
  let seq = 0;
  const matches = (row: Row, where: Row = {}) =>
    Object.entries(where).every(([k, v]) =>
      v === null ? row[k] == null : row[k] === v,
    );

  const repo = (entity: unknown) => {
    const rows = () => {
      if (!tables.has(entity)) tables.set(entity, []);
      return tables.get(entity) as Row[];
    };
    return {
      create: (o: Row) => ({ ...o }),
      delete: async (where: Row) => {
        const keep = rows().filter((r) => !matches(r, where));
        tables.set(entity, keep);
      },
      update: async (where: Row, patch: Row) => {
        rows()
          .filter((r) => matches(r, where))
          .forEach((r) => Object.assign(r, patch));
      },
      save: async (o: Row) => {
        const found = o.id ? rows().find((r) => r.id === o.id) : undefined;
        if (found) {
          if (found !== o) Object.assign(found, o);
          return found;
        }
        seq += 1;
        o.id ??= `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`;
        o.createdAt ??= new Date(2026, 10, 17, 0, 0, seq);
        o.isDeleted ??= false;
        rows().push(o);
        return o;
      },
      find: async ({ where, order }: { where?: Row; order?: Row } = {}) => {
        const out = rows().filter((r) => matches(r, where));
        const key = order && Object.keys(order)[0];
        return key
          ? [...out].sort((a, b) =>
              String(a[key]).localeCompare(String(b[key])),
            )
          : out;
      },
      findOne: async ({ where }: { where?: Row } = {}) =>
        rows().find((r) => matches(r, where)) ?? null,
      count: async ({ where }: { where?: Row } = {}) =>
        rows().filter((r) => matches(r, where)).length,
      exists: async ({ where }: { where?: Row } = {}) =>
        rows().some((r) => matches(r, where)),
      createQueryBuilder: () => {
        let params: Row = {};
        let selected = false;
        let sqlText = '';
        const qb: Row = {
          setLock: () => qb,
          select: () => ((selected = true), qb),
          where: (sql: string, p: Row = {}) => (
            (sqlText += sql),
            (params = { ...p }),
            qb
          ),
          andWhere: (sql: string, p: Row = {}) => (
            (sqlText += sql),
            Object.assign(params, p),
            qb
          ),
          getOne: async () =>
            rows().find(
              (r) =>
                r.id === (params.debtId ?? params.id) &&
                !r.isDeleted &&
                (params.branchId === undefined ||
                  r.branchId === params.branchId),
            ) ?? null,
          getRawOne: async () => {
            if (!selected) return null;
            const key = sqlText.includes('voucherId') ? 'voucherId' : 'debtId';
            const sum = rows()
              .filter((r) => r[key] === params.id && !r.reversedAt)
              .reduce((s, r) => s + Number(r.amount), 0);
            return { sum: String(sum) };
          },
        };
        return qb;
      },
    };
  };

  const manager = {
    getRepository: (e: unknown) => repo(e),
    delete: (e: unknown, where: Row) => repo(e).delete(where),
    // Chỉ dùng cho kiểm chi nhánh ERP tồn tại: mọi id có thật, trừ `MISSING_BRANCH_ID`.
    query: async (_sql: string, params: unknown[] = []) =>
      params[0] === MISSING_BRANCH_ID ? [] : [{ exists: 1 }],
  } as unknown as EntityManager;
  const snapshot = () =>
    new Map([...tables].map(([k, v]) => [k, v.map((r) => ({ ...r }))]));
  const dataSource = {
    transaction: async (work: (m: EntityManager) => Promise<unknown>) => {
      const saved = snapshot();
      try {
        return await work(manager);
      } catch (error) {
        for (const [k, v] of saved) tables.set(k, v);
        throw error;
      }
    },
  } as unknown as DataSource;

  return {
    dataSource,
    manager,
    debts: () => tables.get(DebtGarage) as Row[],
    allocations: () => tables.get(DebtAllocationGarage) as Row[],
    vouchers: () => tables.get(CashflowVoucherGarage) as Row[],
    cases: () => tables.get(KgaraCase) as Row[],
    v1Vouchers: () => tables.get(KgaraCashflowVoucher) as Row[],
    v1Settlements: () => tables.get(KgaraCaseSettlement) as Row[],
    seedDebt: (over: Row): Row => {
      const original = Number(over.originalAmount ?? 1000);
      const row = {
        id: `d-${over.partyType ?? 'CUSTOMER'}-${++seq}`,
        branchExternalId: 'KG1',
        branchId: 'B1',
        sourceType: 'CASE',
        sourceId: 'case-1',
        caseId: 'case-1',
        direction: 'RECEIVABLE',
        partyType: 'CUSTOMER',
        partyCode: 'KH1',
        originalAmount: original.toFixed(2),
        settledAmount: '0.00',
        balanceAmount: original.toFixed(2),
        status: 'OPEN',
        isDeleted: false,
        ...over,
      };
      row.originalAmount = Number(row.originalAmount).toFixed(2);
      (tables.get(DebtGarage) as Row[]).push(row);
      return row;
    },
    /** Vụ việc V1 và bản chiếu V2 cùng id (`branchId` = chi nhánh ERP, `branchExternalId` = UUID KGara). */
    seedCase: (over: Row = {}) => {
      const id = (over.id as string) ?? 'case-1';
      (tables.get(KgaraCase) as Row[]).push({
        id,
        branchExternalId: 'KG1',
        bienSoXe: '30A-1',
        ...over,
      });
      (tables.get(CaseGarage) as Row[]).push({
        id,
        branchId: (over.branchId as string) ?? 'B1',
        branchExternalId: 'KG1',
        licensePlate: (over.bienSoXe as string) ?? '30A-1',
        customerName: (over.customerName as string) ?? null,
        isDeleted: false,
      });
    },
  };
}

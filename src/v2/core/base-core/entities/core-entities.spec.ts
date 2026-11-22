import { getMetadataArgsStorage } from 'typeorm';
import { CoreAuditedEntity } from './core-audited.entity';
import { CoreBaseEntity } from './core-base.entity';
import { CoreHeaderEntity } from './core-header.entity';
import { CoreSoftDeletableEntity } from './core-soft-deletable.entity';

class ProbeHeader extends CoreHeaderEntity {}
class ProbeAudited extends CoreAuditedEntity {}
class ProbeBase extends CoreBaseEntity {}
class ProbeSoft extends CoreSoftDeletableEntity {}

type EntityCtor = abstract new (...args: never[]) => unknown;

/** Chuỗi kế thừa giống cách TypeORM tra cột: lớp hiện tại rồi tới các lớp cha. */
const inheritanceTree = (target: EntityCtor): EntityCtor[] => {
  const chain: EntityCtor[] = [];
  let current: EntityCtor | null = target;
  while (current && current !== Function.prototype) {
    chain.push(current);
    current = Object.getPrototypeOf(current) as EntityCtor | null;
  }
  return chain;
};

const columnsOf = (target: EntityCtor) =>
  getMetadataArgsStorage().filterColumns(inheritanceTree(target));

const columnNames = (target: EntityCtor) =>
  columnsOf(target).map((c) => c.options.name ?? c.propertyName);

describe('core entity chain', () => {
  it('CoreBaseEntity có extra_data jsonb mặc định {}', () => {
    const col = columnsOf(ProbeBase).find(
      (c) => c.propertyName === 'extraData',
    );
    expect(col?.options.name).toBe('extra_data');
    expect(col?.options.type).toBe('jsonb');
  });

  it('CoreAuditedEntity thêm created_at/updated_at timestamptz', () => {
    const cols = columnNames(ProbeAudited);
    expect(cols).toEqual(
      expect.arrayContaining(['id', 'extra_data', 'created_at', 'updated_at']),
    );
  });

  it('CoreSoftDeletableEntity thêm is_deleted', () => {
    expect(columnNames(ProbeSoft)).toContain('is_deleted');
  });

  it('CoreHeaderEntity thêm status và created_by, đủ bộ cột header', () => {
    const cols = columnNames(ProbeHeader);
    expect(cols).toEqual(
      expect.arrayContaining([
        'id',
        'extra_data',
        'created_at',
        'updated_at',
        'is_deleted',
        'status',
        'created_by',
      ]),
    );
  });
});

import { QueryRunner } from 'typeorm';
import { SeedGarageWorkshopPermissions20261124100100 } from './20261124100100-seed-garage-workshop-permissions';

describe('SeedGarageWorkshopPermissions20261124100100', () => {
  const makeRunner = () => {
    const query = jest.fn().mockResolvedValue(undefined);
    return { runner: { query } as unknown as QueryRunner, query };
  };

  it('up() sao chép read/update từ garage sang garage_workshop, bỏ qua dòng đã có', async () => {
    const { runner, query } = makeRunner();
    await new SeedGarageWorkshopPermissions20261124100100().up(runner);
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO "rbac_permissions"');
    expect(sql).toContain('NOT EXISTS');
    expect(sql).not.toContain('core_permissions');
    expect(params).toEqual(['garage', 'garage_workshop', ['read', 'update']]);
  });

  it('down() chỉ xóa resource garage_workshop', async () => {
    const { runner, query } = makeRunner();
    await new SeedGarageWorkshopPermissions20261124100100().down(runner);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain(
      'DELETE FROM "rbac_permissions" WHERE "resource" = $1',
    );
    expect(params).toEqual(['garage_workshop']);
  });
});

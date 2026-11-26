import { QueryRunner } from 'typeorm';
import { SeedGarageWorkshopPermissionsFullAccess20261124120000 } from './20261124120000-seed-garage-workshop-permissions-full-access';

describe('SeedGarageWorkshopPermissionsFullAccess20261124120000', () => {
  const makeRunner = () => {
    const query = jest.fn().mockResolvedValue(undefined);
    return { runner: { query } as unknown as QueryRunner, query };
  };
  const params = [
    'garage',
    'garage_workshop',
    ['*', 'manage'],
    ['read', 'update'],
  ];

  it('up() cấp read/update garage_workshop cho role có garage:* hoặc garage:manage, bỏ qua dòng đã có', async () => {
    const { runner, query } = makeRunner();
    await new SeedGarageWorkshopPermissionsFullAccess20261124120000().up(
      runner,
    );
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, p] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO "rbac_permissions"');
    expect(sql).toContain('unnest($4::varchar[])');
    expect(sql).toContain('NOT EXISTS');
    expect(p).toEqual(params);
  });

  it('down() chỉ xóa dòng garage_workshop của role toàn quyền garage, giữ dòng chép từ read/update', async () => {
    const { runner, query } = makeRunner();
    await new SeedGarageWorkshopPermissionsFullAccess20261124120000().down(
      runner,
    );
    const [sql, p] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('DELETE FROM "rbac_permissions" t');
    expect(sql).toContain('p."action" = t."action"');
    expect(p).toEqual(params);
  });
});

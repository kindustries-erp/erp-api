import { RoleUsersService } from './role-users.service';

type Row = {
  id: string;
  roleId: string;
  userId: string;
  user?: { email: string };
};

/** Repository giả: lưu gán role trong bộ nhớ, ghi lại các lệnh delete/save. */
function makeRepo(rows: Row[], hiddenUsers: { id: string; email: string }[]) {
  let store = [...rows];
  let seq = 100;
  const deleted: string[][] = [];
  const saved: Row[][] = [];
  const repo = {
    find: jest.fn(async ({ where }: { where: { roleId: string } }) =>
      store
        .filter((r) => r.roleId === where.roleId)
        .map((r) => ({
          ...r,
          user: {
            id: r.userId,
            email:
              hiddenUsers.find((u) => u.id === r.userId)?.email ??
              'other@example.com',
          },
        })),
    ),
    delete: jest.fn(async (criteria: unknown) => {
      if (Array.isArray(criteria)) {
        deleted.push(criteria as string[]);
        store = store.filter((r) => !(criteria as string[]).includes(r.id));
        return;
      }
      const roleId = (criteria as { roleId: string }).roleId;
      deleted.push(store.filter((r) => r.roleId === roleId).map((r) => r.id));
      store = store.filter((r) => r.roleId !== roleId);
    }),
    create: jest.fn((data: { roleId: string; userId: string }) => ({
      id: `new-${seq++}`,
      ...data,
    })),
    save: jest.fn(async (list: Row[]) => {
      saved.push(list);
      store = [...store, ...list];
      return list;
    }),
    query: jest.fn(async () =>
      hiddenUsers
        .filter((u) => u.email.startsWith('ai-test-'))
        .map((u) => ({ id: u.id })),
    ),
  };
  return { repo, deleted, saved, current: () => store };
}

const HIDDEN_TAO = { id: 'u-tao', email: 'ai-test-tao@example.com' };
const HIDDEN_ADMIN = { id: 'u-admin', email: 'ai-test-admin@example.com' };
const NORMAL = { id: 'u-normal', email: 'nhanvien@example.com' };

describe('RoleUsersService', () => {
  const seed: Row[] = [
    { id: 'ur-1', roleId: 'role-x', userId: 'u-tao' },
    { id: 'ur-2', roleId: 'role-x', userId: 'u-normal' },
    { id: 'ur-3', roleId: 'role-other', userId: 'u-admin' },
  ];

  it('getRoleUsers: người không có quyền không thấy tài khoản test', async () => {
    const { repo } = makeRepo(seed, [HIDDEN_TAO, HIDDEN_ADMIN, NORMAL]);
    const service = new RoleUsersService(repo as any);
    const users = await service.getRoleUsers('role-x', 'nhanvien@example.com');
    expect(users.map((u: any) => u.id)).toEqual(['u-normal']);
  });

  it('getRoleUsers: admin@liouni.com thấy đủ', async () => {
    const { repo } = makeRepo(seed, [HIDDEN_TAO, HIDDEN_ADMIN, NORMAL]);
    const service = new RoleUsersService(repo as any);
    const users = await service.getRoleUsers('role-x', 'admin@liouni.com');
    expect(users).toHaveLength(2);
  });

  it('updateRoleUsers (người thường): không gỡ gán của tài khoản test, không gán tài khoản test', async () => {
    const { repo, current } = makeRepo(seed, [
      HIDDEN_TAO,
      HIDDEN_ADMIN,
      NORMAL,
    ]);
    const service = new RoleUsersService(repo as any);
    // Người xem gửi danh sách không có tài khoản test, và cố gán thêm ai-test-admin.
    await service.updateRoleUsers(
      'role-x',
      { userIds: ['u-normal', 'u-admin'] } as any,
      'nhanvien@example.com',
    );
    const rows = current().filter((r) => r.roleId === 'role-x');
    expect(rows.map((r) => r.userId).sort()).toEqual(
      ['u-normal', 'u-tao'].sort(),
    );
    // Gán role của ai-test-tao (ur-1) vẫn còn nguyên id.
    expect(rows.find((r) => r.userId === 'u-tao')?.id).toBe('ur-1');
    // Role khác không bị động tới.
    expect(current().find((r) => r.id === 'ur-3')).toBeDefined();
  });

  it('updateRoleUsers (người thường): gỡ được người dùng thường', async () => {
    const { repo, current } = makeRepo(seed, [
      HIDDEN_TAO,
      HIDDEN_ADMIN,
      NORMAL,
    ]);
    const service = new RoleUsersService(repo as any);
    await service.updateRoleUsers(
      'role-x',
      { userIds: [] } as any,
      'nhanvien@example.com',
    );
    const rows = current().filter((r) => r.roleId === 'role-x');
    expect(rows.map((r) => r.userId)).toEqual(['u-tao']);
  });

  it('updateRoleUsers (admin@liouni.com): thay toàn bộ danh sách như cũ', async () => {
    const { repo, current } = makeRepo(seed, [
      HIDDEN_TAO,
      HIDDEN_ADMIN,
      NORMAL,
    ]);
    const service = new RoleUsersService(repo as any);
    await service.updateRoleUsers(
      'role-x',
      { userIds: ['u-admin'] } as any,
      'admin@liouni.com',
    );
    const rows = current().filter((r) => r.roleId === 'role-x');
    expect(rows.map((r) => r.userId)).toEqual(['u-admin']);
  });
});

import {
  displayApproverId,
  resolvePurchaseRequestPeople,
} from './procurement-request-people';

const actors = (
  map: Record<string, { name: string | null; email: string | null }>,
) => ({
  resolve: jest.fn(async (ids: ReadonlyArray<string | null | undefined>) => {
    const out = new Map();
    for (const id of ids) if (id && map[id]) out.set(id, map[id]);
    return out;
  }),
});

describe('displayApproverId', () => {
  it('đã duyệt thì lấy người thực duyệt, chưa duyệt thì lấy người được giao', () => {
    expect(displayApproverId({ approvedBy: 'a', approverId: 'g' })).toBe('a');
    expect(displayApproverId({ approvedBy: null, approverId: 'g' })).toBe('g');
    expect(
      displayApproverId({ approvedBy: null, approverId: null }),
    ).toBeNull();
  });
});

describe('resolvePurchaseRequestPeople', () => {
  it('tra email người tạo và người duyệt theo lô, một lần gọi', async () => {
    const svc = actors({
      u1: { name: 'A', email: 'a@x.vn' },
      u2: { name: null, email: 'b@x.vn' },
    });
    const map = await resolvePurchaseRequestPeople(svc as never, [
      { id: 'h1', createdBy: 'u1', approvedBy: 'u2', approverId: null },
      { id: 'h2', createdBy: null, approvedBy: null, approverId: 'u2' },
    ]);
    expect(svc.resolve).toHaveBeenCalledTimes(1);
    expect(map.get('h1')).toEqual({
      createdByEmail: 'a@x.vn',
      approverEmail: 'b@x.vn',
    });
    expect(map.get('h2')).toEqual({
      createdByEmail: null,
      approverEmail: 'b@x.vn',
    });
  });

  it('user không tồn tại thì email là null, không ném lỗi', async () => {
    const map = await resolvePurchaseRequestPeople(actors({}) as never, [
      { id: 'h1', createdBy: 'ghost', approvedBy: null, approverId: null },
    ]);
    expect(map.get('h1')).toEqual({
      createdByEmail: null,
      approverEmail: null,
    });
  });

  it('danh sách rỗng thì trả Map rỗng', async () => {
    const map = await resolvePurchaseRequestPeople(actors({}) as never, []);
    expect(map.size).toBe(0);
  });
});

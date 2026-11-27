import {
  applyProjection,
  isLineDeleted,
  markOverrides,
  overriddenFields,
  revertFields,
  sameValue,
  sourceValues,
} from './link-override.helper';

describe('link-override.helper', () => {
  const tracked = new Set(['licensePlate', 'receivedAt', 'paidAmount']);

  it('applyProjection luôn ghi snapshot, bỏ field đã override khỏi patch', () => {
    const mapped = {
      id: 'x',
      origin: 'KGARA_SYNC',
      licensePlate: '30A-1',
      customerName: 'A',
      receivedAt: new Date('2026-01-01T00:00:00Z'),
    };
    const { snapshot, patch } = applyProjection(
      mapped,
      { licensePlate: true },
      new Set(['id', 'origin']),
    );
    expect(snapshot).toEqual({
      licensePlate: '30A-1',
      customerName: 'A',
      receivedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(patch).toEqual({
      id: 'x',
      origin: 'KGARA_SYNC',
      customerName: 'A',
      receivedAt: mapped.receivedAt,
    });
  });

  it('applyProjection không bỏ khóa nào khỏi snapshot khi không truyền skipKeys', () => {
    expect(applyProjection({ id: 'x', a: 1 }, {}).snapshot).toEqual({
      id: 'x',
      a: 1,
    });
  });

  it('sameValue coi số và chuỗi số, Date và ISO là bằng nhau', () => {
    expect(sameValue('100.00', 100)).toBe(true);
    expect(
      sameValue(new Date('2026-01-01T00:00:00Z'), '2026-01-01T00:00:00.000Z'),
    ).toBe(true);
    expect(sameValue(null, undefined)).toBe(true);
    expect(sameValue('a', 'b')).toBe(false);
    expect(sameValue('', 0)).toBe(false);
  });

  it('markOverrides đánh dấu khi khác snapshot, bỏ dấu khi trùng lại, bỏ qua khóa không theo dõi', () => {
    const snapshot = { licensePlate: '30A-1', paidAmount: '0.00' };
    let o = markOverrides(
      { licensePlate: '29B-2', other: 1 },
      snapshot,
      {},
      tracked,
    );
    expect(o).toEqual({ licensePlate: true });
    o = markOverrides({ licensePlate: '30A-1' }, snapshot, o, tracked);
    expect(o).toEqual({});
  });

  it('markOverrides đánh dấu khóa chưa có trong snapshot', () => {
    expect(markOverrides({ receivedAt: new Date() }, {}, {}, tracked)).toEqual({
      receivedAt: true,
    });
  });

  it('revertFields trả giá trị snapshot, đổi ISO về Date cho khóa ngày, chỉ xử lý khóa đang override', () => {
    const snapshot = {
      licensePlate: '30A-1',
      receivedAt: '2026-01-01T00:00:00.000Z',
    };
    const r = revertFields(
      ['licensePlate', 'receivedAt', 'customerName'],
      snapshot,
      { licensePlate: true, receivedAt: true, other: true },
      new Set(['receivedAt']),
    );
    expect(r.values).toEqual({
      licensePlate: '30A-1',
      receivedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    expect(r.overrides).toEqual({ other: true });
  });

  it('overriddenFields bỏ _deleted; isLineDeleted nhận _deleted', () => {
    expect(overriddenFields({ b: true, _deleted: true, a: true })).toEqual([
      'a',
      'b',
    ]);
    expect(isLineDeleted({ _deleted: true })).toBe(true);
    expect(isLineDeleted({})).toBe(false);
  });

  it('sourceValues chỉ lấy giá trị snapshot của field đang override', () => {
    const snapshot = { licensePlate: '51B79071', customerName: 'A', qty: 2 };
    expect(
      sourceValues(snapshot, { licensePlate: true, _deleted: true }),
    ).toEqual({ licensePlate: '51B79071' });
    expect(sourceValues(snapshot, {})).toEqual({});
  });

  it('sourceValues bỏ khóa override không có trong snapshot; null an toàn', () => {
    expect(sourceValues({ a: 1 }, { b: true })).toEqual({});
    expect(sourceValues({ a: null }, { a: true })).toEqual({ a: null });
    expect(sourceValues(null, { a: true })).toEqual({});
    expect(sourceValues({ a: 1 }, null)).toEqual({});
  });
});

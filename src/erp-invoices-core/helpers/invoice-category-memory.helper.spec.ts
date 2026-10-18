import { pickDominantCategory } from './invoice-category-memory.helper';

describe('pickDominantCategory', () => {
  it('returns the dominant category when samples and share are enough', () => {
    const r = pickDominantCategory([
      { category_code: 'OPEX_LOGISTICS', n: 9 },
      { category_code: 'OPEX_ADMIN', n: 1 },
    ]);
    expect(r).toEqual({
      categoryCode: 'OPEX_LOGISTICS',
      count: 9,
      total: 10,
      share: 0.9,
    });
  });

  it('accepts numeric strings from the database driver', () => {
    const r = pickDominantCategory([{ category_code: 'VF_PARTS', n: '4' }]);
    expect(r?.categoryCode).toBe('VF_PARTS');
  });

  it('returns null with too few samples', () => {
    expect(
      pickDominantCategory([{ category_code: 'OPEX_ADMIN', n: 2 }]),
    ).toBeNull();
  });

  it('returns null for mixed sellers below the share threshold', () => {
    expect(
      pickDominantCategory([
        { category_code: 'OPEX_LOGISTICS', n: 6 },
        { category_code: 'OPEX_ADMIN', n: 4 },
      ]),
    ).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(pickDominantCategory([])).toBeNull();
  });
});

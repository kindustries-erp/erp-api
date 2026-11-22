import { escapeLikePattern } from './table-preference-like.helper';

describe('escapeLikePattern', () => {
  it('escapes LIKE wildcards and backslash', () => {
    expect(escapeLikePattern('a%b_c\\d')).toBe('a\\%b\\_c\\\\d');
  });

  it('leaves plain prefixes unchanged', () => {
    expect(escapeLikePattern('procurement-')).toBe('procurement-');
  });
});

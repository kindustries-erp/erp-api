import { KgaraAccountKey } from '../enums/kgara-account.enum';
import { resolveBranchAccount } from './kgara-branch-account.helper';

const CN2 = '0b4d6d3a-55df-492b-abaf-377d84b61d05';

describe('resolveBranchAccount', () => {
  it('uses the explicit account when it is valid, even if rows disagree', () => {
    const rows = [
      { externalId: CN2, accountKey: 'MAIN' },
      { externalId: CN2, accountKey: 'OJ' },
    ];
    expect(resolveBranchAccount(rows, 'oj')).toEqual({
      ok: true,
      accountKey: KgaraAccountKey.OJ,
    });
  });

  it('rejects an explicit account that is not a known Kgara account', () => {
    expect(resolveBranchAccount([], 'XYZ')).toEqual({
      ok: false,
      reason: 'INVALID_ACCOUNT',
    });
  });

  it('uses the single row account when the branch has only one account', () => {
    expect(
      resolveBranchAccount([{ externalId: CN2, accountKey: 'OJ' }]),
    ).toEqual({ ok: true, accountKey: KgaraAccountKey.OJ });
  });

  it('falls back to MAIN when the branch has no row', () => {
    expect(resolveBranchAccount([])).toEqual({
      ok: true,
      accountKey: KgaraAccountKey.MAIN,
    });
  });

  it('refuses to guess when a branch has two accounts and no explicit account', () => {
    const rows = [
      { externalId: CN2, accountKey: 'MAIN' },
      { externalId: CN2, accountKey: 'OJ' },
    ];
    expect(resolveBranchAccount(rows)).toEqual({
      ok: false,
      reason: 'AMBIGUOUS',
    });
  });
});

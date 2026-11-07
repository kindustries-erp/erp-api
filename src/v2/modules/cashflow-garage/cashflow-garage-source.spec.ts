import {
  CASHFLOW_GARAGE_SOURCE_ENV,
  isNewCashflowSource,
} from './cashflow-garage-source';

describe('isNewCashflowSource', () => {
  const original = process.env[CASHFLOW_GARAGE_SOURCE_ENV];

  afterEach(() => {
    if (original === undefined) delete process.env[CASHFLOW_GARAGE_SOURCE_ENV];
    else process.env[CASHFLOW_GARAGE_SOURCE_ENV] = original;
  });

  it('mặc định là legacy khi không đặt biến', () => {
    delete process.env[CASHFLOW_GARAGE_SOURCE_ENV];
    expect(isNewCashflowSource()).toBe(false);
  });

  it('chỉ bật khi đúng giá trị new', () => {
    process.env[CASHFLOW_GARAGE_SOURCE_ENV] = 'new';
    expect(isNewCashflowSource()).toBe(true);
    process.env[CASHFLOW_GARAGE_SOURCE_ENV] = 'NEW';
    expect(isNewCashflowSource()).toBe(false);
    process.env[CASHFLOW_GARAGE_SOURCE_ENV] = 'legacy';
    expect(isNewCashflowSource()).toBe(false);
  });
});

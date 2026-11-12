import {
  SEARCH_COLUMNS,
  SUMMARY_COLUMNS,
  TABLE_COLUMNS,
  toFilterPayload,
} from './loan-table.constants';

describe('loan-table.constants', () => {
  it('khai báo đầy đủ cột camelCase và snake_case khớp với LoansTable', () => {
    expect(TABLE_COLUMNS.loanCode).toEqual({
      sql: 'loan.loanCode',
      type: 'text',
    });
    expect(TABLE_COLUMNS.loan_code).toEqual(TABLE_COLUMNS.loanCode);
    expect(TABLE_COLUMNS.principalAmount).toEqual({
      sql: 'loan.principalAmount',
      type: 'number',
    });
    expect(TABLE_COLUMNS.principal_amount).toEqual(
      TABLE_COLUMNS.principalAmount,
    );
    expect(TABLE_COLUMNS.startDate).toEqual({
      sql: 'loan.startDate',
      type: 'date',
    });
    expect(TABLE_COLUMNS.status).toEqual({
      sql: 'loan.status',
      type: 'status',
    });
  });

  it('khai báo SEARCH_COLUMNS và SUMMARY_COLUMNS đúng cột tài chính', () => {
    expect(SEARCH_COLUMNS).toEqual([
      'loan.loanCode',
      'loan.title',
      'loan.lenderName',
    ]);
    expect(SUMMARY_COLUMNS.map((c) => c.key)).toEqual([
      'principalAmount',
      'totalPaidPrincipal',
      'remainingPrincipal',
      'totalPaidInterest',
    ]);
  });

  it('toFilterPayload chuẩn hóa cả envelope đầy đủ lẫn flat map', () => {
    expect(toFilterPayload(undefined)).toEqual({});
    expect(toFilterPayload('{"status":["ACTIVE"]}')).toEqual({
      columnFilters: { status: ['ACTIVE'] },
    });
    expect(
      toFilterPayload(
        JSON.stringify({
          columnFilters: { status: ['ACTIVE'] },
          columnSearch: { title: 'VCB' },
        }),
      ),
    ).toEqual({
      columnFilters: { status: ['ACTIVE'] },
      columnSearch: { title: 'VCB' },
    });
  });
});

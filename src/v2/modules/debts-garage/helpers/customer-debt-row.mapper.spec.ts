import { toCustomerDebtRow } from '../helpers/customer-debt-row.mapper';

describe('toCustomerDebtRow', () => {
  it('chuẩn hóa chuỗi numeric và biển số trống', () => {
    const row = toCustomerDebtRow({
      bien_so_xe: '',
      khach_hang_code: 'KH1',
      khach_hang_name: 'An',
      branch_external_id: 'b1',
      so_phieu: 3,
      tong_doanh_thu: '1000.50',
      da_thanh_toan: '400',
      con_phai_thu: '600.5',
      ngay_gan_nhat: '2026-10-01',
      ngay_xa_nhat: '2026-08-01',
      max_aging_days: 45,
      aging_0_30: '0',
      aging_31_60: '600.5',
      aging_61_90: null,
      aging_over_90: undefined,
    });

    expect(row.licensePlate).toBe('');
    expect(row).toMatchObject({
      customerCode: 'KH1',
      caseCount: 3,
      totalAmount: 1000.5,
      paidAmount: 400,
      balanceAmount: 600.5,
      maxAgingDays: 45,
      aging31_60: 600.5,
      aging61_90: 0,
      agingOver90: 0,
    });
  });
});

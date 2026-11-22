import { toSupplierDebtRow } from '../helpers/supplier-debt-row.mapper';

describe('toSupplierDebtRow', () => {
  it('chuẩn hóa numeric, biển số giả và giá trị thiếu', () => {
    const row = toSupplierDebtRow({
      license_plate: '',
      customer_code: '',
      customer_name: '',
      branch_external_id: null,
      case_count: 2,
      vehicle_count: 0,
      cost_amount: '1000',
      paid_amount: '250.25',
      balance_amount: '749.75',
      latest_date: null,
      max_aging_days: 12,
      aging_0_30: '749.75',
    });

    expect(row).toMatchObject({
      id: 'UNKNOWN_no_bks',
      licensePlate: '',
      customerCode: 'UNKNOWN',
      customerName: 'Chưa xác định',
      branchExternalId: '',
      vehicleCount: 0,
      costAmount: 1000,
      paidAmount: 250.25,
      balanceAmount: 749.75,
      aging0_30: 749.75,
      aging61_90: 0,
    });
  });

  it('có biển số thì id là biển số và vehicleCount tối thiểu 1', () => {
    const row = toSupplierDebtRow({
      license_plate: '51A12345',
      customer_code: 'NCC1',
      vehicle_count: 0,
    });
    expect(row.id).toBe('51A12345');
    expect(row.vehicleCount).toBe(1);
  });
});

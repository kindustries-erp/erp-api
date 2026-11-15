import { EmployeeManagement } from '../entities/employee-management.entity';
import {
  toEmployeeManagementEntityFields,
  toEmployeeManagementResponse,
} from './employee-management.mapper';

const entity = (over: Partial<EmployeeManagement> = {}): EmployeeManagement =>
  ({
    id: 'e1',
    extraData: {},
    employeeCode: 'NV-001',
    fullName: 'Nguyễn Văn A',
    email: null,
    phone: null,
    status: 'ACTIVE',
    userId: null,
    address: null,
    notes: null,
    birthDate: null,
    startDate: null,
    leaveDate: null,
    jobTitle: null,
    department: null,
    branchId: null,
    nationalId: '001234567890',
    isDeleted: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
    ...over,
  }) as EmployeeManagement;

describe('employee-management.mapper', () => {
  it('response che CCCD, không lộ nationalId/userId, null thành undefined', () => {
    const res = toEmployeeManagementResponse(entity());
    expect(res.nationalIdMasked).toBe('********7890');
    expect(res).not.toHaveProperty('nationalId');
    expect(res).not.toHaveProperty('userId');
    expect(res.email).toBeUndefined();
    expect(res.branch).toBeNull();
    expect(res.linkedUser).toBeNull();
  });

  it('response có extraData là object kể cả khi entity thiếu', () => {
    const res = toEmployeeManagementResponse(
      entity({ extraData: undefined as never }),
    );
    expect(res.extraData).toEqual({});
  });

  it('response kèm chi nhánh và tài khoản liên kết', () => {
    const res = toEmployeeManagementResponse(
      entity({
        branchId: 'b1',
        branch: { id: 'b1', code: 'CN1', name: 'Chi nhánh 1' } as never,
      }),
      { id: 'u1', email: 'a@x.vn' },
    );
    expect(res.branch).toEqual({ id: 'b1', code: 'CN1', name: 'Chi nhánh 1' });
    expect(res.linkedUser).toEqual({ id: 'u1', email: 'a@x.vn' });
  });

  it('entity fields đổi ISO thành Date, bỏ key undefined, không nhận userId', () => {
    const fields = toEmployeeManagementEntityFields({
      fullName: 'B',
      birthDate: '1990-04-30T17:00:00.000Z',
      userId: 'hack',
    } as never);
    expect(fields).toEqual({
      fullName: 'B',
      birthDate: new Date('1990-04-30T17:00:00.000Z'),
    });
  });
});

describe('toEmployeeManagementEntityFields với null', () => {
  it('null xóa giá trị ở cột nullable (ngày, CCCD, chi nhánh) thay vì thành 1970', () => {
    const fields = toEmployeeManagementEntityFields({
      birthDate: null,
      nationalId: null,
      branchId: null,
      email: null,
    });
    expect(fields).toEqual({
      birthDate: null,
      nationalId: null,
      branchId: null,
      email: null,
    });
  });

  it('null ở cột bắt buộc (họ tên, mã, trạng thái) bị bỏ qua', () => {
    const fields = toEmployeeManagementEntityFields({
      fullName: null as never,
      employeeCode: null as never,
      status: null as never,
    });
    expect(fields).toEqual({});
  });
});

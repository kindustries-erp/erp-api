import { toAuthUser, toPreferences, toProfileEmployee } from './auth.mapper';

describe('auth.mapper', () => {
  it('toAuthUser chỉ lấy trường công khai, không có passwordHash', () => {
    const res = toAuthUser({
      id: 'u1',
      email: 'a@x.com',
      status: 'ACTIVE',
      employeeId: null,
      passwordHash: 'SECRET',
    } as never);
    expect(res).toEqual({
      id: 'u1',
      email: 'a@x.com',
      status: 'ACTIVE',
      employeeId: null,
    });
  });

  it('toPreferences chỉ giữ 4 trường', () => {
    expect(
      toPreferences({
        theme: 't',
        language: 'vi',
        tableConfigs: {},
        uiConfigs: {},
        extra: 1,
      } as never),
    ).toEqual({ theme: 't', language: 'vi', tableConfigs: {}, uiConfigs: {} });
  });

  it('toProfileEmployee chuẩn hóa email/phone/userId thiếu thành null', () => {
    const res = toProfileEmployee({
      id: 'e1',
      employeeCode: 'NV1',
      fullName: 'An',
      status: 'ACTIVE',
    } as never);
    expect(res).toMatchObject({ email: null, phone: null, userId: null });
  });
});

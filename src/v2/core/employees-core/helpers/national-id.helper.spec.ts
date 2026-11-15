import { maskNationalId } from './national-id.helper';

describe('maskNationalId', () => {
  it('che CCCD 12 số, giữ 4 số cuối', () => {
    expect(maskNationalId('001234567890')).toBe('********7890');
  });

  it('che CMND 9 số', () => {
    expect(maskNationalId('123456789')).toBe('*****6789');
  });

  it('trả undefined khi rỗng hoặc null', () => {
    expect(maskNationalId(null)).toBeUndefined();
    expect(maskNationalId('')).toBeUndefined();
  });
});

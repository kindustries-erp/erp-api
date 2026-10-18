import { BadRequestException } from '@nestjs/common';
import {
  normalizeCustomValue,
  StrictCustomFieldsHelper,
} from './strict-custom-fields.helper';

const def = (over: Record<string, unknown>) =>
  ({ code: 'c', fieldType: 'TEXT', options: null, ...over }) as any;

describe('normalizeCustomValue', () => {
  it('rỗng/null → null (xóa)', () => {
    expect(normalizeCustomValue(def({}), '')).toBeNull();
    expect(normalizeCustomValue(def({}), null)).toBeNull();
  });
  it('NUMBER hợp lệ / không hợp lệ', () => {
    expect(normalizeCustomValue(def({ fieldType: 'NUMBER' }), '12.5')).toBe(
      '12.5',
    );
    expect(() =>
      normalizeCustomValue(def({ fieldType: 'NUMBER' }), 'abc'),
    ).toThrow(BadRequestException);
  });
  it('DATE không hợp lệ bị chặn', () => {
    expect(() =>
      normalizeCustomValue(def({ fieldType: 'DATE' }), 'xx'),
    ).toThrow(BadRequestException);
  });
  it('CHECKBOX chuẩn hóa true/false', () => {
    expect(normalizeCustomValue(def({ fieldType: 'CHECKBOX' }), true)).toBe(
      'true',
    );
    expect(normalizeCustomValue(def({ fieldType: 'CHECKBOX' }), '0')).toBe(
      'false',
    );
    expect(() =>
      normalizeCustomValue(def({ fieldType: 'CHECKBOX' }), 'maybe'),
    ).toThrow(BadRequestException);
  });
  it('SELECT phải nằm trong options', () => {
    const d = def({
      fieldType: 'SELECT',
      options: [{ value: 'a', label: 'A' }],
    });
    expect(normalizeCustomValue(d, 'a')).toBe('a');
    expect(() => normalizeCustomValue(d, 'b')).toThrow(BadRequestException);
  });
});

describe('StrictCustomFieldsHelper.saveInTx', () => {
  const build = (defs: any[], existing: any[] = []) => {
    const defRepo = { find: jest.fn().mockResolvedValue(defs) };
    const valueRepo = {
      find: jest.fn().mockResolvedValue(existing),
      create: jest.fn((x) => x),
      save: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const manager: any = {
      getRepository: jest.fn((e) =>
        e.name === 'ErpModuleAttributeDef' ? defRepo : valueRepo,
      ),
    };
    return { manager, valueRepo };
  };
  const defs = [
    { id: 'd1', code: 'ghi_chu', fieldType: 'TEXT', options: null },
    { id: 'd2', code: 'so_km', fieldType: 'NUMBER', options: null },
  ];

  it('key lạ → 400, không ghi', async () => {
    const { manager, valueRepo } = build(defs);
    await expect(
      StrictCustomFieldsHelper.saveInTx(manager, 'GARAGE_CASE', 'e1', {
        xyz: '1',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(valueRepo.save).not.toHaveBeenCalled();
  });

  it('bỏ qua key built-in/legacy, upsert custom, giữ def không có trong payload', async () => {
    const { manager, valueRepo } = build(defs, [
      { id: 'v2', attrDefId: 'd2', valueText: '5' },
    ]);
    await StrictCustomFieldsHelper.saveInTx(manager, 'GARAGE_CASE', 'e1', {
      exclude_from_debt: true,
      ghi_chu: 'abc',
      d1: 'abc',
    });
    expect(valueRepo.delete).not.toHaveBeenCalled();
    expect(valueRepo.save).toHaveBeenCalledWith([
      expect.objectContaining({ attrDefId: 'd1', valueText: 'abc' }),
    ]);
  });

  it('giá trị rỗng xóa riêng def đó', async () => {
    const { manager, valueRepo } = build(defs, [
      { id: 'v1', attrDefId: 'd1', valueText: 'x' },
    ]);
    await StrictCustomFieldsHelper.saveInTx(manager, 'GARAGE_CASE', 'e1', {
      ghi_chu: '',
    });
    expect(valueRepo.delete).toHaveBeenCalledWith(['v1']);
  });

  it('hai giá trị khác nhau cho cùng def (id vs code) → 400', async () => {
    const { manager } = build(defs);
    await expect(
      StrictCustomFieldsHelper.saveInTx(manager, 'GARAGE_CASE', 'e1', {
        d1: 'a',
        ghi_chu: 'b',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});

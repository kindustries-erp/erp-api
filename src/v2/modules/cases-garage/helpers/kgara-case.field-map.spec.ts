import { getMetadataArgsStorage } from 'typeorm';
import { KgaraCase } from '@/kgara-api-core/entities/kgara_case.entity';
import { KgaraCaseService } from '@/kgara-api-core/entities/kgara_case_service.entity';
import { CaseGarage } from '../entities/case-garage.entity';
import { CaseServiceGarage } from '../entities/case-service-garage.entity';
import {
  KGARA_CASE_FIELD_MAP,
  KGARA_CASE_IGNORED_COLUMNS,
} from './kgara-case.field-map';
import {
  KGARA_CASE_SERVICE_FIELD_MAP,
  KGARA_CASE_SERVICE_IGNORED_COLUMNS,
} from './kgara-case-service.field-map';

type Ctor = abstract new (...args: never[]) => unknown;

const props = (target: Ctor) =>
  getMetadataArgsStorage()
    .columns.filter((c) => c.target === target)
    .map((c) => c.propertyName);

// Entity v2 kế thừa base-core nên lấy cả cột của lớp cha.
const v2Props = (target: Ctor) => {
  const names = new Set<string>();
  for (let t: any = target; t && t.name; t = Object.getPrototypeOf(t)) {
    props(t).forEach((p) => names.add(p));
  }
  return names;
};

const VN_TOKENS =
  /soChungTu|bienSoXe|khachHang|soKhung|tienCoThue|doanhThu|chiPhi|loiNhuan|hangXe|dongXe|namSanXuat|tinhTrang|ngay[A-Z]|doiTuong|erpNotes|kgaraDeleted/;

describe.each([
  [
    'kgara_cases',
    KgaraCase,
    CaseGarage,
    KGARA_CASE_FIELD_MAP,
    KGARA_CASE_IGNORED_COLUMNS,
  ],
  [
    'kgara_case_services',
    KgaraCaseService,
    CaseServiceGarage,
    KGARA_CASE_SERVICE_FIELD_MAP,
    KGARA_CASE_SERVICE_IGNORED_COLUMNS,
  ],
])('field-map %s', (_name, v1, v2, map, ignored) => {
  it('mọi cột V1 đều được map hoặc khai báo bỏ qua (chống lệch khi V1 thêm cột)', () => {
    const covered = new Set([
      ...map.map((e) => e.from),
      ...ignored.map((i) => i.property),
    ]);
    const missing = props(v1).filter((p) => !covered.has(p));
    expect(missing).toEqual([]);
  });

  it('mọi entry trỏ tới property có thật ở cả V1 lẫn v2', () => {
    const v1Props = new Set(props(v1));
    const v2Set = v2Props(v2);
    for (const e of map) {
      expect(v1Props.has(e.from)).toBe(true);
      expect(v2Set.has(e.to)).toBe(true);
    }
  });

  it('property v2 viết camelCase tiếng Anh, không còn token tiếng Việt', () => {
    for (const e of map) expect(e.to).not.toMatch(VN_TOKENS);
    for (const p of v2Props(v2)) expect(p).not.toMatch(VN_TOKENS);
  });

  it('không có hai entry cùng đích', () => {
    const to = map.map((e) => e.to);
    expect(new Set(to).size).toBe(to.length);
  });

  it('chiều `both` chỉ dành cho nhóm erp-local', () => {
    for (const e of map.filter((x) => x.direction === 'both')) {
      expect(e.group).toBe('erp-local');
    }
  });
});

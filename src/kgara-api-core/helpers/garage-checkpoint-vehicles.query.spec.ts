import { listCheckpointVehicles } from './garage-checkpoint-vehicles.query';

const FILTERS = {
  dateFrom: '2026-11-01',
  effectiveDateTo: '2026-11-30 23:59:59.999',
  isFunnelMode: true,
  status: 'quotation',
};

const row = (
  id: string,
  code: string,
  plate: string | null,
  amount: number,
) => ({
  id,
  soChungTu: code,
  bienSoXe: plate,
  khachHangName: 'Khách A',
  tienCoThue: amount,
  tienDaThanhToan: 0,
  tienConPhaiThanhToan: amount,
  classification: 'OJ_NGOAI',
  ngayPhatSinh: new Date('2026-11-05T00:00:00Z'),
  createdAt: new Date('2026-11-01T00:00:00Z'),
  rawData: {},
});

type Capture = {
  selects: string[];
  wheres: string[];
  params: Array<Record<string, unknown>>;
  groupBys: string[];
  orderBys: Array<[string, string | undefined, string | undefined]>;
  offset?: number;
  limit?: number;
};

describe('listCheckpointVehicles (checkpoint-cases gom theo xe)', () => {
  let captures: Capture[];
  let totalRaw: { total: unknown } | undefined;
  let keyRows: Array<{ vehicle_key: string }>;
  let caseRows: unknown[];
  let repo: any;

  beforeEach(() => {
    captures = [];
    totalRaw = { total: '2' };
    keyRows = [{ vehicle_key: '51B75695' }, { vehicle_key: 'solo' }];
    caseRows = [
      row('c1', 'GN-0025', '51B-756.95', 100),
      row('c2', 'GN-0024', '51B-756.95', 250),
      row('solo', 'GN-0001', null, 40),
    ];
    repo = {
      createQueryBuilder: jest.fn(() => {
        const cap: Capture = {
          selects: [],
          wheres: [],
          params: [],
          groupBys: [],
          orderBys: [],
        };
        captures.push(cap);
        const self: any = {
          leftJoin: () => self,
          leftJoinAndSelect: () => self,
          leftJoinAndMapOne: () => self,
          where: (c: string) => (cap.wheres.push(c), self),
          andWhere: (c: string, p?: Record<string, unknown>) => (
            cap.wheres.push(c),
            p && cap.params.push(p),
            self
          ),
          select: (e: string) => (cap.selects.push(e), self),
          addSelect: (e: string) => (cap.selects.push(e), self),
          groupBy: (e: string) => (cap.groupBys.push(e), self),
          orderBy: (e: string, d?: string, n?: string) => (
            cap.orderBys.push([e, d, n]),
            self
          ),
          addOrderBy: (e: string, d?: string, n?: string) => (
            cap.orderBys.push([e, d, n]),
            self
          ),
          offset: (n: number) => ((cap.offset = n), self),
          limit: (n: number) => ((cap.limit = n), self),
          getRawOne: () => Promise.resolve(totalRaw),
          getRawMany: () => Promise.resolve(keyRows),
          getMany: () => Promise.resolve(caseRows),
        };
        return self;
      }),
    };
  });

  const run = (over: Record<string, unknown> = {}) =>
    listCheckpointVehicles(repo, {
      filters: FILTERS,
      page: 1,
      pageSize: 20,
      sortBy: 'ngayHoanThanhCongViec',
      sortOrder: 'DESC',
      ...over,
    });

  it('total đếm số xe khác nhau (COUNT DISTINCT khóa biển), không đếm lệnh', async () => {
    const res = await run();

    expect(captures[0].selects[0]).toContain('COUNT(DISTINCT');
    expect(captures[0].selects[0]).toContain('bien_so_xe');
    expect(res.total).toBe(2);
  });

  it('phân trang theo xe: offset/limit trên truy vấn nhóm', async () => {
    await run({ page: 3, pageSize: 20 });

    expect(captures[1].groupBys).toHaveLength(1);
    expect(captures[1].offset).toBe(40);
    expect(captures[1].limit).toBe(20);
  });

  it('kẹp pageSize ở 500 và page tối thiểu 1 ở tầng truy vấn', async () => {
    await run({ page: 0, pageSize: 100000 });

    expect(captures[1].limit).toBe(500);
    expect(captures[1].offset).toBe(0);
  });

  it('pageSize 0 kẹp về 1; không hợp lệ (NaN) rơi về mặc định 20', async () => {
    await run({ pageSize: 0 });
    expect(captures[1].limit).toBe(1);

    captures = [];
    await run({ pageSize: Number.NaN });
    expect(captures[1].limit).toBe(20);
  });

  it('sắp theo mốc kỳ mới nhất của xe mặc định, và theo tổng khi sort cột tiền', async () => {
    await run();
    expect(captures[1].selects.join(' ')).toContain('MAX(COALESCE(');

    captures = [];
    await run({ sortBy: 'tienCoThue', sortOrder: 'ASC' });
    expect(captures[1].selects.join(' ')).toContain(
      'SUM(COALESCE(c.tien_co_thue, 0))',
    );
    expect(captures[1].orderBys[0]).toEqual([
      'sort_value',
      'ASC',
      'NULLS LAST',
    ]);
  });

  it('sortBy lạ rơi về mặc định (không nối chuỗi người dùng vào SQL)', async () => {
    await run({ sortBy: 'x; DROP TABLE kgara_cases' });

    expect(captures[1].selects.join(' ')).not.toContain('DROP');
  });

  it('áp cùng bộ lọc ở cả ba truy vấn', async () => {
    await run();

    for (const cap of captures) {
      expect(cap.wheres.join(' AND ')).toContain(
        'COALESCE(c.ngay_hoan_thanh_cong_viec, c.ngay_phat_sinh, c.created_at) >= :dateFrom',
      );
    }
  });

  it('gom lệnh theo xe: hai lệnh cùng biển là một dòng, phiếu không biển là xe riêng', async () => {
    const { items } = await run();

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      vehicleKey: '51B75695',
      caseCount: 2,
      soChungTus: ['GN-0025', 'GN-0024'],
      tienCoThue: 350,
    });
    expect(items[1]).toMatchObject({ vehicleKey: 'solo', caseCount: 1 });
  });

  it('lấy lệnh của đúng các xe trong trang (IN danh sách khóa)', async () => {
    await run();

    expect(captures[2].wheres.join(' AND ')).toContain('IN (:...keys)');
    expect(captures[2].params).toContainEqual({ keys: ['51B75695', 'solo'] });
  });

  it('không có xe nào thì trả rỗng và không truy vấn lệnh', async () => {
    totalRaw = { total: 0 };
    keyRows = [];

    const res = await run();

    expect(res).toEqual({ items: [], total: 0 });
    expect(captures).toHaveLength(2);
  });
});

import { Brackets } from 'typeorm';
import { CaseOrigin, CaseStatus } from '../entities/case-garage.enums';
import {
  CaseWorkshopCandidatesService,
  toWorkshopCandidate,
} from './case-workshop-candidates.service';

function make(rows: unknown[]) {
  const qb: Record<string, jest.Mock> = {};
  for (const k of [
    'addSelect',
    'where',
    'andWhere',
    'orderBy',
    'addOrderBy',
    'limit',
  ]) {
    qb[k] = jest.fn().mockReturnValue(qb);
  }
  qb.getMany = jest.fn().mockResolvedValue(rows);
  const ds = { getRepository: () => ({ createQueryBuilder: () => qb }) };
  return { svc: new CaseWorkshopCandidatesService(ds as never), qb };
}

describe('CaseWorkshopCandidatesService', () => {
  it('lọc chi nhánh, xe còn hoạt động; xe chưa xong lên trước; limit mặc định 20', async () => {
    const { svc, qb } = make([]);
    await svc.search('B1', { search: '51g-123' });
    expect(qb.andWhere).toHaveBeenCalledWith('c.branch_external_id = :branch', {
      branch: 'B1',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('c.external_deleted_at IS NULL');
    expect(qb.orderBy).toHaveBeenCalledWith('finished_rank', 'ASC');
    expect(qb.limit).toHaveBeenCalledWith(20);
  });

  it('thoát % và _ trong từ khóa tìm theo mã/khách', async () => {
    const { svc, qb } = make([]);
    await svc.search('B1', { search: '_1%' });
    const bracket = qb.andWhere.mock.calls
      .map((c) => c[0])
      .find((a) => a instanceof Brackets) as Brackets;
    const w = { where: jest.fn(), orWhere: jest.fn() };
    w.where.mockReturnValue(w);
    w.orWhere.mockReturnValue(w);
    bracket.whereFactory(w as never);
    expect(w.where).toHaveBeenCalledWith('c.case_code ILIKE :s', {
      s: '%\\_1\\%%',
    });
  });

  it('limit theo yêu cầu', async () => {
    const { svc, qb } = make([]);
    await svc.search('B1', { search: 'VV', limit: 5 });
    expect(qb.limit).toHaveBeenCalledWith(5);
  });

  it('map ứng viên: tên xe, cờ đã trên bảng', () => {
    const c = toWorkshopCandidate({
      id: 'c1',
      caseCode: 'VV-1',
      licensePlate: '51G-12345',
      customerName: 'Chị Tư',
      vehicleBrandName: 'Toyota',
      vehicleModelName: 'Vios',
      origin: CaseOrigin.KGARA_SYNC,
      status: CaseStatus.QUOTED,
      receivedAt: new Date('2026-11-24T01:00:00.000Z'),
      workshopTrackedAt: new Date(),
    } as never);
    expect(c).toEqual({
      id: 'c1',
      caseCode: 'VV-1',
      licensePlate: '51G-12345',
      customerName: 'Chị Tư',
      vehicleName: 'Toyota Vios',
      origin: CaseOrigin.KGARA_SYNC,
      status: CaseStatus.QUOTED,
      receivedAt: '2026-11-24T01:00:00.000Z',
      onBoard: true,
    });
    expect(
      toWorkshopCandidate({
        receivedAt: null,
        workshopTrackedAt: null,
      } as never),
    ).toMatchObject({ vehicleName: null, onBoard: false, receivedAt: null });
  });
});

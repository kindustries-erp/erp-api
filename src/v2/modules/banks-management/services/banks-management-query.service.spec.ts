import { BanksManagementQueryService } from './banks-management-query.service';

describe('BanksManagementQueryService', () => {
  let service: BanksManagementQueryService;
  let repo: {
    find: jest.Mock;
    findOne: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  beforeEach(() => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    service = new BanksManagementQueryService(repo as never);
  });

  describe('findActiveCatalog', () => {
    it('returns only active and non-deleted banks sorted', async () => {
      const mockBanks = [
        { id: '1', code: 'ACB', shortName: 'ACB', isActive: true },
        { id: '2', code: 'VCB', shortName: 'Vietcombank', isActive: true },
      ];
      repo.find.mockResolvedValue(mockBanks);

      const result = await service.findActiveCatalog();
      expect(repo.find).toHaveBeenCalledWith({
        where: { isActive: true, isDeleted: false },
        order: { shortName: 'ASC', code: 'ASC' },
      });
      expect(result).toEqual(mockBanks);
    });
  });

  describe('findByBin', () => {
    it('finds bank by bin napas', async () => {
      const mockBank = { id: '1', bin: '970436' };
      repo.findOne.mockResolvedValue(mockBank);

      const result = await service.findByBin('970436');
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { bin: '970436', isDeleted: false },
      });
      expect(result).toEqual(mockBank);
    });
  });

  describe('findByCode', () => {
    it('finds bank by code', async () => {
      const mockBank = { id: '1', code: 'VCB' };
      repo.findOne.mockResolvedValue(mockBank);

      const result = await service.findByCode('VCB');
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { code: 'VCB', isDeleted: false },
      });
      expect(result).toEqual(mockBank);
    });
  });
});

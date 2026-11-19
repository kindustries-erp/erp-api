import { BanksManagementSyncService } from './banks-management-sync.service';

describe('BanksManagementSyncService', () => {
  let service: BanksManagementSyncService;
  let repo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  const originalFetch = global.fetch;

  beforeEach(() => {
    repo = {
      findOne: jest.fn(),
      create: jest.fn((data) => ({ ...data, id: 'mock-id' })),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };
    service = new BanksManagementSyncService(repo as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('successfully fetches from VietQR and inserts new banks', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        code: '00',
        desc: 'success',
        data: [
          {
            code: 'VCB',
            bin: '970436',
            shortName: 'Vietcombank',
            name: 'Ngoại thương',
            logo: 'https://api.vietqr.io/img/VCB.png',
            transferSupported: 1,
            lookupSupported: 1,
          },
        ],
      }),
    });

    repo.findOne.mockResolvedValue(null);

    const result = await service.syncFromVietQr();
    expect(result.totalFetched).toBe(1);
    expect(result.insertedCount).toBe(1);
    expect(result.updatedCount).toBe(0);
    expect(repo.create).toHaveBeenCalled();
    expect(repo.save).toHaveBeenCalled();
  });

  it('updates existing bank if code or bin matches', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        code: '00',
        desc: 'success',
        data: [
          {
            code: 'VCB',
            bin: '970436',
            shortName: 'Vietcombank Updated',
            name: 'Ngoại thương',
            logo: 'https://api.vietqr.io/img/VCB.png',
            transferSupported: 1,
            lookupSupported: 1,
          },
        ],
      }),
    });

    const existingBank = {
      id: 'existing-id',
      code: 'VCB',
      bin: '970436',
      shortName: 'Vietcombank',
    };
    repo.findOne.mockResolvedValue(existingBank);

    const result = await service.syncFromVietQr();
    expect(result.totalFetched).toBe(1);
    expect(result.insertedCount).toBe(0);
    expect(result.updatedCount).toBe(1);
    expect(existingBank.shortName).toBe('Vietcombank Updated');
    expect(repo.save).toHaveBeenCalledWith(existingBank);
  });
});

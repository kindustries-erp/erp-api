import { BanksManagementFacade } from '../banks-management.facade';
import { BanksManagementController } from './banks-management.controller';

describe('BanksManagementController', () => {
  let facade: {
    findActiveCatalog: jest.Mock;
    findAll: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
    syncFromVietQr: jest.Mock;
    findColumnOptions: jest.Mock;
    getLogoBuffer: jest.Mock;
  };
  let controller: BanksManagementController;

  beforeEach(() => {
    facade = {
      findActiveCatalog: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      syncFromVietQr: jest.fn(),
      findColumnOptions: jest.fn(),
      getLogoBuffer: jest.fn(),
    };
    controller = new BanksManagementController(
      facade as unknown as BanksManagementFacade,
    );
  });

  it('delegates getBankLogo to facade.getLogoBuffer and sets CORS/cache headers', async () => {
    const mockBuffer = Buffer.from('png-data');
    facade.getLogoBuffer.mockResolvedValue({
      buffer: mockBuffer,
      contentType: 'image/png',
    });

    const mockRes = {
      setHeader: jest.fn(),
      send: jest.fn(),
    };

    await controller.getBankLogo('ABB', mockRes as any);
    expect(facade.getLogoBuffer).toHaveBeenCalledWith('ABB');
    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'public, max-age=604800, immutable',
    );
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Origin',
      '*',
    );
    expect(mockRes.send).toHaveBeenCalledWith(mockBuffer);
  });

  it('delegates columnOptions to facade.findColumnOptions', async () => {
    const query = { column: 'code' };
    await controller.columnOptions(query);
    expect(facade.findColumnOptions).toHaveBeenCalledWith(query);
  });

  it('delegates syncVietQr to facade.syncFromVietQr', async () => {
    facade.syncFromVietQr.mockResolvedValue({ totalFetched: 10 });
    const result = await controller.syncVietQr();
    expect(facade.syncFromVietQr).toHaveBeenCalled();
    expect(result).toEqual({ totalFetched: 10 });
  });

  it('delegates findAll, findOne, create, update, remove', async () => {
    const query = { page: 1 };
    await controller.findAll(query);
    expect(facade.findAll).toHaveBeenCalledWith(query);

    await controller.findOne('uuid-1');
    expect(facade.findById).toHaveBeenCalledWith('uuid-1');

    const createDto = {
      code: 'VCB',
      shortName: 'VCB',
      name: 'VCB',
      bin: '123',
    };
    await controller.create(createDto);
    expect(facade.create).toHaveBeenCalledWith(createDto);

    const updateDto = { shortName: 'VCB New' };
    await controller.update('uuid-1', updateDto);
    expect(facade.update).toHaveBeenCalledWith('uuid-1', updateDto);

    await controller.remove('uuid-1');
    expect(facade.remove).toHaveBeenCalledWith('uuid-1');
  });
});

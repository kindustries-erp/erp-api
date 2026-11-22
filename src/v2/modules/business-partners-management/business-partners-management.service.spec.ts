import { BusinessPartnersManagementService } from './business-partners-management.service';
import { BusinessPartnersCoreService } from '@/v2/core/business-partners-core';

describe('BusinessPartnersManagementService (Facade)', () => {
  let service: BusinessPartnersManagementService;
  let core: Partial<BusinessPartnersCoreService>;

  beforeEach(() => {
    core = {
      findAll: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      findOne: jest.fn().mockResolvedValue({ message: 'OK', data: {} }),
      create: jest.fn().mockResolvedValue({ message: 'OK', data: {} }),
      update: jest.fn().mockResolvedValue({ message: 'OK', data: {} }),
      remove: jest.fn().mockResolvedValue({ message: 'OK', data: {} }),
      getNextCode: jest.fn().mockResolvedValue({ nextCode: 'NCC-001' }),
      findColumnOptions: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      listOptions: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      syncFromInvoices: jest.fn().mockResolvedValue({ created: 0, items: [] }),
      ensurePartnerForInvoiceKey: jest.fn().mockResolvedValue('partner-uuid'),
    };
    service = new BusinessPartnersManagementService(
      core as BusinessPartnersCoreService,
    );
  });

  it('delegates findAll to core service', async () => {
    const query = { page: 1, pageSize: 20 };
    await service.findAll(query);
    expect(core.findAll).toHaveBeenCalledWith(query);
  });

  it('delegates findOne to core service', async () => {
    await service.findOne('id-1');
    expect(core.findOne).toHaveBeenCalledWith('id-1');
  });

  it('delegates create to core service', async () => {
    const dto = { name: 'Partner A', partnerType: 'CUSTOMER' } as any;
    await service.create(dto);
    expect(core.create).toHaveBeenCalledWith(dto);
  });

  it('delegates update to core service', async () => {
    const dto = { name: 'Partner B' };
    await service.update('id-1', dto as any);
    expect(core.update).toHaveBeenCalledWith('id-1', dto);
  });

  it('delegates remove to core service', async () => {
    await service.remove('id-1');
    expect(core.remove).toHaveBeenCalledWith('id-1');
  });

  it('delegates getNextCode to core service', async () => {
    await service.getNextCode('VENDOR');
    expect(core.getNextCode).toHaveBeenCalledWith('VENDOR');
  });

  it('delegates findColumnOptions to core service', async () => {
    await service.findColumnOptions('code', 'test', 1, 20);
    expect(core.findColumnOptions).toHaveBeenCalledWith(
      'code',
      'test',
      1,
      20,
      undefined,
      undefined,
    );
  });

  it('delegates listOptions to core service', async () => {
    const dto = { direction: 'IN' as const };
    await service.listOptions(dto);
    expect(core.listOptions).toHaveBeenCalledWith(dto);
  });

  it('delegates syncFromInvoices to core service', async () => {
    await service.syncFromInvoices(true);
    expect(core.syncFromInvoices).toHaveBeenCalledWith(true);
  });

  it('delegates ensurePartnerForInvoiceKey to core service', async () => {
    const ref = {
      taxCode: '0123456789',
      name: 'ABC',
      partnerType: 'VENDOR' as const,
    };
    await service.ensurePartnerForInvoiceKey(ref);
    expect(core.ensurePartnerForInvoiceKey).toHaveBeenCalledWith(ref);
  });
});

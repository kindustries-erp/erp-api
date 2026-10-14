import { BadRequestException } from '@nestjs/common';
import { ModuleEntityValueService } from './module-entity-value.service';

describe('ModuleEntityValueService.saveEntityValues', () => {
  const build = () => {
    const dataSource: any = { transaction: jest.fn() };
    const service = new ModuleEntityValueService(
      {} as any,
      {} as any,
      {} as any,
      dataSource,
    );
    return { service, dataSource };
  };

  it('từ chối GARAGE_CASE (module có registry), không mở transaction', async () => {
    const { service, dataSource } = build();
    await expect(
      service.saveEntityValues('garage_case', 'id-1', {} as any),
    ).rejects.toThrow(BadRequestException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('module khác vẫn đi vào transaction như cũ', async () => {
    const { service, dataSource } = build();
    dataSource.transaction.mockResolvedValue({ ok: true });
    await service.saveEntityValues('BOM', 'id-1', {} as any);
    expect(dataSource.transaction).toHaveBeenCalled();
  });
});

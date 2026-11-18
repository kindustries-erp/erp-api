import { Global, Module } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, getMetadataArgsStorage } from 'typeorm';
import { BranchesManagementModule } from './branches-management.module';
import { BranchesManagementService } from './branches-management.service';
import { ErpBranchController } from './controllers/erp-branch.controller';
import { BranchManagement } from './entities/branch-management.entity';
import { BranchManagementExternalLink } from './entities/branch-management-external-link.entity';

/** DataSource do TypeOrmCoreModule (global) cung cấp ở app thật; test dựng bản giả toàn cục. */
function dataSourceStub(query: jest.Mock) {
  @Global()
  @Module({
    providers: [{ provide: DataSource, useValue: { query } }],
    exports: [DataSource],
  })
  class DataSourceStubModule {}
  return DataSourceStubModule;
}

describe('branches v2 DI and entity identity', () => {
  it('khai báo đúng một bảng cho mỗi entity của module', () => {
    const tables = getMetadataArgsStorage().tables;
    expect(
      tables.filter(
        (t) =>
          t.target === BranchManagement &&
          (t.name as string) === 'branches_management',
      ),
    ).toHaveLength(1);
    expect(
      tables.filter(
        (t) =>
          t.target === BranchManagementExternalLink &&
          (t.name as string) === 'branches_management_external_links',
      ),
    ).toHaveLength(1);
    expect(
      Reflect.getMetadata(
        MODULE_METADATA.CONTROLLERS,
        BranchesManagementModule,
      ),
    ).toEqual([ErpBranchController]);
  });

  it('resolve facade HTTP qua service của module và repository mock', async () => {
    const repository = {
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    const moduleRef = await Test.createTestingModule({
      imports: [dataSourceStub(jest.fn()), BranchesManagementModule],
    })
      .overrideProvider(getRepositoryToken(BranchManagement))
      .useValue(repository)
      .overrideProvider(getRepositoryToken(BranchManagementExternalLink))
      .useValue({})
      .compile();

    const facade = moduleRef.get(BranchesManagementService);
    expect(await facade.findAll({})).toEqual({
      items: [],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 1,
        next: null,
        previous: null,
      },
    });
    await moduleRef.close();
  });
});

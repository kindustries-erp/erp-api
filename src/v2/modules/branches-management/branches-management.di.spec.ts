import { MODULE_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getMetadataArgsStorage } from 'typeorm';
import {
  ErpBranch as CoreBranch,
  BranchesCoreModule,
  BranchesCoreService,
} from '@/v2/core/branches-core';
import { BranchesManagementModule } from './branches-management.module';
import { BranchesManagementService } from './branches-management.service';
import { ErpBranchController } from './controllers/erp-branch.controller';

describe('branches v2 DI and entity identity', () => {
  it('uses one canonical entity class and declares one table', () => {
    expect(
      getMetadataArgsStorage().tables.filter(
        (table) =>
          table.target === CoreBranch &&
          (table.name as string) === 'erp_branches',
      ),
    ).toHaveLength(1);
    expect(
      Reflect.getMetadata(
        MODULE_METADATA.CONTROLLERS,
        BranchesManagementModule,
      ),
    ).toEqual([ErpBranchController]);
    expect(
      Reflect.getMetadata(MODULE_METADATA.IMPORTS, BranchesManagementModule),
    ).toContain(BranchesCoreModule);
  });

  it('resolves the HTTP facade through core service and repository mock', async () => {
    const repository = {
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    const moduleRef = await Test.createTestingModule({
      imports: [BranchesManagementModule],
    })
      .overrideProvider(getRepositoryToken(CoreBranch))
      .useValue(repository)
      .compile();

    const facade = moduleRef.get(BranchesManagementService);
    expect(moduleRef.get(BranchesCoreService)).toBeInstanceOf(
      BranchesCoreService,
    );
    expect(await facade.findAll({})).toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    });
    await moduleRef.close();
  });
});

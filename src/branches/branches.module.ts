import { Module } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { BranchesController } from './branches.controller';
import { DirectusModule } from '../directus/directus.module';

@Module({
  imports: [DirectusModule],
  controllers: [BranchesController],
  providers: [BranchesService],
  exports: [BranchesService]
})
export class BranchesModule {}

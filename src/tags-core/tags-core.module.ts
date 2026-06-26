import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TagsCoreService } from './tags-core.service';
import { TagsCoreController } from './tags-core.controller';
import { SysTag } from './entities/sys_tag.entity';
import { SysEntityTag } from './entities/sys_entity_tag.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SysTag, SysEntityTag])],
  controllers: [TagsCoreController],
  providers: [TagsCoreService],
  exports: [TagsCoreService],
})
export class TagsCoreModule {}

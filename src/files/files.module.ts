import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { R2Module } from '../r2/r2.module';
import { SysFile } from './entities/sys-file.entity';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SysFile]), R2Module],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}

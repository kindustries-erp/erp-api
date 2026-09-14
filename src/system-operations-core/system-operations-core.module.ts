import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpSystemOperation } from './entities/erp_system_operation.entity';
import { SystemOperationsCoreService } from './system-operations-core.service';
import { SystemOperationsCoreController } from './system-operations-core.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ErpSystemOperation])],
  controllers: [SystemOperationsCoreController],
  providers: [SystemOperationsCoreService],
  exports: [SystemOperationsCoreService, TypeOrmModule],
})
export class SystemOperationsCoreModule {}

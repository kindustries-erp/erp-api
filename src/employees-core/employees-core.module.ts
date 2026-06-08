import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpEmployee } from './entities/erp_employee.entity';
import { EmployeesCoreController } from './employees-core.controller';
import { EmployeesCoreService } from './employees-core.service';

@Module({
  imports: [TypeOrmModule.forFeature([ErpEmployee])],
  controllers: [EmployeesCoreController],
  providers: [EmployeesCoreService],
  exports: [EmployeesCoreService],
})
export class EmployeesCoreModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpEmployee } from '../employees-core/entities/erp_employee.entity';
import { CoreUser } from './entities/core-user.entity';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([CoreUser, ErpEmployee])],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

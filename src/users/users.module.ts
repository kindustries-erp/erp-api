import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoreUser } from './entities/core-user.entity';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([CoreUser])],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

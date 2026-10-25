import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoreUserPreference } from '../users/entities/core-user-preference.entity';
import { CoreUserTablePreference } from '../users/entities/core-user-table-preference.entity';
import { AppConfigService } from './app-config.service';
import { AppConfigController } from './app-config.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([CoreUserPreference, CoreUserTablePreference]),
  ],
  controllers: [AppConfigController],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}

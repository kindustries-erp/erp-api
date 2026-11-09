import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoreUserTablePreference } from '@/users/entities/core-user-table-preference.entity';
import { TablePreferenceController } from './controllers/table-preference.controller';
import { TablePreferencesService } from './table-preferences.service';
import { TablePreferenceCommandService } from './services/table-preference-command.service';
import { TablePreferenceQueryService } from './services/table-preference-query.service';

@Module({
  imports: [TypeOrmModule.forFeature([CoreUserTablePreference])],
  controllers: [TablePreferenceController],
  providers: [
    TablePreferencesService,
    TablePreferenceQueryService,
    TablePreferenceCommandService,
  ],
  exports: [TablePreferencesService],
})
export class TablePreferencesModule {}

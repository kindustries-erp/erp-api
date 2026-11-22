import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TablePreferenceController } from './controllers/table-preference.controller';
import { CoreUserTablePreference } from './entities/core-user-table-preference.entity';
import { TablePreferenceCommandService } from './services/table-preference-command.service';
import { TablePreferenceQueryService } from './services/table-preference-query.service';
import { TablePreferencesService } from './table-preferences.service';

@Module({
  imports: [TypeOrmModule.forFeature([CoreUserTablePreference])],
  controllers: [TablePreferenceController],
  providers: [
    TablePreferenceQueryService,
    TablePreferenceCommandService,
    TablePreferencesService,
  ],
  exports: [TypeOrmModule, TablePreferencesService],
})
export class TablePreferencesModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoreUserTablePreference } from './entities/core-user-table-preference.entity';
import { TablePreferenceCommandService } from './services/table-preference-command.service';
import { TablePreferenceQueryService } from './services/table-preference-query.service';
import { TablePreferencesCoreService } from './services/table-preferences-core.service';

@Module({
  imports: [TypeOrmModule.forFeature([CoreUserTablePreference])],
  providers: [
    TablePreferenceQueryService,
    TablePreferenceCommandService,
    TablePreferencesCoreService,
  ],
  exports: [TablePreferencesCoreService],
})
export class TablePreferencesCoreModule {}

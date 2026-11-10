import { Module } from '@nestjs/common';
import { TablePreferencesCoreModule } from '@/v2/core/table-preferences-core';
import { TablePreferenceController } from './controllers/table-preference.controller';
import { TablePreferencesService } from './table-preferences.service';

@Module({
  imports: [TablePreferencesCoreModule],
  controllers: [TablePreferenceController],
  providers: [TablePreferencesService],
  exports: [TablePreferencesService],
})
export class TablePreferencesModule {}

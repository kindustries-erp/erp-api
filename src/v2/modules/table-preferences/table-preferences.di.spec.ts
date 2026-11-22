import { MODULE_METADATA } from '@nestjs/common/constants';
import { TablePreferencesModule } from './table-preferences.module';
import { TablePreferenceController } from './controllers/table-preference.controller';
import { TablePreferenceCommandService } from './services/table-preference-command.service';
import { TablePreferenceQueryService } from './services/table-preference-query.service';
import { TablePreferencesService } from './table-preferences.service';

describe('table-preferences v2 module wiring', () => {
  it('declares the HTTP controller and its own query/command providers', () => {
    expect(
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, TablePreferencesModule),
    ).toEqual([TablePreferenceController]);
    expect(
      Reflect.getMetadata(MODULE_METADATA.PROVIDERS, TablePreferencesModule),
    ).toEqual([
      TablePreferenceQueryService,
      TablePreferenceCommandService,
      TablePreferencesService,
    ]);
  });
});

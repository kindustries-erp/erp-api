import { MODULE_METADATA } from '@nestjs/common/constants';
import { TablePreferencesCoreModule } from '@/v2/core/table-preferences-core';
import { TablePreferencesModule } from './table-preferences.module';
import { TablePreferenceController } from './controllers/table-preference.controller';

describe('table-preferences v2 module wiring', () => {
  it('imports the core module and declares only the HTTP controller', () => {
    expect(
      Reflect.getMetadata(MODULE_METADATA.IMPORTS, TablePreferencesModule),
    ).toContain(TablePreferencesCoreModule);
    expect(
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, TablePreferencesModule),
    ).toEqual([TablePreferenceController]);
  });
});

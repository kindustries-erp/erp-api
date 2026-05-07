import { Module } from '@nestjs/common';
import { BusinessPartnerRolesController } from './business-partner-roles.controller';
import { BusinessPartnerRolesService } from './business-partner-roles.service';

@Module({
  controllers: [BusinessPartnerRolesController],
  providers: [BusinessPartnerRolesService],
})
export class BusinessPartnerRolesModule {}

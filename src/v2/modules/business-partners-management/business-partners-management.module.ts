import { Module } from '@nestjs/common';
import { BusinessPartnersCoreModule } from '@/v2/core/business-partners-core';
import { ErpBusinessPartnerController } from './controllers/erp-business-partner.controller';
import { BusinessPartnersManagementService } from './business-partners-management.service';

/**
 * Module HTTP presentation cho Business Partners.
 * Đăng ký Controller REST và Facade Service, import BusinessPartnersCoreModule.
 */
@Module({
  imports: [BusinessPartnersCoreModule],
  controllers: [ErpBusinessPartnerController],
  providers: [BusinessPartnersManagementService],
  exports: [BusinessPartnersManagementService, BusinessPartnersCoreModule],
})
export class BusinessPartnersManagementModule {}

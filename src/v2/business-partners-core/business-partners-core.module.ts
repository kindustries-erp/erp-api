import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpBusinessPartner } from './entities/erp_business_partner.entity';
import { ErpBusinessPartnerController } from './controllers/erp-business-partner.controller';
import { BusinessPartnersCoreService } from './business-partners-core.service';
import { ErpBusinessPartnerCommandService } from './services/erp-business-partner-command.service';
import { ErpBusinessPartnerQueryService } from './services/erp-business-partner-query.service';

@Module({
  imports: [TypeOrmModule.forFeature([ErpBusinessPartner])],
  controllers: [ErpBusinessPartnerController],
  providers: [
    BusinessPartnersCoreService,
    ErpBusinessPartnerQueryService,
    ErpBusinessPartnerCommandService,
  ],
  exports: [BusinessPartnersCoreService],
})
export class BusinessPartnersCoreModule {}

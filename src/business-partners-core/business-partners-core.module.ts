import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpBusinessPartner } from './entities/erp_business_partner.entity';
import { BusinessPartnersCoreController } from './business-partners-core.controller';
import { BusinessPartnersCoreService } from './business-partners-core.service';

@Module({
  imports: [TypeOrmModule.forFeature([ErpBusinessPartner])],
  controllers: [BusinessPartnersCoreController],
  providers: [BusinessPartnersCoreService],
  exports: [BusinessPartnersCoreService],
})
export class BusinessPartnersCoreModule {}

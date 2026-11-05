import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpBusinessPartner } from './entities/erp_business_partner.entity';
import { BusinessPartnersCoreService } from './services/business-partners-core.service';
import { ErpBusinessPartnerCommandService } from './services/erp-business-partner-command.service';
import { ErpBusinessPartnerQueryService } from './services/erp-business-partner-query.service';
import { ErpBusinessPartnerInvoiceSyncService } from './services/erp-business-partner-invoice-sync.service';
import { ErpBusinessPartnerOptionsService } from './services/erp-business-partner-options.service';

/**
 * Module lõi của họ Business Partners V2.
 * Cung cấp TypeORM repository và các service nền tảng (Query, Command, Sync, Options, Core Facade)
 * cho toàn bộ hệ thống ERP (sales-orders, purchase-orders, bank-transactions, v.v.).
 * Không chứa REST Controller; HTTP presentation layer nằm ở module `business-partners-management`.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ErpBusinessPartner])],
  providers: [
    BusinessPartnersCoreService,
    ErpBusinessPartnerQueryService,
    ErpBusinessPartnerCommandService,
    ErpBusinessPartnerInvoiceSyncService,
    ErpBusinessPartnerOptionsService,
  ],
  exports: [
    TypeOrmModule,
    BusinessPartnersCoreService,
    ErpBusinessPartnerQueryService,
    ErpBusinessPartnerCommandService,
    ErpBusinessPartnerInvoiceSyncService,
    ErpBusinessPartnerOptionsService,
  ],
})
export class BusinessPartnersCoreModule {}

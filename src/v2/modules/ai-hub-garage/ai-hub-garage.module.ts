import { Module } from '@nestjs/common';
import { AiHubGatewayModule } from '@/v2/modules/ai-hub-gateway/ai-hub-gateway.module';
import { ItemsGarageModule } from '@/v2/modules/items-garage/items-garage.module';
import { GarageProcurementRequestsModule } from '@/v2/modules/procurement-requests-garage/procurement-requests-garage.module';
import { AiHubGarageController } from './controllers/ai-hub-garage.controller';
import { AiHubGarageService } from './ai-hub-garage.service';
import { GarageInvoiceExtractService } from './services/garage-invoice-extract.service';
import { GaragePrFromInvoiceService } from './services/garage-pr-from-invoice.service';

/** Trợ lý AI của garage: đọc hóa đơn, đối chiếu mã hàng và tạo đề nghị mua nháp. */
@Module({
  imports: [
    AiHubGatewayModule,
    ItemsGarageModule,
    GarageProcurementRequestsModule,
  ],
  controllers: [AiHubGarageController],
  providers: [
    AiHubGarageService,
    GarageInvoiceExtractService,
    GaragePrFromInvoiceService,
  ],
})
export class AiHubGarageModule {}

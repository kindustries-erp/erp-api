import { Module } from '@nestjs/common';
import { BusinessPartnersController } from './business-partners.controller';
import { BusinessPartnersService } from './business-partners.service';

@Module({
  controllers: [BusinessPartnersController],
  providers: [BusinessPartnersService],
})
export class BusinessPartnersModule {}

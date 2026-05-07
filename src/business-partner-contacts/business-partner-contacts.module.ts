import { Module } from '@nestjs/common';
import { BusinessPartnerContactsController } from './business-partner-contacts.controller';
import { BusinessPartnerContactsService } from './business-partner-contacts.service';

@Module({
  controllers: [BusinessPartnerContactsController],
  providers: [BusinessPartnerContactsService],
})
export class BusinessPartnerContactsModule {}

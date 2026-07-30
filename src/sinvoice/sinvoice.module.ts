import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SinvoiceController } from './sinvoice.controller';
import { SinvoiceService } from './sinvoice.service';
import { SinvoiceConfig } from './entities/sinvoice-config.entity';
import { SinvoiceDraft } from './entities/sinvoice-draft.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SinvoiceConfig, SinvoiceDraft])],
  controllers: [SinvoiceController],
  providers: [SinvoiceService],
  exports: [SinvoiceService],
})
export class SinvoiceModule {}

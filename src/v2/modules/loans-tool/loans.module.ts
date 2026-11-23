import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoanEntity, LoanPaymentEntity } from './entities';
import { LoansController } from './controllers/loans.controller';
import { LoansPublicController } from './controllers/loans-public.controller';
import { LoansService } from './loans.service';
import { LoanQueryService } from './services/loan-query.service';
import { LoanCommandService } from './services/loan-command.service';

@Module({
  imports: [TypeOrmModule.forFeature([LoanEntity, LoanPaymentEntity])],
  controllers: [LoansController, LoansPublicController],
  providers: [LoansService, LoanQueryService, LoanCommandService],
  exports: [LoansService, LoanQueryService, LoanCommandService],
})
export class LoansModule {}

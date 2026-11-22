import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BankManagement } from './entities/bank-management.entity';
import { BanksManagementQueryService } from './services/banks-management-query.service';
import { BanksManagementCommandService } from './services/banks-management-command.service';
import { BanksManagementSyncService } from './services/banks-management-sync.service';
import { BanksManagementLogoService } from './services/banks-management-logo.service';
import { BanksManagementFacade } from './banks-management.facade';
import { BanksManagementController } from './controllers/banks-management.controller';

@Module({
  imports: [TypeOrmModule.forFeature([BankManagement])],
  controllers: [BanksManagementController],
  providers: [
    BanksManagementQueryService,
    BanksManagementCommandService,
    BanksManagementSyncService,
    BanksManagementLogoService,
    BanksManagementFacade,
  ],
  exports: [
    BanksManagementFacade,
    BanksManagementQueryService,
    BanksManagementLogoService,
  ],
})
export class BanksManagementModule {}

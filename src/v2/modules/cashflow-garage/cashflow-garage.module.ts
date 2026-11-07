import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalEventService } from '@/v2/core/approval-core/approval-event.service';
import { ApprovalEvent } from '@/v2/core/approval-core/entities/approval-event.entity';
import { ApprovalSetting } from '@/v2/core/approval-core/entities/approval-setting.entity';
import { ApprovalSettingsService } from '@/v2/core/approval-core/approval-settings.service';
import { ApproverDirectoryService } from '@/v2/core/approval-core/approver-directory.service';
import { createApprovalConfigController } from '@/v2/core/approval-core/approval-config.controller';
import {
  CASHFLOW_APPROVAL_DOC_TYPE,
  CASHFLOW_FORECAST_HOOKS,
  CashflowAllocation,
  CashflowForecast,
  CashflowForecastLine,
  defaultForecastApprovalEnabled,
} from '@/v2/core/cashflow-core';
import { CoreUser } from '@/users/entities/core-user.entity';
import { KgaraCase } from '@/kgara-api-core/entities/kgara_case.entity';
import { ErpResource, RbacCoreModule } from '@/v2/core/rbac-core';
import { CashflowGarageForecastExt } from './entities/cashflow-garage-forecast-ext.entity';
import { CashflowGarageController } from './controllers/garage-forecast.controller';
import { CashflowGarageService } from './cashflow-garage.service';
import { GarageForecastCommandService } from './services/garage-forecast-command.service';
import { GarageForecastQueryService } from './services/garage-forecast-query.service';
import { GarageForecastLinesHook } from './hooks/garage-forecast-lines.hook';
import { LegacyVoucherListService } from './compat/legacy-voucher-list.service';
import { LegacyVoucherDashboardService } from './compat/legacy-voucher-dashboard.service';
import { LegacyVoucherOptionsService } from './compat/legacy-voucher-options.service';
import { LegacyVoucherDuplicateService } from './compat/legacy-voucher-duplicate.service';
import { LegacyVoucherWriteService } from './compat/legacy-voucher-write.service';
import { LegacyVoucherPeriodService } from './compat/legacy-voucher-period.service';
import { LegacyVoucherExportService } from './compat/legacy-voucher-export.service';
import { GarageCashflowExcelBuilder } from '../../../kgara-api-core/services/garage-cashflow-excel.builder';
import { GarageCaseReceivableSyncService } from './services/garage-case-receivable-sync.service';
import { GarageCommissionForecastSyncService } from './services/garage-commission-forecast-sync.service';

/** Cấu hình duyệt dự chi và dự thu Garage (bật/tắt theo doc_type). */
const GarageForecastOutApprovalConfigController =
  createApprovalConfigController({
    path: 'api/v2/approval-config/cashflow-forecast-out',
    docType: CASHFLOW_APPROVAL_DOC_TYPE.FORECAST_OUT,
    resource: ErpResource.GARAGE_CASHFLOW,
    tag: 'cashflow_garage',
    defaultEnabled: defaultForecastApprovalEnabled(
      CASHFLOW_APPROVAL_DOC_TYPE.FORECAST_OUT,
    ),
  });

const GarageForecastInApprovalConfigController = createApprovalConfigController(
  {
    path: 'api/v2/approval-config/cashflow-forecast-in',
    docType: CASHFLOW_APPROVAL_DOC_TYPE.FORECAST_IN,
    resource: ErpResource.GARAGE_CASHFLOW,
    tag: 'cashflow_garage',
    defaultEnabled: defaultForecastApprovalEnabled(
      CASHFLOW_APPROVAL_DOC_TYPE.FORECAST_IN,
    ),
  },
);

/**
 * Module dự thu/dự chi Garage trên lõi cashflow-core. Route `/api/v2/cashflow-garage/forecasts`.
 * Route cũ (`/api/v1/greenway/cashflow-vouchers`) vẫn chạy song song cho tới P3.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      CashflowForecast,
      CashflowForecastLine,
      CashflowAllocation,
      CashflowGarageForecastExt,
      ApprovalEvent,
      ApprovalSetting,
      CoreUser,
      KgaraCase,
    ]),
    RbacCoreModule,
  ],
  controllers: [
    CashflowGarageController,
    GarageForecastOutApprovalConfigController,
    GarageForecastInApprovalConfigController,
  ],
  providers: [
    ApprovalEventService,
    ApprovalSettingsService,
    ApproverDirectoryService,
    GarageForecastLinesHook,
    {
      provide: CASHFLOW_FORECAST_HOOKS,
      useFactory: (lines: GarageForecastLinesHook) => [lines],
      inject: [GarageForecastLinesHook],
    },
    GarageForecastCommandService,
    GarageForecastQueryService,
    CashflowGarageService,
    LegacyVoucherListService,
    LegacyVoucherDashboardService,
    LegacyVoucherOptionsService,
    LegacyVoucherDuplicateService,
    LegacyVoucherWriteService,
    LegacyVoucherPeriodService,
    LegacyVoucherExportService,
    GarageCashflowExcelBuilder,
    GarageCaseReceivableSyncService,
    GarageCommissionForecastSyncService,
  ],
  exports: [
    LegacyVoucherPeriodService,
    LegacyVoucherExportService,
    CashflowGarageService,
    LegacyVoucherListService,
    LegacyVoucherDashboardService,
    LegacyVoucherOptionsService,
    LegacyVoucherDuplicateService,
    LegacyVoucherWriteService,
    GarageCaseReceivableSyncService,
    GarageCommissionForecastSyncService,
  ],
})
export class CashflowGarageModule {}

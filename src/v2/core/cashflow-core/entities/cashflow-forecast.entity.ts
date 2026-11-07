import { Entity } from 'typeorm';
import { BaseCashflowForecastEntity } from './base-cashflow-forecast.entity';

/** Dự thu / dự chi. Bảng `cashflow_forecasts` (migration 20261107120000). */
@Entity('cashflow_forecasts')
export class CashflowForecast extends BaseCashflowForecastEntity {}

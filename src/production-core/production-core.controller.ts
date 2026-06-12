import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { ExecuteProductionDto } from './dto/execute-production.dto';
import { ProductionCoreService } from './production-core.service';

@ApiTags('erp_production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('production')
export class ProductionCoreController {
  constructor(private readonly service: ProductionCoreService) {}

  @RequirePermissions({ resource: 'production', action: 'read' })
  @Get('orders')
  findOrders(@Query() query: PaginationDto) {
    return this.service.findOrders(query);
  }

  @RequirePermissions({ resource: 'production', action: 'create' })
  @Post('execute')
  execute(@Body() dto: ExecuteProductionDto) {
    return this.service.execute(dto);
  }
}

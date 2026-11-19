import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CoreRbacGuard } from '@/auth/guards/core-rbac.guard';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { ErpAction, ErpResource } from '@/v2/core/rbac-core';
import { BranchId } from '@/kgara-api-core/decorators/branch-id.decorator';
import { CasesGarageService } from '../cases-garage.service';
import {
  CaseServiceLineDto,
  UpdateServicePartsCostDto,
} from '../dto/case-service-line.dto';
import {
  CreateCaseDto,
  UpdateCaseDto,
  UpdateCaseStatusDto,
} from '../dto/case-write.dto';

const perm = (action: ErpAction) => ({ resource: ErpResource.GARAGE, action });

interface RequestWithUser {
  user?: { sub?: string };
}

/** Chi nhánh KGara bắt buộc từ header; mọi lệnh ghi cách ly theo chi nhánh. */
function requireBranch(branchId: string | undefined): string {
  if (!branchId) throw new BadRequestException('Thiếu chi nhánh.');
  return branchId;
}

/**
 * Lệnh ghi vụ việc v2. Khai báo TRƯỚC `CasesGarageController` trong module để route tĩnh
 * (`next-code`) không bị `GET :id` nuốt. Response: `{ message, data }`.
 */
@ApiTags('cases-garage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('api/v2/cases-garage')
export class CasesGarageCommandsController {
  constructor(private readonly service: CasesGarageService) {}

  @RequirePermissions(perm(ErpAction.READ))
  @ApiOperation({ summary: 'Xem trước mã vụ việc kế tiếp (xe nhập tay)' })
  @Get('next-code')
  nextCode() {
    return this.service.nextCode();
  }

  @RequirePermissions(perm(ErpAction.CREATE))
  @ApiOperation({ summary: 'Tạo vụ việc nhập tay (origin NATIVE)' })
  @Post()
  create(
    @Body() dto: CreateCaseDto,
    @BranchId() branch: string,
    @Req() req: RequestWithUser,
  ) {
    return this.service.create(requireBranch(branch), dto, req.user?.sub ?? '');
  }

  @RequirePermissions(perm(ErpAction.UPDATE))
  @ApiOperation({ summary: 'Sửa vụ việc (xe sync chỉ sửa nhóm ERP-local)' })
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCaseDto,
    @BranchId() branch: string,
  ) {
    return this.service.update(requireBranch(branch), id, dto);
  }

  @RequirePermissions(perm(ErpAction.UPDATE))
  @ApiOperation({ summary: 'Đổi trạng thái vụ việc nhập tay' })
  @Patch(':id/status')
  status(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCaseStatusDto,
    @BranchId() branch: string,
  ) {
    return this.service.updateStatus(requireBranch(branch), id, dto.status);
  }

  @RequirePermissions(perm(ErpAction.DELETE))
  @ApiOperation({ summary: 'Xóa mềm vụ việc nhập tay (xe sync: 409)' })
  @Delete(':id')
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @BranchId() branch: string,
  ) {
    return this.service.remove(requireBranch(branch), id);
  }

  @RequirePermissions(perm(ErpAction.UPDATE))
  @ApiOperation({ summary: 'Thêm dòng hạng mục (xe nhập tay)' })
  @Post(':id/services')
  addLine(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CaseServiceLineDto,
    @BranchId() branch: string,
  ) {
    return this.service.addLine(requireBranch(branch), id, dto);
  }

  @RequirePermissions(perm(ErpAction.UPDATE))
  @ApiOperation({ summary: 'Thay dòng hạng mục (xe nhập tay)' })
  @Put(':id/services/:lineId')
  replaceLine(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('lineId', new ParseUUIDPipe()) lineId: string,
    @Body() dto: CaseServiceLineDto,
    @BranchId() branch: string,
  ) {
    return this.service.replaceLine(requireBranch(branch), id, lineId, dto);
  }

  @RequirePermissions(perm(ErpAction.UPDATE))
  @ApiOperation({ summary: 'Sửa giá vốn phụ tùng của dòng (cả xe sync)' })
  @Patch(':id/services/:lineId/parts-cost')
  partsCost(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('lineId', new ParseUUIDPipe()) lineId: string,
    @Body() dto: UpdateServicePartsCostDto,
    @BranchId() branch: string,
  ) {
    return this.service.updatePartsCost(
      requireBranch(branch),
      id,
      lineId,
      dto.partsCost,
    );
  }

  @RequirePermissions(perm(ErpAction.UPDATE))
  @ApiOperation({ summary: 'Xóa dòng hạng mục (xe nhập tay)' })
  @Delete(':id/services/:lineId')
  removeLine(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('lineId', new ParseUUIDPipe()) lineId: string,
    @BranchId() branch: string,
  ) {
    return this.service.removeLine(requireBranch(branch), id, lineId);
  }
}

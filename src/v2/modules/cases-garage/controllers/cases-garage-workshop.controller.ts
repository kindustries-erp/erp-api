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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CoreRbacGuard } from '@/auth/guards/core-rbac.guard';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { ErpAction, ErpResource, RbacAccessService } from '@/v2/core/rbac-core';
import { BranchId } from '@/kgara-api-core/decorators/branch-id.decorator';
import {
  CreateCaseProgressLogDto,
  QueryWorkshopBoardDto,
  UpdateCaseProgressLogDto,
} from '../dto/case-progress-log.dto';
import {
  QueryWorkshopCandidatesDto,
  TrackNewWorkshopCaseDto,
  TrackWorkshopCaseDto,
} from '../dto/case-workshop-track.dto';
import { CaseProgressLogCommandService } from '../services/case-progress-log-command.service';
import { CaseWorkshopCandidatesService } from '../services/case-workshop-candidates.service';
import { CaseWorkshopQueryService } from '../services/case-workshop-query.service';
import { CaseStatus } from '../entities/case-garage.enums';
import { CaseWorkshopTrackService } from '../services/case-workshop-track.service';
import { CaseWorkshopWorkersService } from '../services/case-workshop-workers.service';

const perm = (action: ErpAction) => ({
  resource: ErpResource.GARAGE_WORKSHOP,
  action,
});

interface RequestWithUser {
  user?: { sub?: string };
}

function requireBranch(branchId: string | undefined): string {
  if (!branchId) throw new BadRequestException('Thiếu chi nhánh.');
  return branchId;
}

/**
 * Trang tiến độ xưởng (quyền riêng `garage_workshop`): board xe theo status v2, nhật ký công đoạn/ghi chú,
 * sửa tay giờ. Đổi status cha vẫn qua `PATCH :id/status` (quyền `garage:update`).
 * Khai báo TRƯỚC `CasesGarageController` để `workshop/board` không bị `GET :id` nuốt.
 */
@ApiTags('cases-garage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('api/v2/cases-garage')
export class CasesGarageWorkshopController {
  constructor(
    private readonly query: CaseWorkshopQueryService,
    private readonly logs: CaseProgressLogCommandService,
    private readonly workersService: CaseWorkshopWorkersService,
    private readonly candidatesService: CaseWorkshopCandidatesService,
    private readonly tracker: CaseWorkshopTrackService,
    private readonly rbac: RbacAccessService,
  ) {}

  @RequirePermissions(perm(ErpAction.READ))
  @ApiOperation({
    summary: 'Board tiến độ xưởng: mọi status v2 + thời gian công đoạn',
  })
  @Get('workshop/board')
  board(@Query() q: QueryWorkshopBoardDto, @BranchId() branch: string) {
    return this.query.board(requireBranch(branch), q);
  }

  @RequirePermissions(perm(ErpAction.READ))
  @ApiOperation({ summary: 'Nhân viên để chọn người làm (theo chi nhánh)' })
  @Get('workshop/workers')
  workers(@Query('search') search: string, @BranchId() branch: string) {
    return this.workersService.list(requireBranch(branch), search);
  }

  @RequirePermissions(perm(ErpAction.READ))
  @ApiOperation({ summary: 'Tìm xe để đưa vào bảng (biển số, mã, khách)' })
  @Get('workshop/candidates')
  async candidates(
    @Query() q: QueryWorkshopCandidatesDto,
    @BranchId() branch: string,
  ) {
    return {
      items: await this.candidatesService.search(requireBranch(branch), q),
    };
  }

  @RequirePermissions(perm(ErpAction.UPDATE))
  @ApiOperation({
    summary:
      'Đưa xe có sẵn vào bảng; đổi trạng thái cần thêm quyền garage:update',
  })
  @Post('workshop/track')
  async track(
    @Body() dto: TrackWorkshopCaseDto,
    @BranchId() branch: string,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user?.sub ?? '';
    const canChangeStatus = dto.status
      ? await this.rbac.hasPermission(
          userId,
          ErpResource.GARAGE,
          ErpAction.UPDATE,
        )
      : false;
    const data = await this.tracker.track(requireBranch(branch), dto, {
      id: userId,
      canChangeStatus,
    });
    return { message: 'Đã đưa xe vào bảng tiến độ', data };
  }

  @RequirePermissions(perm(ErpAction.UPDATE), {
    resource: ErpResource.GARAGE,
    action: ErpAction.CREATE,
  })
  @ApiOperation({ summary: 'Tạo vụ việc cho xe chưa có rồi đưa vào bảng' })
  @Post('workshop/track-new')
  async trackNew(
    @Body() dto: TrackNewWorkshopCaseDto,
    @BranchId() branch: string,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user?.sub ?? '';
    // Tạo xe ở trạng thái khác Tiếp nhận là đổi trạng thái: cần thêm garage:update.
    const canChangeStatus =
      dto.status && dto.status !== CaseStatus.INTAKE
        ? await this.rbac.hasPermission(
            userId,
            ErpResource.GARAGE,
            ErpAction.UPDATE,
          )
        : false;
    const data = await this.tracker.trackNew(requireBranch(branch), dto, {
      id: userId,
      canChangeStatus,
    });
    return { message: 'Đã tạo xe và đưa vào bảng tiến độ', data };
  }

  @RequirePermissions(perm(ErpAction.UPDATE))
  @ApiOperation({ summary: 'Bỏ xe khỏi bảng (giữ vụ việc và nhật ký)' })
  @Delete('workshop/track/:caseId')
  async untrack(
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
    @BranchId() branch: string,
  ) {
    await this.tracker.untrack(requireBranch(branch), caseId);
    return { message: 'Đã bỏ xe khỏi bảng tiến độ' };
  }

  @RequirePermissions(perm(ErpAction.READ))
  @ApiOperation({ summary: 'Timeline nhật ký tiến độ của một xe' })
  @Get(':id/progress-logs')
  async timeline(
    @Param('id', new ParseUUIDPipe()) id: string,
    @BranchId() branch: string,
  ) {
    return { items: await this.query.timeline(requireBranch(branch), id) };
  }

  @RequirePermissions(perm(ErpAction.UPDATE))
  @ApiOperation({ summary: 'Ghi công đoạn (STAGE) hoặc ghi chú (NOTE)' })
  @Post(':id/progress-logs')
  async createLog(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateCaseProgressLogDto,
    @BranchId() branch: string,
    @Req() req: RequestWithUser,
  ) {
    const data = await this.logs.create(
      requireBranch(branch),
      id,
      dto,
      req.user?.sub ?? '',
    );
    return { message: 'Đã ghi tiến độ', data };
  }

  @RequirePermissions(perm(ErpAction.UPDATE))
  @ApiOperation({
    summary: 'Sửa tay nhật ký: mô tả, người làm, giờ bắt đầu/kết thúc',
  })
  @Patch('progress-logs/:logId')
  async updateLog(
    @Param('logId', new ParseUUIDPipe()) logId: string,
    @Body() dto: UpdateCaseProgressLogDto,
    @BranchId() branch: string,
    @Req() req: RequestWithUser,
  ) {
    const data = await this.logs.update(
      requireBranch(branch),
      logId,
      dto,
      req.user?.sub ?? '',
    );
    return { message: 'Đã cập nhật nhật ký', data };
  }

  @RequirePermissions(perm(ErpAction.UPDATE))
  @ApiOperation({ summary: 'Xóa mềm một dòng nhật ký' })
  @Delete('progress-logs/:logId')
  async removeLog(
    @Param('logId', new ParseUUIDPipe()) logId: string,
    @BranchId() branch: string,
    @Req() req: RequestWithUser,
  ) {
    await this.logs.remove(requireBranch(branch), logId, req.user?.sub ?? '');
    return { message: 'Đã xóa nhật ký' };
  }
}

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
import { ErpBranchId } from '@/v2/core/branches-core';
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
  board(
    @Query() q: QueryWorkshopBoardDto,
    @ErpBranchId() branch: string | undefined,
  ) {
    return this.query.board(branch, q);
  }

  @RequirePermissions(perm(ErpAction.READ))
  @ApiOperation({ summary: 'Nhân viên để chọn người làm (theo chi nhánh)' })
  @Get('workshop/workers')
  workers(
    @Query('search') search: string,
    @ErpBranchId() branch: string | undefined,
  ) {
    return this.workersService.list(branch, search);
  }

  @RequirePermissions(perm(ErpAction.READ))
  @ApiOperation({ summary: 'Tìm xe để đưa vào bảng (biển số, mã, khách)' })
  @Get('workshop/candidates')
  async candidates(
    @Query() q: QueryWorkshopCandidatesDto,
    @ErpBranchId() branch: string | undefined,
  ) {
    return {
      items: await this.candidatesService.search(branch, q),
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
    @ErpBranchId() branch: string | undefined,
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
    const data = await this.tracker.track(branch, dto, {
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
    @ErpBranchId() branch: string | undefined,
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
    const data = await this.tracker.trackNew(branch, dto, {
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
    @ErpBranchId() branch: string | undefined,
  ) {
    await this.tracker.untrack(branch, caseId);
    return { message: 'Đã bỏ xe khỏi bảng tiến độ' };
  }

  @RequirePermissions(perm(ErpAction.READ))
  @ApiOperation({ summary: 'Timeline nhật ký tiến độ của một xe' })
  @Get(':id/progress-logs')
  async timeline(
    @Param('id', new ParseUUIDPipe()) id: string,
    @ErpBranchId() branch: string | undefined,
  ) {
    return { items: await this.query.timeline(branch, id) };
  }

  @RequirePermissions(perm(ErpAction.UPDATE))
  @ApiOperation({ summary: 'Ghi công đoạn (STAGE) hoặc ghi chú (NOTE)' })
  @Post(':id/progress-logs')
  async createLog(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateCaseProgressLogDto,
    @ErpBranchId() branch: string | undefined,
    @Req() req: RequestWithUser,
  ) {
    const data = await this.logs.create(branch, id, dto, req.user?.sub ?? '');
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
    @ErpBranchId() branch: string | undefined,
    @Req() req: RequestWithUser,
  ) {
    const data = await this.logs.update(
      branch,
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
    @ErpBranchId() branch: string | undefined,
    @Req() req: RequestWithUser,
  ) {
    await this.logs.remove(branch, logId, req.user?.sub ?? '');
    return { message: 'Đã xóa nhật ký' };
  }
}

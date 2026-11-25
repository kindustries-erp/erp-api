import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { BranchesManagementService } from '../branches-management.service';
import { CreateErpBranchDto } from '../dto/create-erp-branch.dto';
import { ErpBranchListResponseDto } from '../dto/erp-branch-list-response.dto';
import { UpdateErpBranchDto } from '../dto/update-erp-branch.dto';
import { ParseBranchBodyPipe } from '../pipes/parse-branch-body.pipe';
import { BranchExternalLinkService } from '../services/branch-external-link.service';

@ApiTags('branches_management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v2/branches')
export class ErpBranchController {
  constructor(
    private readonly service: BranchesManagementService,
    private readonly externalLinks: BranchExternalLinkService,
  ) {}

  @ApiOkResponse({ type: ErpBranchListResponseDto })
  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.service.findAll(query);
  }

  /** Liên kết nguồn ngoài của chi nhánh (Kgara: `externalId`, `accountKey`), dùng khi đối chiếu với đơn vị KGara. */
  @Get(':id/external-links')
  async findExternalLinks(@Param('id') id: string) {
    const links = await this.externalLinks.findByBranch(id);
    return {
      items: links.map((l) => ({
        source: l.source,
        externalId: l.externalId,
        accountKey: l.accountKey ?? null,
      })),
    };
  }

  @Post()
  create(
    @Body(new ParseBranchBodyPipe(CreateErpBranchDto))
    body: Record<string, unknown>,
  ) {
    return this.service.create(body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ParseBranchBodyPipe(UpdateErpBranchDto))
    body: Record<string, unknown>,
  ) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

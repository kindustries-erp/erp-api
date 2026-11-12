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

@ApiTags('erp_branches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('branches')
export class ErpBranchController {
  constructor(private readonly service: BranchesManagementService) {}

  @ApiOkResponse({ type: ErpBranchListResponseDto })
  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.service.findAll(query);
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

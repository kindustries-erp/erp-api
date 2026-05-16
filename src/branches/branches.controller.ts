import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Req } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { BranchQueryDto } from './dto/branch-query.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DirectusAuthGuard } from '../auth/guards/directus-auth.guard';

@ApiTags('branches')
@ApiBearerAuth()
@UseGuards(DirectusAuthGuard)
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new branch' })
  create(@Body() createBranchDto: CreateBranchDto, @Req() req: any) {
    const token = this.extractTokenFromHeader(req);
    return this.branchesService.create(createBranchDto, token);
  }

  @Get()
  @ApiOperation({ summary: 'Get all branches' })
  findAll(@Query() query: BranchQueryDto, @Req() req: any) {
    const token = this.extractTokenFromHeader(req);
    return this.branchesService.findAll(query, token);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get branch by id' })
  findOne(@Param('id') id: string, @Req() req: any) {
    const token = this.extractTokenFromHeader(req);
    return this.branchesService.findOne(+id, token);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update branch' })
  update(@Param('id') id: string, @Body() updateBranchDto: UpdateBranchDto, @Req() req: any) {
    const token = this.extractTokenFromHeader(req);
    return this.branchesService.update(+id, updateBranchDto, token);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete branch' })
  remove(@Param('id') id: string, @Req() req: any) {
    const token = this.extractTokenFromHeader(req);
    return this.branchesService.remove(+id, token);
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { TagsCoreService } from './tags-core.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { UpdateEntityTagsDto } from './dto/update-entity-tags.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';

@ApiTags('sys_tags')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sys-tags')
export class TagsCoreController {
  constructor(private readonly tagsCoreService: TagsCoreService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new tag' })
  @RequirePermissions({ resource: 'sys_tags', action: 'create' })
  create(@Body() createTagDto: CreateTagDto) {
    return this.tagsCoreService.create(createTagDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all tags' })
  @RequirePermissions({ resource: 'sys_tags', action: 'read' })
  findAll() {
    return this.tagsCoreService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single tag by ID' })
  @RequirePermissions({ resource: 'sys_tags', action: 'read' })
  findOne(@Param('id') id: string) {
    return this.tagsCoreService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a tag' })
  @RequirePermissions({ resource: 'sys_tags', action: 'update' })
  update(@Param('id') id: string, @Body() updateTagDto: UpdateTagDto) {
    return this.tagsCoreService.update(id, updateTagDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a tag (soft delete)' })
  @RequirePermissions({ resource: 'sys_tags', action: 'delete' })
  remove(@Param('id') id: string) {
    return this.tagsCoreService.remove(id);
  }

  // --- Entity Tag Associations ---

  @Post('entity-tags')
  @ApiOperation({
    summary: 'Update (overwrite) all tags for a specific entity',
  })
  @RequirePermissions({ resource: 'sys_tags', action: 'update' })
  updateEntityTags(@Body() updateEntityTagsDto: UpdateEntityTagsDto) {
    return this.tagsCoreService.updateEntityTags(updateEntityTagsDto);
  }

  @Get('entity-tags/list')
  @ApiOperation({ summary: 'Get all tags for a specific entity' })
  @RequirePermissions({ resource: 'sys_tags', action: 'read' })
  getEntityTags(
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
  ) {
    return this.tagsCoreService.getEntityTags(entityType, entityId);
  }

  @Post('entity-tags/batch')
  @ApiOperation({
    summary: 'Get tags for multiple entities in a single request',
  })
  @RequirePermissions({ resource: 'sys_tags', action: 'read' })
  batchGetEntityTags(
    @Body() body: { queries: { entityType: string; entityId: string }[] },
  ) {
    return this.tagsCoreService.batchGetEntityTags(body.queries);
  }

  @Get(':id/connections')
  @ApiOperation({ summary: 'Get all entity connections for a specific tag' })
  @RequirePermissions({ resource: 'sys_tags', action: 'read' })
  getTagConnections(@Param('id') id: string) {
    return this.tagsCoreService.getTagConnections(id);
  }
}

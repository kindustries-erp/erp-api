import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { SysTag } from './entities/sys_tag.entity';
import { SysEntityTag } from './entities/sys_entity_tag.entity';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { UpdateEntityTagsDto } from './dto/update-entity-tags.dto';

@Injectable()
export class TagsCoreService {
  constructor(
    @InjectRepository(SysTag)
    private readonly tagRepository: Repository<SysTag>,
    @InjectRepository(SysEntityTag)
    private readonly entityTagRepository: Repository<SysEntityTag>,
  ) {}

  async create(createTagDto: CreateTagDto): Promise<SysTag> {
    const existing = await this.tagRepository.findOne({
      where: { name: createTagDto.name, isDeleted: false },
    });
    if (existing) {
      throw new ConflictException('Tag name already exists');
    }
    const tag = this.tagRepository.create(createTagDto);
    return this.tagRepository.save(tag);
  }

  async findAll(): Promise<SysTag[]> {
    return this.tagRepository.find({
      where: { isDeleted: false },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<SysTag> {
    const tag = await this.tagRepository.findOne({
      where: { id, isDeleted: false },
    });
    if (!tag) {
      throw new NotFoundException(`Tag with ID ${id} not found`);
    }
    return tag;
  }

  async update(id: string, updateTagDto: UpdateTagDto): Promise<SysTag> {
    const tag = await this.findOne(id);

    if (updateTagDto.name && updateTagDto.name !== tag.name) {
      const existing = await this.tagRepository.findOne({
        where: { name: updateTagDto.name, isDeleted: false },
      });
      if (existing) {
        throw new ConflictException('Tag name already exists');
      }
    }

    Object.assign(tag, updateTagDto);
    return this.tagRepository.save(tag);
  }

  async remove(id: string): Promise<void> {
    const tag = await this.findOne(id);
    tag.isDeleted = true;
    await this.tagRepository.save(tag);

    // Also remove from all entities
    await this.entityTagRepository.delete({ tagId: id });
  }

  // Assign multiple tags to one entity (overwrites existing tags for that entity)
  async updateEntityTags(dto: UpdateEntityTagsDto): Promise<void> {
    const { entityType, entityId, tagIds } = dto;

    // 1. Delete all existing tags for this entity
    await this.entityTagRepository.delete({ entityType, entityId });

    if (tagIds.length > 0) {
      // 2. Verify all tagIds exist
      const validTags = await this.tagRepository.find({
        where: { id: In(tagIds), isDeleted: false },
      });
      const validTagIds = validTags.map((t) => t.id);

      // 3. Insert new entity tags
      const entityTags = validTagIds.map((tagId) =>
        this.entityTagRepository.create({ tagId, entityType, entityId }),
      );

      await this.entityTagRepository.save(entityTags);
    }
  }

  // Get all tags for a specific entity
  async getEntityTags(entityType: string, entityId: string): Promise<SysTag[]> {
    const entityTags = await this.entityTagRepository.find({
      where: { entityType, entityId },
    });

    if (entityTags.length === 0) return [];

    const tagIds = entityTags.map((et) => et.tagId);
    return this.tagRepository.find({
      where: { id: In(tagIds), isDeleted: false },
    });
  }

  // Get all entities tagged with a specific tag
  async getTagConnections(tagId: string): Promise<SysEntityTag[]> {
    // Validate tag exists
    await this.findOne(tagId);

    return this.entityTagRepository.find({
      where: { tagId },
    });
  }
}

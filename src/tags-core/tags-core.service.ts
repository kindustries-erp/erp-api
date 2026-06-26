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
  async getTagConnections(tagId: string): Promise<any[]> {
    // Validate tag exists
    await this.findOne(tagId);

    const connections = await this.entityTagRepository.find({
      where: { tagId },
    });

    const result: any[] = [];
    for (const conn of connections) {
      let displayCode = conn.entityId;
      let entityStatus = 'UNKNOWN';
      let entityDate = conn.createdAt;
      let meta: any = {};

      try {
        if (conn.entityType === 'erp_purchase_order') {
          const rows = await this.entityTagRepository.manager.query(
            `SELECT po.po_no as document_no, po.status, po.created_at, po.order_date, po.expected_date, bp.name as partner_name FROM erp_purchase_orders po LEFT JOIN erp_business_partners bp ON po.supplier_id = bp.id WHERE po.id = $1`,
            [conn.entityId],
          );
          if (rows.length > 0) {
            displayCode = rows[0].document_no;
            entityStatus = rows[0].status;
            entityDate = rows[0].created_at;
            meta = {
              orderDate: rows[0].order_date,
              expectedDate: rows[0].expected_date,
              partnerName: rows[0].partner_name,
            };
          }
        } else if (conn.entityType === 'erp_sales_order') {
          const rows = await this.entityTagRepository.manager.query(
            `SELECT so.so_no as document_no, so.status, so.created_at, so.order_date, bp.name as partner_name FROM erp_sales_orders so LEFT JOIN erp_business_partners bp ON so.customer_id = bp.id WHERE so.id = $1`,
            [conn.entityId],
          );
          if (rows.length > 0) {
            displayCode = rows[0].document_no;
            entityStatus = rows[0].status;
            entityDate = rows[0].created_at;
            meta = {
              orderDate: rows[0].order_date,
              partnerName: rows[0].partner_name,
            };
          }
        } else if (conn.entityType === 'erp_invoice') {
          const rows = await this.entityTagRepository.manager.query(
            `SELECT invoice_no, status, created_at, invoice_date, total_amount, seller_name, buyer_name FROM erp_invoices WHERE id = $1`,
            [conn.entityId],
          );
          if (rows.length > 0) {
            displayCode = rows[0].invoice_no || conn.entityId;
            entityStatus = rows[0].status;
            entityDate = rows[0].created_at;
            meta = {
              invoiceDate: rows[0].invoice_date,
              totalAmount: rows[0].total_amount,
              partnerName: rows[0].seller_name || rows[0].buyer_name, // fallback
            };
          }
        }
      } catch (err) {
        // Fallback to defaults if table doesn't exist yet
      }

      result.push({
        tagId: conn.tagId,
        entityType: conn.entityType,
        entityId: conn.entityId,
        displayCode,
        entityStatus,
        entityDate,
        meta,
      });
    }

    return result;
  }
}

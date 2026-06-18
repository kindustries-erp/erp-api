import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, DeepPartial, ILike, Repository } from 'typeorm';
import { PaginationDto } from '../common/dto/pagination.dto';
import { resolveSortOrder } from '../common/utils/sort.util';
import { ErpBom } from './entities/erp_bom.entity';
import { ErpBomLine } from './entities/erp_bom_line.entity';
import { CreateBomDto } from './dto/create-bom.dto';
import { UpdateBomDto } from './dto/update-bom.dto';
import { ListBomDto } from './dto/list-bom.dto';

@Injectable()
export class BomCoreService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ErpBom)
    private readonly repository: Repository<ErpBom>,
    @InjectRepository(ErpBomLine)
    private readonly lineRepository: Repository<ErpBomLine>,
  ) {}

  async create(dto: CreateBomDto) {
    const { lines = [], ...header } = dto;
    return this.dataSource.transaction(async (manager) => {
      const headerRepo = manager.getRepository(ErpBom);
      const lineRepo = manager.getRepository(ErpBomLine);
      const data = await headerRepo.save(
        headerRepo.create({
          status: header.status ?? 'ACTIVE',
          ...header,
        } as DeepPartial<ErpBom>),
      );
      const savedLines: ErpBomLine[] = [];
      let lineNo = 1;
      for (const line of lines) {
        savedLines.push(
          await lineRepo.save(
            lineRepo.create({
              bomId: data.id,
              lineNo: lineNo++,
              componentItemId: line.componentItemId ?? null,
              qtyRequired: line.qtyRequired,
              uom: line.uom,
              scrapRate: line.scrapRate ?? null,
              notes: line.notes ?? null,
            } as DeepPartial<ErpBomLine>),
          ),
        );
      }
      return {
        message: 'Tạo thành công',
        data: { ...data, lines: savedLines },
      };
    });
  }

  async findAll(query: ListBomDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const order = resolveSortOrder(query.sort, {
      defaultOrder: { createdAt: 'DESC' },
    });

    const where: any = { isDeleted: false };
    if (query.search) {
      where.bomName = ILike(`%${query.search}%`);
    }
    if (query.finishedGoodItemId) {
      where.finishedGoodItemId = query.finishedGoodItemId;
    }

    const [items, total] = await this.repository.findAndCount({
      where: Object.keys(where).length > 0 ? where : undefined,
      skip: (page - 1) * pageSize,
      take: pageSize,
      order,
    });

    if (items.length > 0) {
      const fgIds = items.map((i) => i.finishedGoodItemId).filter(Boolean);
      if (fgIds.length > 0) {
        const fgItems = await this.dataSource.query(
          `SELECT id, sku, item_name FROM erp_inventory_items WHERE id = ANY($1::uuid[])`,
          [fgIds],
        );
        const fgMap = new Map(fgItems.map((i: any) => [i.id, i]));
        for (const item of items) {
          if (item.finishedGoodItemId && fgMap.has(item.finishedGoodItemId)) {
            const fg = fgMap.get(item.finishedGoodItemId) as any;
            (item as any).finishedGoodItemCode = fg.sku;
            (item as any).finishedGoodItemName = `${fg.sku} — ${fg.item_name}`;
          }
        }
      }
    }

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string) {
    const data = await this.repository.findOneOrFail({ where: { id, isDeleted: false } });
    const lines = await this.lineRepository.find({
      where: { bomId: id },
      order: { lineNo: 'ASC' },
    });

    if (data.finishedGoodItemId) {
      const fgItems = await this.dataSource.query(
        `SELECT id, sku, item_name FROM erp_inventory_items WHERE id = $1::uuid`,
        [data.finishedGoodItemId],
      );
      if (fgItems.length > 0) {
        const fg = fgItems[0];
        (data as any).finishedGoodItemCode = fg.sku;
        (data as any).finishedGoodItemName = `${fg.sku} — ${fg.item_name}`;
      }
    }

    if (lines.length > 0) {
      const itemIds = lines.map((l) => l.componentItemId).filter(Boolean);
      if (itemIds.length > 0) {
        const items = await this.dataSource.query(
          `SELECT id, sku, item_name FROM erp_inventory_items WHERE id = ANY($1::uuid[])`,
          [itemIds],
        );
        const itemMap = new Map(items.map((i: any) => [i.id, i]));
        for (const line of lines) {
          if (line.componentItemId && itemMap.has(line.componentItemId)) {
            const item = itemMap.get(line.componentItemId) as any;
            (line as any).componentItemCode = item.sku;
            (line as any).componentItemName = `${item.sku} — ${item.item_name}`;
          }
        }
      }
    }

    return { message: 'Lấy thông tin thành công', data: { ...data, lines } };
  }

  async update(id: string, dto: UpdateBomDto) {
    const { lines, ...header } = dto as any;
    await this.repository.update(id, header);
    if (Array.isArray(lines)) {
      await this.dataSource.transaction(async (manager) => {
        const lineRepo = manager.getRepository(ErpBomLine);
        await lineRepo.delete({ bomId: id });
        let lineNo = 1;
        for (const line of lines) {
          await lineRepo.save(
            lineRepo.create({
              bomId: id,
              lineNo: lineNo++,
              componentItemId: line.componentItemId ?? null,
              qtyRequired: line.qtyRequired,
              uom: line.uom,
              scrapRate: line.scrapRate ?? null,
              notes: line.notes ?? null,
            } as DeepPartial<ErpBomLine>),
          );
        }
      });
    }
    return this.findOne(id);
  }

  async remove(id: string) {
    const existing = await this.repository.findOne({ where: { id, isDeleted: false } });
    if (!existing) throw new NotFoundException('Không tìm thấy định mức (BOM)');
    await this.repository.update(id, { isDeleted: true } as any);
    return { message: 'Xóa thành công' };
  }
}

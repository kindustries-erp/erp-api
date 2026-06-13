import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, DeepPartial, ILike, Repository } from 'typeorm';
import { PaginationDto } from '../common/dto/pagination.dto';
import { resolveSortOrder } from '../common/utils/sort.util';
import { ErpBom } from './entities/erp_bom.entity';
import { ErpBomLine } from './entities/erp_bom_line.entity';
import { CreateBomDto } from './dto/create-bom.dto';
import { UpdateBomDto } from './dto/update-bom.dto';

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

  async findAll(query: PaginationDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const order = resolveSortOrder(query.sort, {
      defaultOrder: { createdAt: 'DESC' },
    });

    const [items, total] = await this.repository.findAndCount({
      where: query.search
        ? ([{ bomName: ILike(`%${query.search}%`) }] as any)
        : undefined,
      skip: (page - 1) * pageSize,
      take: pageSize,
      order,
    });
    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string) {
    const data = await this.repository.findOneByOrFail({ id });
    const lines = await this.lineRepository.find({
      where: { bomId: id },
      order: { lineNo: 'ASC' },
    });
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
}

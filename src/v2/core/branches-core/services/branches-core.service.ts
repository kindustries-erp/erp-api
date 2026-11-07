import { Injectable } from '@nestjs/common';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { BranchCommandService, BranchInput } from './branch-command.service';
import { BranchQueryService } from './branch-query.service';

@Injectable()
export class BranchesCoreService {
  constructor(
    private readonly query: BranchQueryService,
    private readonly command: BranchCommandService,
  ) {}

  findAll(query: PaginationDto) {
    return this.query.findAll(query);
  }

  create(data: BranchInput) {
    return this.command.create(data);
  }

  update(id: string, data: BranchInput) {
    return this.command.update(id, data);
  }

  remove(id: string) {
    return this.command.remove(id);
  }
}

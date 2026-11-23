import { Injectable } from '@nestjs/common';
import { BaseLinkOverrideEngine } from '@/v2/core/link-override-core';
import { ProcurementRequestBranchLinkSource } from '../link-sources/branch.link-source';

/**
 * Engine override của đề nghị mua garage. Field theo dõi: `branchName` (tên chi nhánh sửa được
 * mà không đổi bản ghi chi nhánh gốc). `branchId` là FK nên không nằm trong tập theo dõi.
 */
@Injectable()
export class ProcurementRequestLinkEngine extends BaseLinkOverrideEngine {
  protected readonly trackedKeys: ReadonlySet<string> = new Set(['branchName']);

  constructor(branchSource: ProcurementRequestBranchLinkSource) {
    super(branchSource);
  }
}

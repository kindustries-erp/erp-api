import { ApiProperty } from '@nestjs/swagger';

/**
 * Một bước trong vòng đời duyệt của chứng từ. `by`/`byEmail` là người thực hiện,
 * `at` là thời điểm. `reason` chỉ có ở bước reject, cancel, close.
 */
export class ApprovalStepDto {
  @ApiProperty({ nullable: true }) by: string | null;
  @ApiProperty({ nullable: true, description: 'Email người thực hiện' })
  byEmail: string | null;
  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  at: Date | null;
  @ApiProperty({ nullable: true, required: false })
  reason?: string | null;
}

/**
 * Khối duyệt dùng chung cho PR và PO (erp và garage). Bước chưa xảy ra là `null`.
 * `approverId`/`approverEmail` là người được giao; sau khi duyệt thì là người đã duyệt.
 * `issue` chỉ có nghĩa với PO; PR luôn trả `null` để shape giống nhau.
 */
export class ApprovalSummaryDto {
  @ApiProperty({ nullable: true }) approverId: string | null;
  @ApiProperty({ nullable: true, description: 'Email người duyệt' })
  approverEmail: string | null;
  @ApiProperty({ type: ApprovalStepDto, nullable: true })
  submit: ApprovalStepDto | null;
  @ApiProperty({ type: ApprovalStepDto, nullable: true })
  approve: ApprovalStepDto | null;
  @ApiProperty({ type: ApprovalStepDto, nullable: true })
  reject: ApprovalStepDto | null;
  @ApiProperty({ type: ApprovalStepDto, nullable: true })
  cancel: ApprovalStepDto | null;
  @ApiProperty({ type: ApprovalStepDto, nullable: true })
  close: ApprovalStepDto | null;
  @ApiProperty({ type: ApprovalStepDto, nullable: true })
  issue: ApprovalStepDto | null;
}

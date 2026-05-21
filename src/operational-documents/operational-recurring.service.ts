import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OperationalDocumentsService } from './operational-documents.service';

type RecurringCollection = 'purchase_orders' | 'operating_expenses';

interface RecurringCandidate {
  id: string;
  purchase_no?: string;
  expense_no?: string;
  branch_id?: string | null;
  supplier_id?: string | null;
  supplier_name_snapshot?: string | null;
  expense_category?: string | null;
  title?: string | null;
  document_date?: string | null;
  due_date?: string | null;
  invoice_status?: string | null;
  status?: string | null;
  total_amount?: number | string | null;
  recurrence_type?: string | null;
  recurrence_interval?: number | string | null;
  recurrence_start_date?: string | null;
  recurrence_end_date?: string | null;
  next_due_date?: string | null;
  auto_generate_next?: boolean | null;
  parent_recurring_id?: string | null;
  notes?: string | null;
}

@Injectable()
export class OperationalRecurringService {
  private readonly logger = new Logger(OperationalRecurringService.name);

  constructor(private readonly documentsService: OperationalDocumentsService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async generateRecurringDocuments() {
    await this.runCollection('purchase_orders');
    await this.runCollection('operating_expenses');
  }

  private async runCollection(collection: RecurringCollection) {
    const today = this.toDateOnly(new Date());
    const candidates = await this.documentsService.findRecurringCandidates(
      collection,
      today,
    );

    for (const candidate of candidates) {
      try {
        await this.documentsService.generateRecurringDocument(
          collection,
          candidate,
        );
      } catch (error) {
        const docNo =
          candidate.purchase_no || candidate.expense_no || candidate.id;
        this.logger.error(
          `Recurring generation failed for ${collection}/${docNo}: ${(error as Error).message}`,
        );
      }
    }
  }

  private toDateOnly(value: Date) {
    return value.toISOString().slice(0, 10);
  }
}

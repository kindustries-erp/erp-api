import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErpGoodsReceiptLine } from './entities/erp_goods_receipt_line.entity';
import { ErpGoodsReceipt } from './entities/erp_goods_receipt.entity';
import { ErpInventoryItem } from '../inventory-core/entities/erp_inventory_item.entity';
import { GoodsReceiptsCoreService } from './goods-receipts-core.service';
import { format } from 'date-fns';
import { Subject } from 'rxjs';

export interface SerialProgressEvent {
  processId: 'serial-generation' | 'ping';
  pendingLines: number;
  pendingSerials: number;
  isRunning: boolean;
  message?: string;
  completed: boolean;
}

@Injectable()
export class GoodsReceiptsCronService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GoodsReceiptsCronService.name);
  private timeoutId: NodeJS.Timeout;
  public isRunning = false;
  private isDestroyed = false;
  public readonly progress$ = new Subject<SerialProgressEvent>();

  constructor(
    @InjectRepository(ErpGoodsReceiptLine)
    private readonly grLineRepo: Repository<ErpGoodsReceiptLine>,
    @InjectRepository(ErpGoodsReceipt)
    private readonly grRepo: Repository<ErpGoodsReceipt>,
    @InjectRepository(ErpInventoryItem)
    private readonly itemRepo: Repository<ErpInventoryItem>,
    private readonly goodsReceiptsCoreService: GoodsReceiptsCoreService,
  ) {}

  onModuleInit() {
    this.scheduleNextRun(10000); // Wait 10 seconds before starting
  }

  onModuleDestroy() {
    this.isDestroyed = true;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    this.progress$.complete();
  }

  private emitProgress(
    pendingLines: number,
    pendingSerials: number,
    isRunning: boolean,
    completed: boolean,
    message?: string,
  ) {
    this.progress$.next({
      processId: 'serial-generation',
      pendingLines,
      pendingSerials,
      isRunning,
      completed,
      message,
    });
  }

  private scheduleNextRun(ms = 15000) {
    if (this.isDestroyed) return;
    this.timeoutId = setTimeout(() => {
      this.processPendingSerials().finally(() => {
        this.scheduleNextRun();
      });
    }, ms);
  }

  async processPendingSerials() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      // In TypeORM QueryBuilder, if we join goodsReceiptId which is a string column to the ErpGoodsReceipt table,
      // it's better to just use raw queries or standard where conditions.
      const pendingLines = await this.grLineRepo
        .createQueryBuilder('line')
        .where('line.serials_generated = :generated', { generated: false })
        .andWhere('line.item_id IS NOT NULL')
        .limit(50)
        .getMany();

      if (pendingLines.length > 0) {
        // filter lines whose GR is POSTED
        const linesToProcess: {
          line: ErpGoodsReceiptLine;
          gr: ErpGoodsReceipt;
        }[] = [];
        for (const line of pendingLines) {
          const gr = await this.grRepo.findOneBy({ id: line.goodsReceiptId });
          if (gr && gr.status === 'POSTED') {
            linesToProcess.push({ line, gr });
          } else if (
            gr &&
            (gr.status === 'DRAFT' || gr.status === 'CANCELLED')
          ) {
            // mark generated=true for cancelled/draft to skip them in future
            if (gr.status === 'CANCELLED') {
              line.serialsGenerated = true;
              await this.grLineRepo.save(line);
            }
          }
        }

        if (linesToProcess.length > 0) {
          this.logger.log(
            `Found ${linesToProcess.length} goods receipt lines pending serial generation.`,
          );

          // Calculate total pending serials for this batch to emit initial progress
          const totalPendingSerials = linesToProcess.reduce(
            (sum, { line }) => sum + Math.round(Number(line.qtyReceived || 0)),
            0,
          );

          this.emitProgress(
            linesToProcess.length,
            totalPendingSerials,
            true,
            false,
            `Bắt đầu sinh serial cho ${linesToProcess.length} dòng`,
          );

          let remainingLines = linesToProcess.length;
          let remainingSerials = totalPendingSerials;

          for (const { line, gr } of linesToProcess) {
            const item = await this.itemRepo.findOne({
              where: { id: line.itemId! },
              relations: ['trackingPolicy'],
            });

            if (item?.trackingPolicy?.code === 'SERIAL') {
              const qtyInt = Math.round(Number(line.qtyReceived || 0));
              if (qtyInt > 0) {
                const receiptDateStr = gr.receiptDate
                  ? format(new Date(gr.receiptDate as any), 'yyyy-MM-dd')
                  : format(new Date(), 'yyyy-MM-dd');

                await this.goodsReceiptsCoreService.generateComponentSerials(
                  this.grLineRepo.manager,
                  item,
                  qtyInt,
                  line.id,
                  receiptDateStr,
                );
              }
            }

            // Mark as generated
            line.serialsGenerated = true;
            await this.grLineRepo.save(line);

            remainingLines -= 1;
            remainingSerials -= Math.round(Number(line.qtyReceived || 0));

            this.emitProgress(
              remainingLines,
              remainingSerials,
              true,
              false,
              `Đã xử lý ${line.itemId}`,
            );
          }

          this.logger.log(`Completed background serial generation for batch.`);
        }
      }

      // Emit final state after each run so clients always have fresh snapshot
      const finalProgress = await this.getProgress();
      this.emitProgress(
        finalProgress.pendingLines,
        finalProgress.pendingSerials,
        false,
        finalProgress.pendingLines === 0,
        finalProgress.pendingLines === 0
          ? 'Hoàn tất sinh serial'
          : 'Chờ đợt xử lý tiếp theo',
      );
    } catch (err) {
      this.logger.error(`Error in background serial generation:`, err);
      const finalProgress = await this.getProgress();
      this.emitProgress(
        finalProgress.pendingLines,
        finalProgress.pendingSerials,
        false,
        false,
        'Lỗi trong quá trình sinh serial',
      );
    } finally {
      this.isRunning = false;
    }
  }

  async getProgress() {
    // Instead of complex join, do a simple subquery or just fetch and count
    const pendingLinesCount = await this.grLineRepo.manager.query(`
      SELECT count(*) as count
      FROM erp_goods_receipt_lines l
      JOIN erp_goods_receipts gr ON gr.id = l.goods_receipt_id
      JOIN erp_inventory_items i ON i.id = l.item_id
      JOIN erp_tracking_policies p ON p.id = i.tracking_policy_id
      WHERE l.serials_generated = false
      AND gr.status = 'POSTED'
      AND p.code = 'SERIAL'
    `);

    const sumResult = await this.grLineRepo.manager.query(`
      SELECT SUM(l.qty_received) as total
      FROM erp_goods_receipt_lines l
      JOIN erp_goods_receipts gr ON gr.id = l.goods_receipt_id
      JOIN erp_inventory_items i ON i.id = l.item_id
      JOIN erp_tracking_policies p ON p.id = i.tracking_policy_id
      WHERE l.serials_generated = false
      AND gr.status = 'POSTED'
      AND p.code = 'SERIAL'
    `);

    const pendingLines = Number(pendingLinesCount[0]?.count || 0);
    const pendingSerials = Number(sumResult[0]?.total || 0);

    return {
      pendingLines,
      pendingSerials,
      isRunning: this.isRunning,
    };
  }
}

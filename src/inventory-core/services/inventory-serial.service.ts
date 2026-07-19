import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { ConfirmDeliveryDto } from '../dto/confirm-delivery.dto';
import { InventorySerialQueryDto } from '../dto/inventory-serial-query.dto';
import { UpdateInventorySerialDto } from '../dto/update-inventory-serial.dto';
import { UpdateSerialLifecycleDto } from '../dto/update-serial-lifecycle.dto';
import { ErpSerialLifecycle } from '../entities/erp_serial_lifecycle.entity';
import { ErpInventoryTrackingSerial } from '../entities/erp_inventory_tracking_serial.entity';
import { ErpSalesOrder } from '../../sales-orders-core/entities/erp_sales_order.entity';
import { ErpSalesOrderLine } from '../../sales-orders-core/entities/erp_sales_order_line.entity';
import { ErpVehicle } from '../../erp-mfg-core/entities/erp_vehicle.entity';

@Injectable()
export class InventorySerialService {
  constructor(
    @InjectRepository(ErpInventoryTrackingSerial)
    private readonly serialRepository: Repository<ErpInventoryTrackingSerial>,
    private readonly dataSource: DataSource,
  ) {}

  async listSerials(query: InventorySerialQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const qb = this.serialRepository
      .createQueryBuilder('s')
      .select([
        's.id as s_id',
        's.serial_no as s_serial_no',
        's.item_id as s_item_id',
        's.vin_id as s_vin_id',
        's.custom_id as s_custom_id',
        's.created_at as s_created_at',
        's.updated_at as s_updated_at',
        's.lot_no as s_lot_no',
        's.notes as s_notes',
        's.attributes as s_attributes',
        's.status as s_status',
        's.sales_order_line_id as s_sales_order_line_id',
        'so.id as so_id',
        'so.so_no as so_no',
        'so.expected_delivery_date as so_delivery_date',
        'i.id as i_id',
        'i.sku as i_sku',
        'i.item_name as i_item_name',
        'i.item_type_id as i_item_type',
        'i.tracking_policy_id as i_tracking_policy_id',
        'i.tracking_category_id as i_tracking_category_id',
        'v.vin_no as v_vin_no',
        'v.engine_no as v_engine_no',
        'tp.name as tp_name',
      ])
      .leftJoin('erp_inventory_items', 'i', 's.item_id = i.id')
      .leftJoin('erp_vehicles', 'v', 's.vin_id = v.id')
      .leftJoin('erp_tracking_policies', 'tp', 'i.tracking_policy_id = tp.id')
      .leftJoin(
        'erp_sales_order_lines',
        'sol',
        's.sales_order_line_id = sol.id',
      )
      .leftJoin('erp_sales_orders', 'so', 'sol.sales_order_id = so.id');

    if (query.ids) {
      const idsArr = Array.isArray(query.ids)
        ? query.ids
        : query.ids.split(',');
      if (idsArr.length > 0) {
        qb.andWhere('s.id IN (:...ids)', { ids: idsArr });
      }
    }

    if (query.missingSerial === true || query.missingSerial === 'true') {
      qb.andWhere('s.serial_no IS NULL');
    }

    if (query.itemId) {
      qb.andWhere('s.item_id = :itemId', { itemId: query.itemId });
    }

    if (query.status) {
      qb.andWhere('s.status = :status', { status: query.status });
    }

    if (query.salesOrderLineId) {
      qb.andWhere('s.sales_order_line_id = :solId', {
        solId: query.salesOrderLineId,
      });
    }

    if (query.itemTypeId) {
      qb.andWhere('i.item_type_id = :itemType', { itemType: query.itemTypeId });
    } else {
      // If no itemType is provided, we can either default to FG or return all.
      // Based on user request, track ANY item that allows tracking, so no default filter needed here.
    }

    if (query.trackingPolicy) {
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM erp_tracking_policies tp
          WHERE tp.id = i.tracking_policy_id
          AND tp.code = :trackingPolicy
        )`,
        { trackingPolicy: query.trackingPolicy },
      );
    } else {
      // By default, only return items with a tracking policy assigned (not NONE/null)
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM erp_tracking_policies tp
          WHERE tp.id = i.tracking_policy_id
          AND tp.code != 'NONE'
        )`,
      );
    }

    if (query.search) {
      qb.andWhere(
        '(s.serial_no ILIKE :search OR i.item_name ILIKE :search OR i.sku ILIKE :search OR v.vin_no ILIKE :search OR v.engine_no ILIKE :search OR so.so_no ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    // sort
    let sortColumn = 's.created_at';
    let sortDirection: 'ASC' | 'DESC' = 'DESC';
    if (query.sort && query.sort.length > 0) {
      let sortField = query.sort[0];
      if (sortField.startsWith('-')) {
        sortDirection = 'DESC';
        sortField = sortField.substring(1);
      } else {
        sortDirection = 'ASC';
      }
      if (sortField === 'serial_no') sortColumn = 's.serial_no';
      if (sortField === 'created_at') sortColumn = 's.created_at';
    }

    qb.orderBy(sortColumn, sortDirection);
    qb.offset((page - 1) * pageSize).limit(pageSize);

    const [itemsRaw, total] = await Promise.all([
      qb.getRawMany(),
      qb.getCount(),
    ]);
    const fixTimezone = (dateOrString: any): string | null => {
      if (!dateOrString) return null;
      if (typeof dateOrString === 'string') {
        let s = dateOrString;
        if (!s.endsWith('Z') && !s.match(/[+-]\d{2}:\d{2}$/)) {
          if (s.includes(' ')) s = s.replace(' ', 'T');
          return s + 'Z';
        }
        return s;
      }
      if (dateOrString instanceof Date) {
        const y = dateOrString.getFullYear();
        const m = String(dateOrString.getMonth() + 1).padStart(2, '0');
        const d = String(dateOrString.getDate()).padStart(2, '0');
        const h = String(dateOrString.getHours()).padStart(2, '0');
        const min = String(dateOrString.getMinutes()).padStart(2, '0');
        const sec = String(dateOrString.getSeconds()).padStart(2, '0');
        const ms = String(dateOrString.getMilliseconds()).padStart(3, '0');
        return `${y}-${m}-${d}T${h}:${min}:${sec}.${ms}Z`;
      }
      return null;
    };

    // Map raw results to standard format
    const items = itemsRaw.map((raw) => ({
      id: raw.s_id,
      serialNo: raw.s_serial_no,
      itemId: raw.s_item_id,
      vinId: raw.s_vin_id,
      vinNo: raw.v_vin_no,
      engineNo: raw.v_engine_no,
      customId: raw.s_custom_id,
      lotNo: raw.s_lot_no,
      notes: raw.s_notes,
      attributes: raw.s_attributes,
      status: raw.s_status,
      salesOrderLineId: raw.s_sales_order_line_id,
      soId: raw.so_id,
      soNo: raw.so_no,
      createdAt: fixTimezone(raw.s_created_at),
      updatedAt: fixTimezone(raw.s_updated_at),
      item: {
        id: raw.i_id,
        sku: raw.i_sku,
        itemName: raw.i_item_name,
        itemType: raw.i_item_type,
        trackingPolicyId: raw.i_tracking_policy_id,
        trackingCategoryId: raw.i_tracking_category_id,
        trackingPolicyName: raw.tp_name,
      },
      lifecycle: {
        deliveryDate: raw.so_delivery_date
          ? fixTimezone(raw.so_delivery_date)
          : null,
      },
    }));

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getSerial(id: string) {
    const serial = await this.serialRepository.findOne({
      where: { id },
    });
    if (!serial)
      throw new NotFoundException(`Tracking serial '${id}' không tồn tại`);

    // Fetch related item manually since it's not a direct TypeORM relation mapping yet
    const itemRaw = await this.serialRepository.manager.query(
      `
      SELECT i.id, i.sku, i.item_name, i.item_type_id, i.tracking_policy_id, i.tracking_category_id, tp.name as tp_name
      FROM erp_inventory_items i
      LEFT JOIN erp_tracking_policies tp ON i.tracking_policy_id = tp.id
      WHERE i.id = $1
      `,
      [serial.itemId],
    );

    let vinNo = null;
    let engineNo = null;
    if (serial.vinId) {
      const vinRaw = await this.serialRepository.manager.query(
        `SELECT vin_no, engine_no FROM erp_vehicles WHERE id = $1`,
        [serial.vinId],
      );
      if (vinRaw[0]) {
        vinNo = vinRaw[0].vin_no;
        engineNo = vinRaw[0].engine_no;
      }
    }

    const itemObj = itemRaw[0]
      ? {
          id: itemRaw[0].id,
          sku: itemRaw[0].sku,
          itemName: itemRaw[0].item_name,
          itemType: itemRaw[0].item_type_id,
          trackingPolicyId: itemRaw[0].tracking_policy_id,
          trackingCategoryId: itemRaw[0].tracking_category_id,
          trackingPolicyName: itemRaw[0].tp_name,
        }
      : null;

    const result: any = {
      id: serial.id,
      serialNo: serial.serialNo,
      itemId: serial.itemId,
      vinId: serial.vinId,
      vinNo,
      engineNo,
      customId: serial.customId,
      lotNo: serial.lotNo,
      notes: serial.notes,
      attributes: serial.attributes,
      createdAt: serial.createdAt,
      updatedAt: serial.updatedAt,
      item: itemObj,
      lifecycle: null,
    };

    const lifecycleRepo =
      this.serialRepository.manager.getRepository(ErpSerialLifecycle);
    const lifecycle = await lifecycleRepo.findOne({ where: { serialId: id } });
    if (lifecycle) {
      result.lifecycle = lifecycle;
    }

    return result;
  }

  async updateSerial(id: string, dto: UpdateInventorySerialDto) {
    const serial = await this.serialRepository.findOne({ where: { id } });
    if (!serial) {
      throw new NotFoundException(`Tracking serial '${id}' không tồn tại`);
    }
    if (dto.notes !== undefined) serial.notes = dto.notes;
    if (dto.attributes !== undefined) serial.attributes = dto.attributes;
    await this.serialRepository.save(serial);
    return serial;
  }

  async confirmDelivery(serialId: string, dto: ConfirmDeliveryDto) {
    return this.dataSource.transaction(async (manager) => {
      const serialRepo = manager.getRepository(ErpInventoryTrackingSerial);
      const vehicleRepo = manager.getRepository(ErpVehicle);
      const lifecycleRepo = manager.getRepository(ErpSerialLifecycle);
      const soRepo = manager.getRepository(ErpSalesOrder);
      const soLineRepo = manager.getRepository(ErpSalesOrderLine);

      const serial = await serialRepo.findOne({ where: { id: serialId } });
      if (!serial) {
        throw new NotFoundException(
          `Tracking serial '${serialId}' không tồn tại`,
        );
      }

      const lifecycle = await lifecycleRepo.findOne({ where: { serialId } });
      if (!lifecycle) {
        throw new NotFoundException(
          `Lifecycle cho serial '${serialId}' không tồn tại`,
        );
      }
      lifecycle.deliveryDate = dto.deliveryDate;
      if (dto.notes !== undefined) {
        lifecycle.notes = dto.notes;
      }
      await lifecycleRepo.save(lifecycle);

      serial.status = 'SOLD';
      await serialRepo.save(serial);

      if (serial.vinId) {
        const vehicle = await vehicleRepo.findOne({
          where: { id: serial.vinId },
        });
        if (vehicle) {
          vehicle.status = 'SOLD';
          await vehicleRepo.save(vehicle);
        }
      }

      if (serial.salesOrderLineId) {
        const soLine = await soLineRepo.findOne({
          where: { id: serial.salesOrderLineId },
        });
        if (soLine?.salesOrderId) {
          const so = await soRepo.findOne({
            where: { id: soLine.salesOrderId },
          });
          if (so) {
            const lines = await soLineRepo.find({
              where: { salesOrderId: so.id },
            });
            const lineIds = lines.map((l) => l.id);
            if (lineIds.length > 0) {
              const allSerials = await serialRepo.find({
                where: { salesOrderLineId: In(lineIds) },
              });
              const anyDelivering = allSerials.some(
                (s) => s.status === 'DELIVERING',
              );
              if (anyDelivering) {
                so.status = 'DELIVERING';
              } else {
                so.status = 'DELIVERED';
              }
              await soRepo.save(so);
            }
          }
        }
      }

      return lifecycle;
    });
  }

  async updateSerialLifecycle(serialId: string, dto: UpdateSerialLifecycleDto) {
    const lifecycleRepo =
      this.serialRepository.manager.getRepository(ErpSerialLifecycle);
    const lifecycle = await lifecycleRepo.findOne({ where: { serialId } });
    if (!lifecycle) {
      throw new NotFoundException(
        `Lifecycle cho serial '${serialId}' không tồn tại`,
      );
    }

    if (dto.customerName !== undefined)
      lifecycle.customerName = dto.customerName;
    if (dto.customerPhone !== undefined)
      lifecycle.customerPhone = dto.customerPhone;
    if (dto.customerAddress !== undefined)
      lifecycle.customerAddress = dto.customerAddress;
    if (dto.customerIdNumber !== undefined)
      lifecycle.customerIdNumber = dto.customerIdNumber;
    if (dto.warrantyActivatedAt !== undefined) {
      lifecycle.warrantyActivatedAt = dto.warrantyActivatedAt
        ? new Date(dto.warrantyActivatedAt)
        : null;
    }
    if (dto.warrantyMonths !== undefined)
      lifecycle.warrantyMonths = dto.warrantyMonths;
    if (dto.notes !== undefined) lifecycle.notes = dto.notes;
    if (dto.dealerName !== undefined) {
      lifecycle.attributes = lifecycle.attributes || {};
      lifecycle.attributes.dealer_name = dto.dealerName;
    }
    if (dto.dealerId !== undefined) {
      lifecycle.dealerId = dto.dealerId ? dto.dealerId : null;
    }

    // Recalculate warranty_end_date if needed
    if (lifecycle.warrantyActivatedAt && lifecycle.warrantyMonths) {
      const endDate = new Date(lifecycle.warrantyActivatedAt);
      endDate.setMonth(endDate.getMonth() + lifecycle.warrantyMonths);
      lifecycle.warrantyEndDate = endDate.toISOString().split('T')[0];
    }

    await lifecycleRepo.save(lifecycle);
    return lifecycle;
  }

  async getSerialLifecycleColumnOptions(
    column: string,
    search: string,
    page: number = 1,
    pageSize: number = 20,
    filtersStr?: string,
  ) {
    let selectField = '';
    let isDateColumn = false;

    if (column === 'expectedDeliveryDate') {
      selectField = "TO_CHAR(so.expected_delivery_date, 'YYYY-MM-DD')";
      isDateColumn = true;
    } else if (column === 'deliveryDate') {
      selectField = "TO_CHAR(l.delivery_date, 'YYYY-MM-DD')";
      isDateColumn = true;
    } else if (column === 'itemName') selectField = 'i.item_name';
    else if (column === 'serialNo') selectField = 's.serial_no';
    else if (column === 'vinNo') selectField = 'v.vin_no';
    else if (column === 'engineNo') selectField = 'v.engine_no';
    else if (column === 'soNo') selectField = 'so.so_no';
    else if (column === 'customerName') selectField = 'l.customer_name';
    else if (column === 'activationDate') {
      selectField = "TO_CHAR(l.warranty_activated_at, 'YYYY-MM-DD')";
      isDateColumn = true;
    } else if (column === 'dealerName') {
      selectField = "l.attributes->>'dealer_name'";
    } else if (column === 'color') {
      selectField = "s.attributes->>'color'";
    } else {
      return { items: [], total: 0, page, pageSize, totalPages: 0 };
    }

    let sql = `
      SELECT DISTINCT ${selectField} as value
      FROM erp_serial_lifecycles l
      JOIN erp_inventory_tracking_serials s ON l.serial_id = s.id
      JOIN erp_inventory_items i ON s.item_id = i.id
      LEFT JOIN erp_vehicles v ON s.vin_id = v.id
      LEFT JOIN erp_sales_orders so ON l.sales_order_id = so.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIdx = 1;

    if (isDateColumn) {
      sql += ` AND ${selectField} IS NOT NULL AND ${selectField} != ''`;
    } else {
      sql += ` AND ${selectField} IS NOT NULL AND CAST(${selectField} AS TEXT) != ''`;
    }

    if (filtersStr) {
      try {
        const filters = JSON.parse(filtersStr) as Record<string, string[]>;
        for (const [col, vals] of Object.entries(filters)) {
          if (!vals || vals.length === 0) continue;
          if (col === column) continue;

          let filterField = '';
          if (col === 'expectedDeliveryDate')
            filterField = "TO_CHAR(so.expected_delivery_date, 'YYYY-MM-DD')";
          else if (col === 'deliveryDate')
            filterField = "TO_CHAR(l.delivery_date, 'YYYY-MM-DD')";
          else if (col === 'itemName') filterField = 'i.item_name';
          else if (col === 'serialNo') filterField = 's.serial_no';
          else if (col === 'vinNo') filterField = 'v.vin_no';
          else if (col === 'engineNo') filterField = 'v.engine_no';
          else if (col === 'soNo') filterField = 'so.so_no';
          else if (col === 'customerName') filterField = 'l.customer_name';
          else if (col === 'color') filterField = "s.attributes->>'color'";
          else if (col === 'activationDate')
            filterField = "TO_CHAR(l.warranty_activated_at, 'YYYY-MM-DD')";
          else if (col === 'dealerName')
            filterField = "l.attributes->>'dealer_name'";

          if (filterField) {
            const placeholders = vals.map(() => `$${paramIdx++}`).join(', ');
            sql += ` AND CAST(${filterField} AS TEXT) IN (${placeholders})`;
            params.push(...vals);
          }
        }
      } catch (e) {}
    }

    if (search) {
      const keywords = String(search)
        .split(';')
        .map((k) => k.trim())
        .filter((k) => k);
      if (keywords.length > 0) {
        const conditions: string[] = [];
        for (const kw of keywords) {
          conditions.push(`CAST(${selectField} AS TEXT) ILIKE $${paramIdx++}`);
          params.push(`%${kw}%`);
        }
        sql += ` AND (${conditions.join(' OR ')})`;
      }
    }

    // Count Total
    const countSql = `SELECT COUNT(*) as cnt FROM (${sql}) as t`;
    const countRes = await this.serialRepository.manager.query(
      countSql,
      params,
    );
    const total = parseInt(countRes[0]?.cnt || '0', 10);

    // Get Data
    sql += ` ORDER BY value ASC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(pageSize, (page - 1) * pageSize);
    const results = await this.serialRepository.manager.query(sql, params);

    return {
      items: results.map((r: any) => String(r.value)).filter(Boolean),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async listSerialLifecycles(query: any) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 50;
    const skip = (page - 1) * pageSize;

    let sql = `
      SELECT 
        l.id as lifecycle_id, l.status, l.delivery_date, l.customer_name, l.customer_phone,
        l.warranty_activated_at, l.warranty_months, l.warranty_end_date, l.dealer_id, l.sales_order_id, l.attributes,
        s.id as serial_id, s.serial_no, s.item_id, s.vin_id, s.attributes as tracking_attributes,
        i.sku, i.item_name,
        v.vin_no, v.engine_no,
        so.so_no, so.expected_delivery_date as expected_delivery_date
      FROM erp_serial_lifecycles l
      JOIN erp_inventory_tracking_serials s ON l.serial_id = s.id
      JOIN erp_inventory_items i ON s.item_id = i.id
      LEFT JOIN erp_vehicles v ON s.vin_id = v.id
      LEFT JOIN erp_sales_orders so ON l.sales_order_id = so.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIdx = 1;

    if (query.status) {
      sql += ` AND s.status = $${paramIdx++}`;
      params.push(query.status);
    }

    if (query.deliveryDateFrom) {
      sql += ` AND l.delivery_date >= $${paramIdx++}`;
      params.push(query.deliveryDateFrom);
    }

    if (query.deliveryDateTo) {
      sql += ` AND l.delivery_date <= $${paramIdx++}`;
      params.push(query.deliveryDateTo);
    }

    if (query.search) {
      sql += ` AND (
        s.serial_no ILIKE $${paramIdx} OR 
        v.vin_no ILIKE $${paramIdx} OR 
        l.customer_name ILIKE $${paramIdx} OR 
        l.customer_phone ILIKE $${paramIdx}
      )`;
      params.push(`%${query.search}%`);
      paramIdx++;
    }

    if (query.warrantyStatus === 'NOT_ACTIVATED') {
      sql += ` AND l.warranty_activated_at IS NULL`;
    } else if (query.warrantyStatus === 'ACTIVE') {
      sql += ` AND l.warranty_activated_at IS NOT NULL AND (l.warranty_end_date IS NULL OR l.warranty_end_date >= CURRENT_DATE)`;
    } else if (query.warrantyStatus === 'EXPIRED') {
      sql += ` AND l.warranty_end_date < CURRENT_DATE`;
    }

    if (query.dealerId) {
      sql += ` AND l.dealer_id = $${paramIdx++}`;
      params.push(query.dealerId);
    }

    // Dynamic Column Filters
    if (query.column_filters) {
      try {
        const filters = JSON.parse(query.column_filters);
        for (const [col, vals] of Object.entries(filters)) {
          const valsArray = vals as string[];
          if (!valsArray || valsArray.length === 0) continue;

          let filterField = '';
          if (col === 'expectedDeliveryDate')
            filterField = "TO_CHAR(so.expected_delivery_date, 'YYYY-MM-DD')";
          else if (col === 'deliveryDate')
            filterField = "TO_CHAR(l.delivery_date, 'YYYY-MM-DD')";
          else if (col === 'itemName') filterField = 'i.item_name';
          else if (col === 'serialNo') filterField = 's.serial_no';
          else if (col === 'vinNo') filterField = 'v.vin_no';
          else if (col === 'engineNo') filterField = 'v.engine_no';
          else if (col === 'soNo') filterField = 'so.so_no';
          else if (col === 'customerName') filterField = 'l.customer_name';
          else if (col === 'color') filterField = "s.attributes->>'color'";
          else if (col === 'activationDate')
            filterField = "TO_CHAR(l.warranty_activated_at, 'YYYY-MM-DD')";
          else if (col === 'dealerName')
            filterField = "l.attributes->>'dealer_name'";
          else if (col === 'warrantyActivatedAt') {
            const conditions: string[] = [];
            if (valsArray.includes('ACTIVE')) {
              conditions.push(
                `(l.warranty_activated_at IS NOT NULL AND (l.warranty_end_date IS NULL OR l.warranty_end_date >= CURRENT_DATE))`,
              );
            }
            if (valsArray.includes('EXPIRED')) {
              conditions.push(`(l.warranty_end_date < CURRENT_DATE)`);
            }
            if (valsArray.includes('NOT_ACTIVATED')) {
              conditions.push(`(l.warranty_activated_at IS NULL)`);
            }
            if (conditions.length > 0) {
              sql += ` AND (${conditions.join(' OR ')})`;
            }
            continue;
          }

          if (filterField) {
            const placeholders = valsArray
              .map(() => `$${paramIdx++}`)
              .join(', ');
            sql += ` AND CAST(${filterField} AS TEXT) IN (${placeholders})`;
            params.push(...valsArray);
          }
        }
      } catch (e) {}
    }

    // Dynamic Column Search
    if (query.column_search) {
      try {
        const searchFilters = JSON.parse(query.column_search);
        for (const [col, val] of Object.entries(searchFilters)) {
          if (!val) continue;

          let searchField = '';
          if (col === 'expectedDeliveryDate')
            searchField = "TO_CHAR(so.expected_delivery_date, 'YYYY-MM-DD')";
          else if (col === 'deliveryDate')
            searchField = "TO_CHAR(l.delivery_date, 'YYYY-MM-DD')";
          else if (col === 'itemName') searchField = 'i.item_name';
          else if (col === 'serialNo') searchField = 's.serial_no';
          else if (col === 'vinNo') searchField = 'v.vin_no';
          else if (col === 'engineNo') searchField = 'v.engine_no';
          else if (col === 'soNo') searchField = 'so.so_no';
          else if (col === 'customerName') searchField = 'l.customer_name';
          else if (col === 'color') searchField = "s.attributes->>'color'";
          else if (col === 'activationDate')
            searchField = "TO_CHAR(l.warranty_activated_at, 'YYYY-MM-DD')";
          else if (col === 'dealerName')
            searchField = "l.attributes->>'dealer_name'";

          if (searchField) {
            // Apply multi keyword filter logic using ';' as separator and OR logic
            const keywords = (val as string)
              .split(';')
              .map((k) => k.trim())
              .filter((k) => k);
            if (keywords.length > 0) {
              const conditions: string[] = [];
              for (const kw of keywords) {
                conditions.push(
                  `CAST(${searchField} AS TEXT) ILIKE $${paramIdx++}`,
                );
                params.push(`%${kw}%`);
              }
              sql += ` AND (${conditions.join(' OR ')})`;
            }
          }
        }
      } catch (e) {}
    }

    // Count
    const countSql = `SELECT COUNT(*) as count FROM (${sql}) as t`;
    const countRes = await this.serialRepository.manager.query(
      countSql,
      params,
    );
    const total = parseInt(countRes[0].count, 10);

    // Data
    let orderByClause =
      'ORDER BY l.delivery_date DESC NULLS LAST, l.created_at DESC';
    if (query.sortField && query.sortOrder) {
      const dir = query.sortOrder === 'asc' ? 'ASC' : 'DESC';
      let sortCol = '';
      switch (query.sortField) {
        case 'deliveryDate':
          sortCol = 'l.delivery_date';
          break;
        case 'expectedDeliveryDate':
          sortCol = 'so.expected_delivery_date';
          break;
        case 'activationDate':
          sortCol = 'l.warranty_activated_at';
          break;
      }
      if (sortCol) {
        orderByClause = `ORDER BY ${sortCol} ${dir} NULLS LAST, l.created_at DESC`;
      }
    }

    sql += ` ${orderByClause} LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(pageSize, skip);

    const data = await this.serialRepository.manager.query(sql, params);

    // Map to camelCase
    const items = data.map((row: any) => ({
      lifecycleId: row.lifecycle_id,
      serialId: row.serial_id,
      status: row.status,
      deliveryDate: row.delivery_date,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      warrantyActivatedAt: row.warranty_activated_at,
      warrantyMonths: row.warranty_months,
      warrantyEndDate: row.warranty_end_date,
      serialNo: row.serial_no,
      itemId: row.item_id,
      sku: row.sku,
      itemName: row.item_name,
      vinNo: row.vin_no,
      engineNo: row.engine_no,
      salesOrderId: row.sales_order_id,
      soNo: row.so_no,
      expectedDeliveryDate: row.expected_delivery_date,
      dealerId: row.dealer_id,
      dealerName: row.attributes?.dealer_name || null,
      trackingAttributes: row.tracking_attributes || null,
      warrantyCode: row.warranty_activated_at
        ? `WRN-${new Date(row.warranty_activated_at).toISOString().slice(0, 10).replace(/-/g, '')}-${(row.vin_no || row.serial_no || '000000').slice(-6)}`
        : null,
    }));

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}

import * as crypto from 'crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErpVehicle } from '../erp-mfg-core/entities/erp_vehicle.entity';
import { ErpInventoryTrackingSerial } from '../inventory-core/entities/erp_inventory_tracking_serial.entity';
import { ErpSerialLifecycle } from '../inventory-core/entities/erp_serial_lifecycle.entity';
import { ErpBusinessPartner } from '../business-partners-core/entities/erp_business_partner.entity';
import { CheckWarrantyDto } from './dto/check-warranty.dto';
import { ActivateWarrantyDto } from './dto/activate-warranty.dto';

@Injectable()
export class PublicWarrantyService {
  constructor(
    @InjectRepository(ErpVehicle)
    private readonly vehicleRepo: Repository<ErpVehicle>,
    @InjectRepository(ErpInventoryTrackingSerial)
    private readonly trackingSerialRepo: Repository<ErpInventoryTrackingSerial>,
    @InjectRepository(ErpSerialLifecycle)
    private readonly lifecycleRepo: Repository<ErpSerialLifecycle>,
    @InjectRepository(ErpBusinessPartner)
    private readonly businessPartnerRepo: Repository<ErpBusinessPartner>,
  ) {}

  private normalize(val: string): string {
    return val?.trim().toUpperCase().replace(/[-\s]/g, '') || '';
  }

  async check(dto: CheckWarrantyDto) {
    const vin_no = this.normalize(dto.vin_no);
    const engine_no = this.normalize(dto.engine_no);

    const vehicle = await this.vehicleRepo.findOne({
      where: { vinNo: vin_no, engineNo: engine_no },
    });

    if (!vehicle) {
      // --- TEMPORARY WORKAROUND (GHOST LIFECYCLE) ---
      // If the vehicle does not exist in the DB, check if it was previously activated as a 'ghost'.
      // This ensures we do not block customers from activating warranties, while avoiding
      // polluting the erp_vehicles and erp_inventory_tracking_serials tables before the
      // official manufacturing flow creates the real records.
      const ghostLifecycle = await this.lifecycleRepo
        .createQueryBuilder('l')
        .where("l.attributes->>'is_ghost' = 'true'")
        .andWhere("l.attributes->>'ghost_vin' = :vin", { vin: vin_no })
        .andWhere("l.attributes->>'ghost_engine' = :engine", {
          engine: engine_no,
        })
        .andWhere("l.status = 'ACTIVE'")
        .getOne();

      if (ghostLifecycle && ghostLifecycle.warrantyActivatedAt) {
        return {
          found: true,
          eligible: true,
          vehicle: {
            vin_no,
            engine_no,
            model_name: 'Unknown',
            warranty_status: 'ACTIVE',
          },
          active_warranty: {
            warranty_code: `WRN-${ghostLifecycle.warrantyActivatedAt.toISOString().slice(0, 10).replace(/-/g, '')}-${vin_no.slice(-6)}`,
            status: ghostLifecycle.status,
            activated_at: ghostLifecycle.warrantyActivatedAt.toISOString(),
            warranty_end_date: ghostLifecycle.warrantyEndDate,
            customer_name: ghostLifecycle.customerName,
            customer_phone: ghostLifecycle.customerPhone,
            customer_address: ghostLifecycle.customerAddress,
            dealer_name: ghostLifecycle.attributes?.dealer_name,
          },
        };
      }

      return {
        found: true,
        eligible: true,
        reason: 'UNVERIFIED_VEHICLE',
        vehicle: {
          vin_no,
          engine_no,
          model_name: 'Unknown',
          warranty_status: 'NOT_ACTIVATED',
        },
        active_warranty: null,
      };
    }

    const trackingSerial = await this.trackingSerialRepo.findOne({
      where: { vinId: vehicle.id },
    });

    if (!trackingSerial) {
      return {
        found: false,
        reason: 'NOT_IN_SYSTEM',
        vehicle: null,
        active_warranty: null,
      };
    }

    if (trackingSerial.status !== 'SOLD') {
      return {
        found: true,
        eligible: false,
        reason: 'NOT_DELIVERED',
        vehicle: {
          vin_no: vehicle.vinNo,
          engine_no: vehicle.engineNo,
          model_name: 'KL Lotus',
          warranty_status: 'NOT_ACTIVATED',
        },
        active_warranty: null,
      };
    }

    let active_warranty: any = null;
    if (trackingSerial) {
      const lifecycle = await this.lifecycleRepo.findOne({
        where: { serialId: trackingSerial.id, status: 'ACTIVE' },
      });

      if (lifecycle && lifecycle.warrantyActivatedAt) {
        active_warranty = {
          warranty_code: `WRN-${lifecycle.warrantyActivatedAt.toISOString().slice(0, 10).replace(/-/g, '')}-${vin_no.slice(-6)}`,
          status: lifecycle.status,
          activated_at: lifecycle.warrantyActivatedAt.toISOString(),
          warranty_end_date: lifecycle.warrantyEndDate,
          customer_name: lifecycle.customerName,
          customer_phone: lifecycle.customerPhone,
          customer_address: lifecycle.customerAddress,
          dealer_name: lifecycle.attributes?.dealer_name,
        };
      }
    }

    return {
      found: true,
      eligible: true,
      vehicle: {
        vin_no: vehicle.vinNo,
        engine_no: vehicle.engineNo,
        model_name: 'KL Lotus', // Placeholder or relation
        warranty_status: active_warranty ? 'ACTIVE' : 'NOT_ACTIVATED',
      },
      active_warranty,
    };
  }

  async activate(dto: ActivateWarrantyDto) {
    const vin_no = this.normalize(dto.vin_no);
    const engine_no = this.normalize(dto.engine_no);

    let vehicle = await this.vehicleRepo.findOne({
      where: { vinNo: vin_no, engineNo: engine_no },
    });

    let trackingSerial: ErpInventoryTrackingSerial | null = null;
    if (vehicle) {
      trackingSerial = await this.trackingSerialRepo.findOne({
        where: { vinId: vehicle.id },
      });
      if (!trackingSerial) {
        throw new BadRequestException(
          'Xe chưa được ghi nhận trong hệ thống kho',
        );
      }
      if (trackingSerial.status !== 'SOLD') {
        throw new BadRequestException(
          'Xe chưa được bàn giao, không thể kích hoạt bảo hành. Vui lòng liên hệ đại lý.',
        );
      }
    }

    let lifecycle: ErpSerialLifecycle | null = null;
    let isGhost = false;

    // --- STANDARD FLOW ---
    // If the tracking serial exists, we use it. This preserves the original correct flow.
    if (trackingSerial) {
      lifecycle = await this.lifecycleRepo.findOne({
        where: { serialId: trackingSerial.id },
      });
    } else {
      // --- TEMPORARY WORKAROUND (GHOST LIFECYCLE) ---
      isGhost = true;
    }

    if (lifecycle && lifecycle.warrantyActivatedAt) {
      throw new BadRequestException('Xe này đã được kích hoạt bảo hành');
    }

    const now = new Date();
    const warrantyMonths = 36; // should be configurable
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + warrantyMonths);

    if (!lifecycle) {
      lifecycle = this.lifecycleRepo.create({
        serialId: trackingSerial ? trackingSerial.id : crypto.randomUUID(),
      });
    }

    const currentLifecycle = lifecycle!;

    if (isGhost || !currentLifecycle.dealerId) {
      // For unverified vehicle, or if dealer is missing, we try to assign from dto.dealer_id
      const assignedPartner = await this.businessPartnerRepo.findOne({
        where: { code: dto.dealer_id },
      });

      if (!assignedPartner) {
        throw new BadRequestException(
          'Mã đại lý không hợp lệ hoặc không tồn tại trong hệ thống.',
        );
      }
      currentLifecycle.dealerId = assignedPartner.id;
    } else {
      const ownerPartner = await this.businessPartnerRepo.findOne({
        where: { id: currentLifecycle.dealerId },
      });

      if (!ownerPartner || ownerPartner.code !== dto.dealer_id) {
        throw new BadRequestException(
          'Mã đại lý không hợp lệ hoặc không khớp với đại lý phân phối xe này.',
        );
      }
    }

    currentLifecycle.customerName = dto.customer_name;
    currentLifecycle.customerPhone = dto.customer_phone;
    currentLifecycle.customerAddress = dto.customer_address;
    currentLifecycle.warrantyActivatedAt = now;
    currentLifecycle.warrantyMonths = warrantyMonths;
    currentLifecycle.warrantyEndDate = endDate.toISOString().slice(0, 10);
    currentLifecycle.activationSource = 'LANDING_PAGE';
    currentLifecycle.status = 'ACTIVE';

    currentLifecycle.attributes = {
      ...(currentLifecycle.attributes || {}),
      customer_dob: dto.customer_dob,
      customer_email: dto.customer_email,
      dealer_name: dto.dealer_name,
      dealer_code: dto.dealer_id, // Store original code in case not found in BusinessPartners
    };

    if (isGhost) {
      currentLifecycle.attributes.is_ghost = true;
      currentLifecycle.attributes.ghost_vin = vin_no;
      currentLifecycle.attributes.ghost_engine = engine_no;
    }

    await this.lifecycleRepo.save(currentLifecycle);

    return {
      message: 'Kích hoạt bảo hành thành công',
      activation: {
        warranty_code: `WRN-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${vin_no.slice(-6)}`,
        activated_at: now.toISOString(),
        warranty_end_date: currentLifecycle.warrantyEndDate,
        status: 'ACTIVE',
        customer_name: currentLifecycle.customerName,
        customer_phone: currentLifecycle.customerPhone,
        customer_address: currentLifecycle.customerAddress,
        dealer_name: currentLifecycle.attributes?.dealer_name,
      },
    };
  }
}

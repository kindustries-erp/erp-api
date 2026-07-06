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
    return val?.trim().toUpperCase() || '';
  }

  async check(dto: CheckWarrantyDto) {
    const vin_no = this.normalize(dto.vin_no);
    const engine_no = this.normalize(dto.engine_no);

    const vehicle = await this.vehicleRepo.findOne({
      where: { vinNo: vin_no, engineNo: engine_no },
    });

    if (!vehicle) {
      return {
        found: false,
        reason: 'VEHICLE_NOT_FOUND',
        vehicle: null,
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

    const vehicle = await this.vehicleRepo.findOne({
      where: { vinNo: vin_no, engineNo: engine_no },
    });

    if (!vehicle) {
      throw new BadRequestException(
        'Không tìm thấy thông tin xe. Vui lòng kiểm tra lại số khung và số máy.',
      );
    }

    const trackingSerial = await this.trackingSerialRepo.findOne({
      where: { vinId: vehicle.id },
    });

    if (!trackingSerial) {
      throw new BadRequestException('Xe chưa được ghi nhận trong hệ thống');
    }

    if (trackingSerial.status !== 'SOLD') {
      throw new BadRequestException(
        'Xe chưa được bàn giao, không thể kích hoạt bảo hành. Vui lòng liên hệ đại lý.',
      );
    }

    let lifecycle = await this.lifecycleRepo.findOne({
      where: { serialId: trackingSerial.id },
    });

    if (lifecycle && lifecycle.warrantyActivatedAt) {
      throw new BadRequestException('Xe này đã được kích hoạt bảo hành');
    }

    const now = new Date();
    const warrantyMonths = 36; // should be configurable
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + warrantyMonths);

    if (!lifecycle) {
      lifecycle = this.lifecycleRepo.create({
        serialId: trackingSerial.id,
      });
    }

    let actualDealerId: string | null = null;
    if (dto.dealer_id) {
      const partner = await this.businessPartnerRepo.findOne({
        where: { code: dto.dealer_id },
      });
      if (partner) {
        actualDealerId = partner.id;
      }
    }

    lifecycle.dealerId = actualDealerId;
    lifecycle.customerName = dto.customer_name;
    lifecycle.customerPhone = dto.customer_phone;
    lifecycle.customerAddress = dto.customer_address;
    lifecycle.warrantyActivatedAt = now;
    lifecycle.warrantyMonths = warrantyMonths;
    lifecycle.warrantyEndDate = endDate.toISOString().slice(0, 10);
    lifecycle.activationSource = 'LANDING_PAGE';
    lifecycle.status = 'ACTIVE';

    if (
      dto.customer_dob ||
      dto.customer_email ||
      dto.dealer_name ||
      dto.dealer_id
    ) {
      lifecycle.attributes = {
        ...(lifecycle.attributes || {}),
        customer_dob: dto.customer_dob,
        customer_email: dto.customer_email,
        dealer_name: dto.dealer_name,
        dealer_code: dto.dealer_id, // Store original code in case not found in BusinessPartners
      };
    }

    await this.lifecycleRepo.save(lifecycle);

    return {
      message: 'Kích hoạt bảo hành thành công',
      activation: {
        warranty_code: `WRN-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${vin_no.slice(-6)}`,
        activated_at: now.toISOString(),
        warranty_end_date: lifecycle.warrantyEndDate,
        status: 'ACTIVE',
        customer_name: lifecycle.customerName,
        customer_phone: lifecycle.customerPhone,
        customer_address: lifecycle.customerAddress,
        dealer_name: lifecycle.attributes?.dealer_name,
      },
    };
  }
}

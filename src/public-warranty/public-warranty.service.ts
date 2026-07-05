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
    const sokhung = this.normalize(dto.sokhung);
    const somay = this.normalize(dto.somay);

    let vehicle = await this.vehicleRepo.findOne({
      where: { vinNo: sokhung, engineNo: somay },
    });

    if (!vehicle) {
      // Fallback: check by vinNo only
      vehicle = await this.vehicleRepo.findOne({
        where: { vinNo: sokhung },
      });
    }

    if (!vehicle) {
      return { found: false, vehicle: null, active_warranty: null };
    }

    const trackingSerial = await this.trackingSerialRepo.findOne({
      where: { vinId: vehicle.id },
    });

    let active_warranty: any = null;
    if (trackingSerial) {
      const lifecycle = await this.lifecycleRepo.findOne({
        where: { serialId: trackingSerial.id, status: 'ACTIVE' },
      });

      if (lifecycle && lifecycle.warrantyActivatedAt) {
        active_warranty = {
          warranty_code: `WRN-${lifecycle.warrantyActivatedAt.toISOString().slice(0, 10).replace(/-/g, '')}-${sokhung.slice(-6)}`,
          status: lifecycle.status,
          activated_at: lifecycle.warrantyActivatedAt.toISOString(),
          warranty_end_date: lifecycle.warrantyEndDate,
        };
      }
    }

    return {
      found: true,
      vehicle: {
        frame_no: vehicle.vinNo,
        engine_no: vehicle.engineNo,
        model_name: 'KL Lotus', // Placeholder or relation
        warranty_status: active_warranty ? 'ACTIVE' : 'NOT_ACTIVATED',
      },
      active_warranty,
    };
  }

  async activate(dto: ActivateWarrantyDto) {
    const sokhung = this.normalize(dto.sokhung);
    const somay = this.normalize(dto.somay);

    let vehicle = await this.vehicleRepo.findOne({
      where: { vinNo: sokhung, engineNo: somay },
    });

    if (!vehicle) {
      vehicle = await this.vehicleRepo.findOne({
        where: { vinNo: sokhung },
      });
    }

    if (!vehicle) {
      // Create dummy vehicle if not found
      vehicle = this.vehicleRepo.create({
        vinNo: sokhung,
        engineNo: somay,
        status: 'ASSEMBLED',
      });
      await this.vehicleRepo.save(vehicle);
    }

    let trackingSerial = await this.trackingSerialRepo.findOne({
      where: { vinId: vehicle.id },
    });

    if (!trackingSerial) {
      trackingSerial = this.trackingSerialRepo.create({
        serialNo: somay,
        vinId: vehicle.id,
        status: 'IN_STOCK',
      });
      await this.trackingSerialRepo.save(trackingSerial);
    }

    let lifecycle = await this.lifecycleRepo.findOne({
      where: { serialId: trackingSerial.id },
    });

    if (lifecycle && lifecycle.warrantyActivatedAt) {
      throw new BadRequestException('Xe này đã được kích hoạt bảo hành');
    }

    const now = new Date();
    const warrantyMonths = 24; // should be configurable
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
        warranty_code: `WRN-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${sokhung.slice(-6)}`,
        activated_at: now.toISOString(),
        warranty_end_date: lifecycle.warrantyEndDate,
        status: 'ACTIVE',
      },
    };
  }
}

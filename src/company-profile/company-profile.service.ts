import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanyProfile } from './entities/company-profile.entity';
import { UpdateCompanyProfileDto } from './dto/update-company-profile.dto';

@Injectable()
export class CompanyProfileService {
  private readonly logger = new Logger(CompanyProfileService.name);

  constructor(
    @InjectRepository(CompanyProfile)
    private readonly companyProfileRepository: Repository<CompanyProfile>,
  ) {}

  async getProfile(): Promise<CompanyProfile> {
    try {
      let profile = await this.companyProfileRepository.findOne({
        where: {},
        order: { created_at: 'ASC' },
      });

      if (!profile) {
        // Create an empty profile if none exists
        const newProfile = this.companyProfileRepository.create({
          company_name: 'Your Company Name',
        });
        profile = await this.companyProfileRepository.save(newProfile);
      }

      return profile;
    } catch (error) {
      this.logger.error('Error fetching company profile', error);
      throw new InternalServerErrorException('Could not fetch company profile');
    }
  }

  async updateProfile(dto: UpdateCompanyProfileDto): Promise<CompanyProfile> {
    try {
      const profile = await this.getProfile();

      if (dto.company_name !== undefined)
        profile.company_name = dto.company_name;
      if (dto.tax_code !== undefined) profile.tax_code = dto.tax_code;
      if (dto.address !== undefined) profile.address = dto.address;
      if (dto.mobi_phone !== undefined) profile.mobi_phone = dto.mobi_phone;
      if (dto.email !== undefined) profile.email = dto.email;
      if (dto.note !== undefined) profile.note = dto.note;
      if (dto.logo !== undefined) profile.logo = dto.logo;

      return await this.companyProfileRepository.save(profile);
    } catch (error) {
      this.logger.error('Error updating company profile', error);
      throw new InternalServerErrorException(
        'Could not update company profile',
      );
    }
  }
}

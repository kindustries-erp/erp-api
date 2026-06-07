import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { compareSync, genSaltSync, hashSync } from 'bcryptjs';
import { Repository } from 'typeorm';
import { CoreUser } from './entities/core-user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(CoreUser)
    private readonly usersRepository: Repository<CoreUser>,
  ) {}

  hashPassword(password: string) {
    const salt = genSaltSync(10);
    return hashSync(password, salt);
  }

  verifyPassword(password: string, passwordHash: string) {
    return compareSync(password, passwordHash);
  }

  findByEmail(email: string) {
    return this.usersRepository.findOne({
      where: { email: email.toLowerCase().trim() },
    });
  }

  async findById(id: string) {
    return this.usersRepository.findOne({ where: { id } });
  }

  async createSeedUserIfMissing(email: string, password: string) {
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await this.findByEmail(normalizedEmail);
    if (existing) return existing;

    const user = this.usersRepository.create({
      email: normalizedEmail,
      passwordHash: this.hashPassword(password),
      status: 'ACTIVE',
      employeeId: null,
      legacyDirectusUserId: null,
    });
    return this.usersRepository.save(user);
  }
}

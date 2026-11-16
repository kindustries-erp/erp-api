import { Injectable } from '@nestjs/common';
import type { FileOwnerPolicyPort } from '../contracts/file-owner-policy.port';
import type { FileOwnerType } from '../types/file-owner.types';

/** Sổ đăng ký owner policy. Module của owner tự đăng ký khi khởi động. */
@Injectable()
export class FileOwnerRegistry {
  private readonly policies = new Map<string, FileOwnerPolicyPort>();

  register(policy: FileOwnerPolicyPort): void {
    if (this.policies.has(policy.ownerType)) {
      throw new Error(`Owner "${policy.ownerType}" đã được đăng ký`);
    }
    this.policies.set(policy.ownerType, policy);
  }

  get(ownerType: FileOwnerType | string): FileOwnerPolicyPort {
    const policy = this.policies.get(ownerType);
    if (!policy) {
      throw new Error(`Owner "${ownerType}" chưa được đăng ký`);
    }
    return policy;
  }

  has(ownerType: string): boolean {
    return this.policies.has(ownerType);
  }

  list(): FileOwnerType[] {
    return [...this.policies.keys()] as FileOwnerType[];
  }
}

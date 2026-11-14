import { ForbiddenException } from '@nestjs/common';
import { assertLoanOwnership, isLoanSuperAdmin } from './loan-ownership.helper';
import { LoanEntity } from '../entities';

describe('loan-ownership.helper', () => {
  describe('isLoanSuperAdmin', () => {
    it('trả về false nếu không có userId', async () => {
      const mockRbac: any = { hasAnyPermission: jest.fn() };
      const res = await isLoanSuperAdmin(mockRbac, undefined);
      expect(res).toBe(false);
      expect(mockRbac.hasAnyPermission).not.toHaveBeenCalled();
    });

    it('gọi rbacCoreService.hasAnyPermission với các quyền quản trị tối cao', async () => {
      const mockRbac: any = {
        hasAnyPermission: jest.fn().mockResolvedValue(true),
      };
      const res = await isLoanSuperAdmin(mockRbac, 'user-admin-1');
      expect(res).toBe(true);
      expect(mockRbac.hasAnyPermission).toHaveBeenCalledWith(
        'user-admin-1',
        expect.arrayContaining([
          expect.objectContaining({ resource: '*' }),
          expect.objectContaining({ resource: 'admin_users' }),
          expect.objectContaining({ resource: 'loans' }),
        ]),
      );
    });
  });

  describe('assertLoanOwnership', () => {
    const loan = {
      id: 'loan-1',
      createdBy: 'user-owner',
    } as LoanEntity;

    it('không ném lỗi nếu là super admin', () => {
      expect(() => assertLoanOwnership(loan, 'user-other', true)).not.toThrow();
    });

    it('không ném lỗi nếu đúng chủ sở hữu', () => {
      expect(() =>
        assertLoanOwnership(loan, 'user-owner', false),
      ).not.toThrow();
    });

    it('ném ForbiddenException nếu không phải chủ sở hữu và không phải admin', () => {
      expect(() => assertLoanOwnership(loan, 'user-other', false)).toThrow(
        ForbiddenException,
      );
    });
  });
});

import { BadRequestException } from '@nestjs/common';

export interface EmployeeDates {
  birthDate?: Date | null;
  startDate?: Date | null;
  leaveDate?: Date | null;
}

/** Quy tắc ngày: ngày sinh không ở tương lai; ngày nghỉ không trước ngày vào làm. Hàm thuần. */
export function assertEmployeeDates(
  dates: EmployeeDates,
  now = new Date(),
): void {
  const { birthDate, startDate, leaveDate } = dates;
  if (birthDate && birthDate.getTime() > now.getTime()) {
    throw new BadRequestException('Ngày sinh không được ở tương lai');
  }
  if (startDate && leaveDate && leaveDate.getTime() < startDate.getTime()) {
    throw new BadRequestException(
      'Ngày nghỉ việc không được trước ngày vào làm',
    );
  }
}

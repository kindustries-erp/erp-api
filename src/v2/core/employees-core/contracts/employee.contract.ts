/** Thông tin tối thiểu của một nhân viên để module khác tham chiếu, không phụ thuộc entity cụ thể. */
export interface EmployeeRef {
  id: string;
  employeeCode: string;
  fullName: string;
}

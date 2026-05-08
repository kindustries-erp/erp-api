import { Injectable } from '@nestjs/common';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NodeType = 'module' | 'process' | 'status';
export type EdgeType =
  | 'depends_on'
  | 'creates'
  | 'triggers'
  | 'reads'
  | 'belongs_to'
  | 'settles'
  | 'workflow_transition';

export interface WorkflowNode {
  id: string;
  type: NodeType;
  label: string;
  labelEn: string;
  description: string;
  group: string;
  meta: {
    color: string;
    icon: string;
    endpoints?: string[];
    statusValue?: string;
  };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  type: EdgeType;
  meta: {
    description: string;
    field?: string;
  };
}

export interface WorkflowGroup {
  id: string;
  label: string;
  labelEn: string;
  color: string;
  description: string;
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  groups: WorkflowGroup[];
  meta: {
    version: string;
    generatedAt: string;
    totalNodes: number;
    totalEdges: number;
    totalGroups: number;
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class WorkflowGraphService {
  getGraph(): WorkflowGraph {
    const nodes = this.buildNodes();
    const edges = this.buildEdges();
    const groups = this.buildGroups();

    return {
      nodes,
      edges,
      groups,
      meta: {
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        totalNodes: nodes.length,
        totalEdges: edges.length,
        totalGroups: groups.length,
      },
    };
  }

  // ─── Groups ────────────────────────────────────────────────────────────────

  private buildGroups(): WorkflowGroup[] {
    return [
      {
        id: 'system',
        label: 'Hệ thống',
        labelEn: 'System',
        color: '#6366f1',
        description: 'Xác thực, phân quyền, file và nhật ký hoạt động',
      },
      {
        id: 'hr',
        label: 'Nhân sự',
        labelEn: 'Human Resources',
        color: '#10b981',
        description: 'Nhân viên, phòng ban, chức vụ',
      },
      {
        id: 'master',
        label: 'Danh mục đối tác',
        labelEn: 'Business Partner Master',
        color: '#f59e0b',
        description: 'Đối tác, liên hệ, tài khoản ngân hàng đối tác, vai trò',
      },
      {
        id: 'finance-setup',
        label: 'Thiết lập tài chính',
        labelEn: 'Finance Setup',
        color: '#3b82f6',
        description:
          'Sơ đồ tài khoản, quỹ tiền mặt, tài khoản ngân hàng công ty, số dư đầu kỳ, cấu hình số phiếu',
      },
      {
        id: 'voucher',
        label: 'Phiếu thu/chi',
        labelEn: 'Payment Vouchers',
        color: '#ec4899',
        description: 'Quy trình lập, duyệt và hạch toán phiếu thu/chi',
      },
      {
        id: 'voucher-workflow',
        label: 'Luồng duyệt phiếu',
        labelEn: 'Voucher Approval Workflow',
        color: '#f97316',
        description: 'Các trạng thái trong vòng đời của phiếu thu/chi',
      },
      {
        id: 'ledger',
        label: 'Công nợ',
        labelEn: 'Partner Ledger',
        color: '#8b5cf6',
        description: 'Khoản công nợ và bù trừ công nợ với đối tác',
      },
    ];
  }

  // ─── Nodes ─────────────────────────────────────────────────────────────────

  private buildNodes(): WorkflowNode[] {
    return [
      // ── System ──────────────────────────────────────────────────────────────
      {
        id: 'auth',
        type: 'module',
        label: 'Xác thực',
        labelEn: 'Authentication',
        description:
          'Đăng nhập, đăng ký, làm mới token. Tất cả API đều xác thực qua Directus Bearer token.',
        group: 'system',
        meta: {
          color: '#6366f1',
          icon: 'lock',
          endpoints: ['POST /auth/login', 'POST /auth/register', 'POST /auth/refresh'],
        },
      },
      {
        id: 'rbac',
        type: 'module',
        label: 'Phân quyền (RBAC)',
        labelEn: 'Role-Based Access Control',
        description:
          'Quản lý vai trò (roles), chính sách (policies), quyền (permissions) và gán người dùng vào vai trò.',
        group: 'system',
        meta: {
          color: '#6366f1',
          icon: 'shield',
          endpoints: [
            'GET /rbac/roles',
            'POST /rbac/roles',
            'GET /rbac/policies',
            'PATCH /rbac/roles/:id/permissions',
            'PATCH /rbac/roles/:id/users',
          ],
        },
      },
      {
        id: 'files',
        type: 'module',
        label: 'Quản lý file',
        labelEn: 'File Management',
        description: 'Upload và quản lý file qua Directus Files API.',
        group: 'system',
        meta: {
          color: '#6366f1',
          icon: 'paperclip',
          endpoints: ['POST /files/upload', 'GET /files/:id'],
        },
      },
      {
        id: 'activity-logs',
        type: 'module',
        label: 'Nhật ký hoạt động',
        labelEn: 'Activity Logs',
        description:
          'Ghi lại mọi thao tác của người dùng trên hệ thống để phục vụ audit.',
        group: 'system',
        meta: {
          color: '#6366f1',
          icon: 'history',
          endpoints: ['GET /activity-logs'],
        },
      },

      // ── HR ───────────────────────────────────────────────────────────────────
      {
        id: 'departments',
        type: 'module',
        label: 'Phòng ban',
        labelEn: 'Departments',
        description: 'Danh mục phòng ban trong tổ chức.',
        group: 'hr',
        meta: {
          color: '#10b981',
          icon: 'building',
          endpoints: ['GET /departments', 'POST /departments', 'PATCH /departments/:id', 'DELETE /departments/:id'],
        },
      },
      {
        id: 'positions',
        type: 'module',
        label: 'Chức vụ',
        labelEn: 'Positions',
        description: 'Danh mục chức vụ, liên kết với phòng ban.',
        group: 'hr',
        meta: {
          color: '#10b981',
          icon: 'briefcase',
          endpoints: ['GET /positions', 'POST /positions', 'PATCH /positions/:id'],
        },
      },
      {
        id: 'employees',
        type: 'module',
        label: 'Nhân viên',
        labelEn: 'Employees',
        description:
          'Hồ sơ nhân viên: thông tin cá nhân, phòng ban, chức vụ. Được dùng làm đối tượng thanh toán nội bộ trong phiếu thu/chi.',
        group: 'hr',
        meta: {
          color: '#10b981',
          icon: 'users',
          endpoints: ['GET /employees', 'POST /employees', 'PATCH /employees/:id', 'DELETE /employees/:id'],
        },
      },

      // ── Business Partner Master ───────────────────────────────────────────
      {
        id: 'business-partner-roles',
        type: 'module',
        label: 'Vai trò đối tác',
        labelEn: 'Business Partner Roles',
        description:
          'Danh mục vai trò: Khách hàng, Nhà cung cấp, v.v. Dùng để phân loại đối tác.',
        group: 'master',
        meta: {
          color: '#f59e0b',
          icon: 'tag',
          endpoints: ['GET /business-partner-roles', 'POST /business-partner-roles'],
        },
      },
      {
        id: 'business-partners',
        type: 'module',
        label: 'Đối tác',
        labelEn: 'Business Partners',
        description:
          'Danh mục đối tác bên ngoài: khách hàng, nhà cung cấp. Được dùng làm đối tượng thanh toán trong phiếu thu/chi và khoản công nợ.',
        group: 'master',
        meta: {
          color: '#f59e0b',
          icon: 'globe',
          endpoints: ['GET /business-partners', 'POST /business-partners', 'PATCH /business-partners/:id'],
        },
      },
      {
        id: 'business-partner-contacts',
        type: 'module',
        label: 'Liên hệ đối tác',
        labelEn: 'Business Partner Contacts',
        description: 'Danh sách đầu mối liên hệ thuộc từng đối tác.',
        group: 'master',
        meta: {
          color: '#f59e0b',
          icon: 'phone',
          endpoints: ['GET /business-partner-contacts', 'POST /business-partner-contacts'],
        },
      },
      {
        id: 'business-partner-bank-accounts',
        type: 'module',
        label: 'TK ngân hàng đối tác',
        labelEn: 'Business Partner Bank Accounts',
        description:
          'Tài khoản ngân hàng của đối tác. Được dùng khi lập phiếu chi chuyển khoản.',
        group: 'master',
        meta: {
          color: '#f59e0b',
          icon: 'credit-card',
          endpoints: ['GET /business-partner-bank-accounts', 'POST /business-partner-bank-accounts'],
        },
      },

      // ── Finance Setup ─────────────────────────────────────────────────────
      {
        id: 'chart-of-accounts',
        type: 'module',
        label: 'Sơ đồ tài khoản',
        labelEn: 'Chart of Accounts',
        description:
          'Danh mục tài khoản kế toán theo chuẩn VAS. Là nền tảng để ghi nhận hạch toán Nợ/Có trên mọi phiếu.',
        group: 'finance-setup',
        meta: {
          color: '#3b82f6',
          icon: 'list',
          endpoints: ['GET /chart-of-accounts', 'POST /chart-of-accounts', 'PATCH /chart-of-accounts/:id'],
        },
      },
      {
        id: 'cash-funds',
        type: 'module',
        label: 'Quỹ tiền mặt',
        labelEn: 'Cash Funds',
        description:
          'Danh mục quỹ tiền mặt. Bắt buộc chọn khi lập phiếu thu/chi tiền mặt.',
        group: 'finance-setup',
        meta: {
          color: '#3b82f6',
          icon: 'dollar-sign',
          endpoints: ['GET /cash-funds', 'POST /cash-funds', 'PATCH /cash-funds/:id'],
        },
      },
      {
        id: 'company-bank-accounts',
        type: 'module',
        label: 'TK ngân hàng công ty',
        labelEn: 'Company Bank Accounts',
        description:
          'Tài khoản ngân hàng của công ty. Bắt buộc chọn khi lập phiếu thu/chi chuyển khoản.',
        group: 'finance-setup',
        meta: {
          color: '#3b82f6',
          icon: 'landmark',
          endpoints: ['GET /company-bank-accounts', 'POST /company-bank-accounts'],
        },
      },
      {
        id: 'opening-balances',
        type: 'module',
        label: 'Số dư đầu kỳ',
        labelEn: 'Opening Balances',
        description:
          'Nhập số dư đầu kỳ cho từng tài khoản kế toán, quỹ, tài khoản ngân hàng.',
        group: 'finance-setup',
        meta: {
          color: '#3b82f6',
          icon: 'database',
          endpoints: ['GET /opening-balances', 'POST /opening-balances', 'PATCH /opening-balances/:id'],
        },
      },
      {
        id: 'voucher-numbering-configs',
        type: 'module',
        label: 'Cấu hình số phiếu',
        labelEn: 'Voucher Numbering Configs',
        description:
          'Cấu hình quy tắc đánh số tự động cho từng loại phiếu (PT, PC, UNC, v.v.).',
        group: 'finance-setup',
        meta: {
          color: '#3b82f6',
          icon: 'hash',
          endpoints: ['GET /voucher-numbering-configs', 'POST /voucher-numbering-configs', 'PATCH /voucher-numbering-configs/:id'],
        },
      },

      // ── Payment Vouchers ──────────────────────────────────────────────────
      {
        id: 'payment-vouchers',
        type: 'module',
        label: 'Phiếu thu/chi',
        labelEn: 'Payment Vouchers',
        description:
          'Lập và quản lý phiếu thu (IN) / chi (OUT) theo kênh tiền mặt (CASH) hoặc chuyển khoản (BANK). Hỗ trợ đối tượng nội bộ (nhân viên) và bên ngoài (đối tác).',
        group: 'voucher',
        meta: {
          color: '#ec4899',
          icon: 'file-text',
          endpoints: [
            'GET /payment-vouchers',
            'POST /payment-vouchers',
            'GET /payment-vouchers/:id',
            'PATCH /payment-vouchers/:id',
            'DELETE /payment-vouchers/:id',
            'POST /payment-vouchers/:id/submit',
            'POST /payment-vouchers/:id/approve',
            'POST /payment-vouchers/:id/reject',
            'POST /payment-vouchers/:id/post',
            'POST /payment-vouchers/:id/cancel',
            'GET /payment-vouchers/summary',
          ],
        },
      },
      {
        id: 'payment-voucher-attachments',
        type: 'module',
        label: 'Đính kèm phiếu',
        labelEn: 'Payment Voucher Attachments',
        description: 'File đính kèm cho phiếu thu/chi (hóa đơn, chứng từ, v.v.).',
        group: 'voucher',
        meta: {
          color: '#ec4899',
          icon: 'paperclip',
          endpoints: ['GET /payment-voucher-attachments', 'POST /payment-voucher-attachments', 'DELETE /payment-voucher-attachments/:id'],
        },
      },
      {
        id: 'payment-voucher-approval-logs',
        type: 'module',
        label: 'Nhật ký duyệt phiếu',
        labelEn: 'Payment Voucher Approval Logs',
        description:
          'Lịch sử duyệt/từ chối phiếu: ai duyệt, thời gian, ghi chú.',
        group: 'voucher',
        meta: {
          color: '#ec4899',
          icon: 'check-circle',
          endpoints: ['GET /payment-voucher-approval-logs'],
        },
      },

      // ── Voucher Workflow Status ────────────────────────────────────────────
      {
        id: 'status-draft',
        type: 'status',
        label: 'Nháp',
        labelEn: 'Draft',
        description: 'Phiếu vừa tạo, chưa gửi duyệt. Có thể sửa và xóa.',
        group: 'voucher-workflow',
        meta: {
          color: '#94a3b8',
          icon: 'edit-3',
          statusValue: 'DRAFT',
        },
      },
      {
        id: 'status-pending',
        type: 'status',
        label: 'Chờ duyệt',
        labelEn: 'Pending Approval',
        description: 'Phiếu đã gửi duyệt, đang chờ người có thẩm quyền phê duyệt.',
        group: 'voucher-workflow',
        meta: {
          color: '#f59e0b',
          icon: 'clock',
          statusValue: 'PENDING_APPROVAL',
        },
      },
      {
        id: 'status-approved',
        type: 'status',
        label: 'Đã duyệt',
        labelEn: 'Approved',
        description: 'Phiếu được duyệt, sẵn sàng hạch toán hoặc có thể hủy.',
        group: 'voucher-workflow',
        meta: {
          color: '#3b82f6',
          icon: 'check',
          statusValue: 'APPROVED',
        },
      },
      {
        id: 'status-posted',
        type: 'status',
        label: 'Đã hạch toán',
        labelEn: 'Posted',
        description:
          'Phiếu đã hạch toán vào sổ kế toán. Trạng thái cuối, không thể thay đổi.',
        group: 'voucher-workflow',
        meta: {
          color: '#10b981',
          icon: 'check-square',
          statusValue: 'POSTED',
        },
      },
      {
        id: 'status-rejected',
        type: 'status',
        label: 'Từ chối',
        labelEn: 'Rejected',
        description: 'Phiếu bị từ chối bởi người duyệt. Trạng thái cuối.',
        group: 'voucher-workflow',
        meta: {
          color: '#ef4444',
          icon: 'x-circle',
          statusValue: 'REJECTED',
        },
      },
      {
        id: 'status-cancelled',
        type: 'status',
        label: 'Đã hủy',
        labelEn: 'Cancelled',
        description:
          'Phiếu bị hủy trước khi hạch toán. Trạng thái cuối.',
        group: 'voucher-workflow',
        meta: {
          color: '#6b7280',
          icon: 'slash',
          statusValue: 'CANCELLED',
        },
      },

      // ── Partner Ledger ────────────────────────────────────────────────────
      {
        id: 'partner-ledger-items',
        type: 'module',
        label: 'Khoản công nợ',
        labelEn: 'Partner Ledger Items',
        description:
          'Ghi nhận từng khoản phải thu (RECEIVABLE) / phải trả (PAYABLE) đối với đối tác. Nguồn gốc: số dư đầu kỳ, thủ công, chứng từ bán/mua hàng.',
        group: 'ledger',
        meta: {
          color: '#8b5cf6',
          icon: 'book-open',
          endpoints: ['GET /partner-ledger-items', 'POST /partner-ledger-items', 'PATCH /partner-ledger-items/:id'],
        },
      },
      {
        id: 'partner-ledger-settlements',
        type: 'module',
        label: 'Bù trừ công nợ',
        labelEn: 'Partner Ledger Settlements',
        description:
          'Liên kết phiếu thu/chi đã hạch toán với khoản công nợ để bù trừ, giảm số dư còn lại.',
        group: 'ledger',
        meta: {
          color: '#8b5cf6',
          icon: 'refresh-cw',
          endpoints: ['GET /partner-ledger-settlements', 'POST /partner-ledger-settlements', 'DELETE /partner-ledger-settlements/:id'],
        },
      },
    ];
  }

  // ─── Edges ─────────────────────────────────────────────────────────────────

  private buildEdges(): WorkflowEdge[] {
    return [
      // ── Auth guards everything ─────────────────────────────────────────────
      {
        id: 'e-auth-rbac',
        source: 'auth',
        target: 'rbac',
        label: 'Xác thực → Phân quyền',
        type: 'triggers',
        meta: { description: 'Mỗi request đã xác thực đều được kiểm tra quyền qua RBAC trước khi thực thi' },
      },

      // ── HR hierarchy ──────────────────────────────────────────────────────
      {
        id: 'e-dept-pos',
        source: 'departments',
        target: 'positions',
        label: 'Phòng ban → Chức vụ',
        type: 'belongs_to',
        meta: { description: 'Chức vụ thuộc phòng ban', field: 'department_id' },
      },
      {
        id: 'e-pos-emp',
        source: 'positions',
        target: 'employees',
        label: 'Chức vụ → Nhân viên',
        type: 'belongs_to',
        meta: { description: 'Nhân viên giữ một chức vụ', field: 'position_id' },
      },
      {
        id: 'e-dept-emp',
        source: 'departments',
        target: 'employees',
        label: 'Phòng ban → Nhân viên',
        type: 'belongs_to',
        meta: { description: 'Nhân viên thuộc phòng ban', field: 'department_id' },
      },

      // ── Business partner hierarchy ─────────────────────────────────────────
      {
        id: 'e-bprole-bp',
        source: 'business-partner-roles',
        target: 'business-partners',
        label: 'Vai trò đối tác → Đối tác',
        type: 'belongs_to',
        meta: { description: 'Đối tác được gán một hoặc nhiều vai trò', field: 'role_id' },
      },
      {
        id: 'e-bp-contact',
        source: 'business-partners',
        target: 'business-partner-contacts',
        label: 'Đối tác → Liên hệ',
        type: 'creates',
        meta: { description: 'Đối tác có nhiều đầu mối liên hệ', field: 'business_partner_id' },
      },
      {
        id: 'e-bp-bankacct',
        source: 'business-partners',
        target: 'business-partner-bank-accounts',
        label: 'Đối tác → TK ngân hàng',
        type: 'creates',
        meta: { description: 'Đối tác có nhiều tài khoản ngân hàng', field: 'business_partner_id' },
      },

      // ── Finance setup dependencies ──────────────────────────────────────────
      {
        id: 'e-coa-ob',
        source: 'chart-of-accounts',
        target: 'opening-balances',
        label: 'Tài khoản → Số dư đầu kỳ',
        type: 'depends_on',
        meta: { description: 'Số dư đầu kỳ được nhập theo từng tài khoản kế toán', field: 'account_id' },
      },
      {
        id: 'e-cashfund-ob',
        source: 'cash-funds',
        target: 'opening-balances',
        label: 'Quỹ → Số dư đầu kỳ',
        type: 'depends_on',
        meta: { description: 'Số dư đầu kỳ có thể gắn với quỹ tiền mặt', field: 'cash_fund_id' },
      },
      {
        id: 'e-compbank-ob',
        source: 'company-bank-accounts',
        target: 'opening-balances',
        label: 'TK công ty → Số dư đầu kỳ',
        type: 'depends_on',
        meta: { description: 'Số dư đầu kỳ có thể gắn với tài khoản ngân hàng công ty', field: 'company_bank_account_id' },
      },

      // ── Voucher depends on master data ──────────────────────────────────────
      {
        id: 'e-coa-pv-debit',
        source: 'chart-of-accounts',
        target: 'payment-vouchers',
        label: 'TK Nợ',
        type: 'depends_on',
        meta: { description: 'Phiếu thu/chi bắt buộc chọn tài khoản Nợ', field: 'debit_account_id' },
      },
      {
        id: 'e-coa-pv-credit',
        source: 'chart-of-accounts',
        target: 'payment-vouchers',
        label: 'TK Có',
        type: 'depends_on',
        meta: { description: 'Phiếu thu/chi bắt buộc chọn tài khoản Có', field: 'credit_account_id' },
      },
      {
        id: 'e-cashfund-pv',
        source: 'cash-funds',
        target: 'payment-vouchers',
        label: 'Quỹ tiền mặt',
        type: 'depends_on',
        meta: { description: 'Bắt buộc chọn quỹ khi phiếu là CASH', field: 'cash_fund_id' },
      },
      {
        id: 'e-compbank-pv',
        source: 'company-bank-accounts',
        target: 'payment-vouchers',
        label: 'TK ngân hàng công ty',
        type: 'depends_on',
        meta: { description: 'Bắt buộc chọn TK ngân hàng khi phiếu là BANK', field: 'company_bank_account_id' },
      },
      {
        id: 'e-bp-pv',
        source: 'business-partners',
        target: 'payment-vouchers',
        label: 'Đối tác bên ngoài',
        type: 'depends_on',
        meta: { description: 'Phiếu có counterparty_source = EXTERNAL dùng đối tác', field: 'counterparty_id' },
      },
      {
        id: 'e-emp-pv',
        source: 'employees',
        target: 'payment-vouchers',
        label: 'Nhân viên nội bộ',
        type: 'depends_on',
        meta: { description: 'Phiếu có counterparty_source = INTERNAL dùng nhân viên', field: 'employee_id' },
      },
      {
        id: 'e-bpbankacct-pv',
        source: 'business-partner-bank-accounts',
        target: 'payment-vouchers',
        label: 'TK nhận tiền đối tác',
        type: 'depends_on',
        meta: { description: 'TK ngân hàng đối tác nhận chuyển khoản', field: 'beneficiary_bank_account_id' },
      },
      {
        id: 'e-vnc-pv',
        source: 'voucher-numbering-configs',
        target: 'payment-vouchers',
        label: 'Số phiếu tự động',
        type: 'depends_on',
        meta: { description: 'Cấu hình đánh số tự động cho phiếu thu/chi' },
      },

      // ── Voucher approval workflow transitions ────────────────────────────────
      {
        id: 'e-wf-draft-pending',
        source: 'status-draft',
        target: 'status-pending',
        label: 'submit → Chờ duyệt',
        type: 'workflow_transition',
        meta: { description: 'POST /payment-vouchers/:id/submit — DRAFT → PENDING_APPROVAL' },
      },
      {
        id: 'e-wf-pending-approved',
        source: 'status-pending',
        target: 'status-approved',
        label: 'approve → Duyệt',
        type: 'workflow_transition',
        meta: { description: 'POST /payment-vouchers/:id/approve — PENDING_APPROVAL → APPROVED' },
      },
      {
        id: 'e-wf-pending-rejected',
        source: 'status-pending',
        target: 'status-rejected',
        label: 'reject → Từ chối',
        type: 'workflow_transition',
        meta: { description: 'POST /payment-vouchers/:id/reject — PENDING_APPROVAL → REJECTED' },
      },
      {
        id: 'e-wf-approved-posted',
        source: 'status-approved',
        target: 'status-posted',
        label: 'post → Hạch toán',
        type: 'workflow_transition',
        meta: { description: 'POST /payment-vouchers/:id/post — APPROVED → POSTED' },
      },
      {
        id: 'e-wf-draft-cancelled',
        source: 'status-draft',
        target: 'status-cancelled',
        label: 'cancel → Hủy',
        type: 'workflow_transition',
        meta: { description: 'POST /payment-vouchers/:id/cancel — DRAFT → CANCELLED' },
      },
      {
        id: 'e-wf-pending-cancelled',
        source: 'status-pending',
        target: 'status-cancelled',
        label: 'cancel → Hủy',
        type: 'workflow_transition',
        meta: { description: 'POST /payment-vouchers/:id/cancel — PENDING_APPROVAL → CANCELLED' },
      },
      {
        id: 'e-wf-approved-cancelled',
        source: 'status-approved',
        target: 'status-cancelled',
        label: 'cancel → Hủy',
        type: 'workflow_transition',
        meta: { description: 'POST /payment-vouchers/:id/cancel — APPROVED → CANCELLED' },
      },
      {
        id: 'e-pv-wf',
        source: 'payment-vouchers',
        target: 'status-draft',
        label: 'Tạo mới → DRAFT',
        type: 'creates',
        meta: { description: 'Phiếu thu/chi khi tạo mới luôn có trạng thái DRAFT' },
      },

      // ── Voucher sub-documents ──────────────────────────────────────────────
      {
        id: 'e-pv-attach',
        source: 'payment-vouchers',
        target: 'payment-voucher-attachments',
        label: 'File đính kèm',
        type: 'creates',
        meta: { description: 'Phiếu thu/chi có thể đính kèm nhiều file chứng từ', field: 'payment_voucher_id' },
      },
      {
        id: 'e-pv-approvallog',
        source: 'payment-vouchers',
        target: 'payment-voucher-approval-logs',
        label: 'Lịch sử duyệt',
        type: 'triggers',
        meta: { description: 'Mỗi thao tác duyệt/từ chối tạo ra một bản ghi nhật ký', field: 'payment_voucher_id' },
      },
      {
        id: 'e-attach-files',
        source: 'payment-voucher-attachments',
        target: 'files',
        label: 'File upload',
        type: 'depends_on',
        meta: { description: 'Đính kèm tham chiếu tới file được upload qua Files module', field: 'file_id' },
      },

      // ── Ledger relationships ───────────────────────────────────────────────
      {
        id: 'e-bp-ledger',
        source: 'business-partners',
        target: 'partner-ledger-items',
        label: 'Đối tác → Công nợ',
        type: 'creates',
        meta: { description: 'Khoản công nợ gắn với một đối tác cụ thể', field: 'business_partner_id' },
      },
      {
        id: 'e-coa-ledger',
        source: 'chart-of-accounts',
        target: 'partner-ledger-items',
        label: 'TK kế toán → Công nợ',
        type: 'depends_on',
        meta: { description: 'Khoản công nợ gắn với tài khoản kế toán phải thu/trả', field: 'accounting_account_id' },
      },
      {
        id: 'e-ledger-settlement',
        source: 'partner-ledger-items',
        target: 'partner-ledger-settlements',
        label: 'Khoản công nợ → Bù trừ',
        type: 'settles',
        meta: { description: 'Bù trừ liên kết khoản công nợ với phiếu thanh toán', field: 'partner_ledger_item_id' },
      },
      {
        id: 'e-pv-settlement',
        source: 'payment-vouchers',
        target: 'partner-ledger-settlements',
        label: 'Phiếu đã hạch toán → Bù trừ',
        type: 'settles',
        meta: {
          description: 'Phiếu thu/chi trạng thái POSTED được dùng để bù trừ công nợ',
          field: 'payment_voucher_id',
        },
      },

      // ── Activity log catches everything ────────────────────────────────────
      {
        id: 'e-pv-actlog',
        source: 'payment-vouchers',
        target: 'activity-logs',
        label: 'Ghi nhật ký',
        type: 'triggers',
        meta: { description: 'Mọi thao tác trên phiếu thu/chi được ghi vào nhật ký hoạt động' },
      },
      {
        id: 'e-bp-actlog',
        source: 'business-partners',
        target: 'activity-logs',
        label: 'Ghi nhật ký',
        type: 'triggers',
        meta: { description: 'Mọi thao tác trên đối tác được ghi nhật ký' },
      },
    ];
  }
}

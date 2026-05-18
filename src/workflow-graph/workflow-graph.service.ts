import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// ─── Shared Types ─────────────────────────────────────────────────────────────

export type NodeKind = 'root' | 'admin' | 'department' | 'process' | 'status';
export type EdgeKind =
  | 'hierarchy'
  | 'manages'
  | 'process_step'
  | 'workflow_transition';

export interface EmployeeSnippet {
  id: string;
  name: string;
  position: string;
}

export interface StatusDef {
  value: string;
  label: string;
  color: string;
  terminal: boolean;
}

export interface TransitionDef {
  from: string;
  to: string;
  action: string;
  rule: string;
  actor: string;
}

export interface WorkflowNode {
  id: string;
  type: NodeKind;
  level: number;
  label: string;
  description: string;
  group: string;
  employees: EmployeeSnippet[];
  roles: string[];
  rules: string[];
  statuses: StatusDef[];
  meta: {
    color: string;
    icon: string;
    endpoints?: string[];
    parentId?: string;
    statusValue?: string;
    terminal?: boolean;
  };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  type: EdgeKind;
  rule?: string;
  actor?: string;
  meta: { description: string };
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  meta: {
    version: string;
    generatedAt: string;
    layout: 'vertical';
    totalNodes: number;
    totalEdges: number;
  };
}

// ─── Static process definitions ───────────────────────────────────────────────

interface ProcessDef {
  id: string;
  label: string;
  description: string;
  deptKeywords: string[];
  color: string;
  icon: string;
  rules: string[];
  statuses: StatusDef[];
  transitions: TransitionDef[];
  endpoints: string[];
}

const PROCESS_DEFS: ProcessDef[] = [
  {
    id: 'proc-payment-vouchers',
    label: 'Quy trình Phiếu Thu/Chi',
    description:
      'Lập, trình duyệt và hạch toán phiếu thu/chi tiền mặt và chuyển khoản',
    deptKeywords: [
      'kế toán',
      'tài chính',
      'ke toan',
      'tai chinh',
      'finance',
      'accounting',
    ],
    color: '#ec4899',
    icon: 'file-text',
    rules: [
      'Kế toán viên tạo phiếu → trạng thái DRAFT',
      'Chỉ phiếu DRAFT mới được sửa hoặc xóa',
      'Gửi duyệt: DRAFT → PENDING_APPROVAL (không thể hoàn tác)',
      'Kế toán trưởng duyệt phiếu có số tiền ≤ 50.000.000 VND',
      'Ban Giám Đốc phê duyệt phiếu có số tiền > 50.000.000 VND',
      'Hạch toán: APPROVED → POSTED (ghi sổ, không thể hoàn tác)',
      'Chỉ phiếu POSTED mới được dùng để bù trừ công nợ',
      'Hủy cho phép ở trạng thái DRAFT, PENDING_APPROVAL, APPROVED',
    ],
    statuses: [
      { value: 'DRAFT', label: 'Nháp', color: '#94a3b8', terminal: false },
      {
        value: 'PENDING_APPROVAL',
        label: 'Chờ duyệt',
        color: '#f59e0b',
        terminal: false,
      },
      {
        value: 'APPROVED',
        label: 'Đã duyệt',
        color: '#3b82f6',
        terminal: false,
      },
      {
        value: 'POSTED',
        label: 'Đã hạch toán',
        color: '#10b981',
        terminal: true,
      },
      { value: 'REJECTED', label: 'Từ chối', color: '#ef4444', terminal: true },
      { value: 'CANCELLED', label: 'Đã hủy', color: '#6b7280', terminal: true },
    ],
    transitions: [
      {
        from: 'DRAFT',
        to: 'PENDING_APPROVAL',
        action: 'submit',
        rule: 'Kế toán viên gửi phiếu chờ duyệt',
        actor: 'Kế toán viên',
      },
      {
        from: 'PENDING_APPROVAL',
        to: 'APPROVED',
        action: 'approve',
        rule: '≤ 50tr VND: Kế toán trưởng; > 50tr VND: Ban Giám Đốc',
        actor: 'Kế toán trưởng / Ban Giám Đốc',
      },
      {
        from: 'PENDING_APPROVAL',
        to: 'REJECTED',
        action: 'reject',
        rule: 'Từ chối kèm lý do bắt buộc',
        actor: 'Kế toán trưởng / Ban Giám Đốc',
      },
      {
        from: 'APPROVED',
        to: 'POSTED',
        action: 'post',
        rule: 'Hạch toán vào sổ kế toán',
        actor: 'Kế toán trưởng',
      },
      {
        from: 'DRAFT',
        to: 'CANCELLED',
        action: 'cancel',
        rule: 'Hủy phiếu nháp',
        actor: 'Người tạo / Kế toán trưởng',
      },
      {
        from: 'PENDING_APPROVAL',
        to: 'CANCELLED',
        action: 'cancel',
        rule: 'Hủy khi đang chờ duyệt',
        actor: 'Người tạo / Kế toán trưởng',
      },
      {
        from: 'APPROVED',
        to: 'CANCELLED',
        action: 'cancel',
        rule: 'Hủy phiếu đã duyệt nhưng chưa hạch toán',
        actor: 'Kế toán trưởng / Ban Giám Đốc',
      },
    ],
    endpoints: [
      'POST   /api/v1/payment-vouchers',
      'POST   /api/v1/payment-vouchers/:id/submit',
      'POST   /api/v1/payment-vouchers/:id/approve',
      'POST   /api/v1/payment-vouchers/:id/reject',
      'POST   /api/v1/payment-vouchers/:id/post',
      'POST   /api/v1/payment-vouchers/:id/cancel',
    ],
  },
  {
    id: 'proc-partner-ledger',
    label: 'Quy trình Công Nợ',
    description:
      'Quản lý khoản phải thu, phải trả và bù trừ công nợ với đối tác',
    deptKeywords: [
      'kế toán',
      'tài chính',
      'ke toan',
      'tai chinh',
      'finance',
      'accounting',
    ],
    color: '#8b5cf6',
    icon: 'book-open',
    rules: [
      'Kế toán viên tạo khoản công nợ: RECEIVABLE (phải thu) hoặc PAYABLE (phải trả)',
      'Nguồn gốc: OPENING (đầu kỳ), MANUAL (thủ công), SALES_DOC, PURCHASE_DOC, ADJUSTMENT',
      'Bù trừ chỉ áp dụng khi phiếu thu/chi ở trạng thái POSTED',
      'Số tiền bù trừ ≤ remaining_amount của khoản công nợ',
      'Khoản công nợ đã SETTLED không thể bù trừ thêm',
    ],
    statuses: [
      {
        value: 'OPEN',
        label: 'Còn nợ đầy đủ',
        color: '#ef4444',
        terminal: false,
      },
      {
        value: 'PARTIAL',
        label: 'Bù trừ một phần',
        color: '#f59e0b',
        terminal: false,
      },
      {
        value: 'SETTLED',
        label: 'Đã tất toán',
        color: '#10b981',
        terminal: true,
      },
    ],
    transitions: [
      {
        from: 'OPEN',
        to: 'PARTIAL',
        action: 'partial settle',
        rule: 'Bù trừ một phần qua phiếu POSTED',
        actor: 'Kế toán viên',
      },
      {
        from: 'OPEN',
        to: 'SETTLED',
        action: 'full settle',
        rule: 'Bù trừ toàn bộ số tiền một lần',
        actor: 'Kế toán viên',
      },
      {
        from: 'PARTIAL',
        to: 'SETTLED',
        action: 'settle remaining',
        rule: 'Bù trừ phần tiền còn lại',
        actor: 'Kế toán viên',
      },
    ],
    endpoints: [
      'POST   /api/v1/partner-ledger-items',
      'GET    /api/v1/partner-ledger-items',
      'POST   /api/v1/partner-ledger-settlements',
      'DELETE /api/v1/partner-ledger-settlements/:id',
    ],
  },
  {
    id: 'proc-hr-employees',
    label: 'Quản lý Nhân Viên',
    description: 'Hồ sơ nhân viên, phòng ban, chức vụ và cơ cấu tổ chức',
    deptKeywords: [
      'nhân sự',
      'hành chính',
      'nhan su',
      'hr',
      'human',
      'personnel',
    ],
    color: '#10b981',
    icon: 'users',
    rules: [
      'HR Specialist tạo và cập nhật hồ sơ nhân viên',
      'Nhân viên bắt buộc thuộc một phòng ban và chức vụ hợp lệ',
      'HR Manager phê duyệt thay đổi chức vụ và bậc lương',
      'Chỉ Admin mới được xóa hồ sơ nhân viên',
      'Nhân viên nội bộ được dùng làm đối tượng thu/chi (counterparty_source = INTERNAL)',
    ],
    statuses: [
      {
        value: 'ACTIVE',
        label: 'Đang làm việc',
        color: '#10b981',
        terminal: false,
      },
      {
        value: 'ON_LEAVE',
        label: 'Nghỉ phép',
        color: '#f59e0b',
        terminal: false,
      },
      {
        value: 'INACTIVE',
        label: 'Đã nghỉ việc',
        color: '#6b7280',
        terminal: true,
      },
    ],
    transitions: [
      {
        from: 'ACTIVE',
        to: 'ON_LEAVE',
        action: 'leave',
        rule: 'HR Specialist ghi nhận nghỉ phép có thời hạn',
        actor: 'HR Specialist',
      },
      {
        from: 'ON_LEAVE',
        to: 'ACTIVE',
        action: 'return',
        rule: 'Kết thúc nghỉ phép, trở lại làm việc',
        actor: 'HR Specialist',
      },
      {
        from: 'ACTIVE',
        to: 'INACTIVE',
        action: 'offboard',
        rule: 'HR Manager xử lý thủ tục nghỉ việc',
        actor: 'HR Manager',
      },
    ],
    endpoints: [
      'GET    /api/v1/employees',
      'POST   /api/v1/employees',
      'PATCH  /api/v1/employees/:id',
      'DELETE /api/v1/employees/:id',
    ],
  },
  {
    id: 'proc-business-partners',
    label: 'Quản lý Đối Tác',
    description:
      'Khách hàng, nhà cung cấp, liên hệ và tài khoản ngân hàng đối tác',
    deptKeywords: [
      'kinh doanh',
      'bán hàng',
      'mua hàng',
      'sales',
      'purchase',
      'kd',
      'business',
    ],
    color: '#f59e0b',
    icon: 'globe',
    rules: [
      'Nhân viên kinh doanh tạo và cập nhật thông tin đối tác',
      'Phân loại đối tác theo vai trò: Khách hàng, Nhà cung cấp, hoặc cả hai',
      'Mỗi đối tác nên có ít nhất một liên hệ (Business Partner Contacts)',
      'TK ngân hàng đối tác cần xác nhận trước khi thanh toán chuyển khoản',
      'Đối tác ngoài (EXTERNAL) được dùng làm đối tượng thu/chi phiếu',
    ],
    statuses: [
      {
        value: 'ACTIVE',
        label: 'Đang hợp tác',
        color: '#10b981',
        terminal: false,
      },
      {
        value: 'SUSPENDED',
        label: 'Tạm ngừng',
        color: '#f59e0b',
        terminal: false,
      },
      {
        value: 'INACTIVE',
        label: 'Ngừng hợp tác',
        color: '#6b7280',
        terminal: true,
      },
    ],
    transitions: [
      {
        from: 'ACTIVE',
        to: 'SUSPENDED',
        action: 'suspend',
        rule: 'Quản lý tạm ngừng hợp tác',
        actor: 'Sales Manager',
      },
      {
        from: 'SUSPENDED',
        to: 'ACTIVE',
        action: 'reactivate',
        rule: 'Khôi phục quan hệ hợp tác',
        actor: 'Sales Manager',
      },
      {
        from: 'ACTIVE',
        to: 'INACTIVE',
        action: 'deactivate',
        rule: 'Kết thúc hợp tác vĩnh viễn',
        actor: 'Sales Manager / Ban Giám Đốc',
      },
    ],
    endpoints: [
      'GET    /api/v1/business-partners',
      'POST   /api/v1/business-partners',
      'PATCH  /api/v1/business-partners/:id',
    ],
  },
  {
    id: 'proc-rbac',
    label: 'Phân Quyền & Bảo Mật',
    description:
      'Quản lý vai trò, quyền truy cập người dùng và nhật ký hệ thống',
    deptKeywords: [
      'it',
      'system',
      'admin',
      'quản trị',
      'công nghệ',
      'technology',
    ],
    color: '#6366f1',
    icon: 'shield',
    rules: [
      'Chỉ Admin mới có thể tạo/sửa/xóa vai trò (Roles) và chính sách (Policies)',
      'Mỗi người dùng phải được gán ít nhất một vai trò',
      'Quyền hoạt động theo chuỗi: Role → Policy → Permission (collection + action)',
      'Nhật ký hoạt động ghi lại toàn bộ thao tác của mọi người dùng',
      'Access token tự động hết hạn và cần refresh định kỳ',
    ],
    statuses: [],
    transitions: [],
    endpoints: [
      'GET    /api/v1/rbac/roles',
      'POST   /api/v1/rbac/roles',
      'PATCH  /api/v1/rbac/roles/:id/permissions',
      'PATCH  /api/v1/rbac/roles/:id/users',
      'GET    /api/v1/activity-logs',
    ],
  },
];

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class WorkflowGraphService {
  private readonly logger = new Logger(WorkflowGraphService.name);

  constructor(private readonly configService: ConfigService) {}

  private get directusUrl(): string | null {
    return this.configService.get<string>('DIRECTUS_URL') ?? null;
  }

  private get adminToken(): string | null {
    return this.configService.get<string>('DIRECTUS_ADMIN_TOKEN') ?? null;
  }

  private async fetchDirectus<T>(path: string): Promise<T[]> {
    if (!this.directusUrl || !this.adminToken) return [];
    try {
      const res = await fetch(`${this.directusUrl}${path}`, {
        headers: { Authorization: `Bearer ${this.adminToken}` },
      });
      if (!res.ok) return [];
      const json = (await res.json()) as { data?: T[] };
      return json.data ?? [];
    } catch (err) {
      this.logger.warn(`fetchDirectus ${path} failed: ${err}`);
      return [];
    }
  }

  async getGraph(): Promise<WorkflowGraph> {
    const [rawDepts, rawEmployees, rawUsers] = await Promise.all([
      this.fetchDirectus<any>(
        '/items/departments?fields[]=id&fields[]=name&fields[]=description&limit=50',
      ),
      this.fetchDirectus<any>(
        '/items/employees?fields[]=id&fields[]=full_name&fields[]=department_id.id&fields[]=department_id.name&fields[]=position_id.name&limit=200',
      ),
      this.fetchDirectus<any>(
        '/users?fields[]=id&fields[]=first_name&fields[]=last_name&fields[]=role.name&fields[]=role.admin_access&limit=100',
      ),
    ]);

    return this.buildGraph(rawDepts, rawEmployees, rawUsers);
  }

  // ─── Graph builder ──────────────────────────────────────────────────────────

  private buildGraph(
    rawDepts: any[],
    rawEmployees: any[],
    rawUsers: any[],
  ): WorkflowGraph {
    const nodes: WorkflowNode[] = [];
    const edges: WorkflowEdge[] = [];

    // ── Level 0: Root ─────────────────────────────────────────────────────────
    nodes.push({
      id: 'root',
      type: 'root',
      level: 0,
      label: 'Hệ thống ERP Liouni',
      description:
        'Trung tâm quản lý toàn bộ nghiệp vụ tài chính, nhân sự và đối tác',
      group: 'system',
      employees: [],
      roles: [],
      rules: [
        'Tất cả người dùng phải xác thực qua Bearer Token (Directus)',
        'Mọi thao tác được kiểm tra quyền theo Role → Policy → Permission',
        'Toàn bộ hoạt động được ghi vào nhật ký (Activity Log)',
      ],
      statuses: [],
      meta: { color: '#1e40af', icon: 'layers' },
    });

    // ── Level 1: Admin / BGĐ ──────────────────────────────────────────────────
    const adminEmployees: EmployeeSnippet[] = rawUsers
      .filter((u) => {
        const role = u.role;
        if (!role || typeof role !== 'object') return false;
        return (
          role.admin_access === true ||
          role.name?.toLowerCase().includes('admin') ||
          role.name?.toLowerCase().includes('director') ||
          role.name?.toLowerCase().includes('giám đốc')
        );
      })
      .slice(0, 10)
      .map((u) => ({
        id: u.id,
        name:
          `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() ||
          u.id.slice(0, 8),
        position:
          typeof u.role === 'object' ? (u.role?.name ?? 'Admin') : 'Admin',
      }));

    nodes.push({
      id: 'admin',
      type: 'admin',
      level: 1,
      label: 'Ban Giám Đốc / Quản trị viên',
      description:
        'Toàn quyền hệ thống. Phê duyệt giao dịch giá trị cao và quản lý người dùng.',
      group: 'management',
      employees: adminEmployees,
      roles: ['SuperAdmin', 'Director / CEO'],
      rules: [
        'Toàn quyền đọc/ghi/xóa trên tất cả phân hệ',
        'Phê duyệt phiếu thu/chi có số tiền > 50.000.000 VND',
        'Quản lý vai trò và phân quyền người dùng (RBAC)',
        'Cấu hình danh mục dùng chung (sơ đồ tài khoản, quỹ, số phiếu)',
        'Xem toàn bộ nhật ký hoạt động',
      ],
      statuses: [],
      meta: { color: '#1e40af', icon: 'crown' },
    });

    edges.push({
      id: 'e-root-admin',
      source: 'root',
      target: 'admin',
      label: 'Quản trị toàn hệ thống',
      type: 'hierarchy',
      rule: 'Tài khoản có admin_access = true trong Directus',
      actor: 'SuperAdmin',
      meta: { description: 'Root → Admin' },
    });

    // ── Level 2: Departments ──────────────────────────────────────────────────
    const deptNodes: WorkflowNode[] = rawDepts.map((dept) => {
      const emps: EmployeeSnippet[] = rawEmployees
        .filter((e) => {
          const dId =
            typeof e.department_id === 'object'
              ? e.department_id?.id
              : e.department_id;
          return dId === dept.id;
        })
        .map((e) => ({
          id: e.id,
          name: e.full_name ?? e.id.slice(0, 8),
          position:
            typeof e.position_id === 'object'
              ? (e.position_id?.name ?? '')
              : '',
        }));

      return {
        id: `dept-${dept.id}`,
        type: 'department' as NodeKind,
        level: 2,
        label: dept.name,
        description: dept.description ?? `Phòng ${dept.name}`,
        group: 'department',
        employees: emps,
        roles: [],
        rules: [],
        statuses: [],
        meta: { color: '#0369a1', icon: 'building', parentId: 'admin' },
      };
    });

    if (deptNodes.length === 0) {
      deptNodes.push({
        id: 'dept-default',
        type: 'department',
        level: 2,
        label: 'Các Phòng Ban',
        description: 'Phòng ban trong tổ chức',
        group: 'department',
        employees: [],
        roles: [],
        rules: [],
        statuses: [],
        meta: { color: '#0369a1', icon: 'building', parentId: 'admin' },
      });
    }

    nodes.push(...deptNodes);

    for (const dn of deptNodes) {
      edges.push({
        id: `e-admin-${dn.id}`,
        source: 'admin',
        target: dn.id,
        label: 'Giám sát phòng ban',
        type: 'hierarchy',
        rule: 'Ban Giám Đốc giám sát hoạt động tất cả phòng ban',
        actor: 'Ban Giám Đốc',
        meta: { description: `Admin → ${dn.label}` },
      });
    }

    // ── Level 3: Processes (matched to dept by keyword) ───────────────────────
    const matchDeptId = (keywords: string[]): string => {
      for (const dn of deptNodes) {
        const name = dn.label.toLowerCase();
        if (keywords.some((k) => name.includes(k.toLowerCase()))) return dn.id;
      }
      return 'admin';
    };

    for (const proc of PROCESS_DEFS) {
      const parentId = matchDeptId(proc.deptKeywords);
      const parentNode = nodes.find((n) => n.id === parentId);

      nodes.push({
        id: proc.id,
        type: 'process',
        level: 3,
        label: proc.label,
        description: proc.description,
        group: 'process',
        employees: [],
        roles: [],
        rules: proc.rules,
        statuses: proc.statuses,
        meta: {
          color: proc.color,
          icon: proc.icon,
          endpoints: proc.endpoints,
          parentId,
        },
      });

      edges.push({
        id: `e-${parentId}-${proc.id}`,
        source: parentId,
        target: proc.id,
        label: 'Vận hành quy trình',
        type: 'manages',
        meta: {
          description: `${parentNode?.label ?? 'Admin'} → ${proc.label}`,
        },
      });

      // ── Level 4: Status nodes ───────────────────────────────────────────────
      if (proc.statuses.length === 0) continue;

      // Process → first status (init edge)
      const first = proc.statuses[0];
      edges.push({
        id: `e-${proc.id}-init`,
        source: proc.id,
        target: `${proc.id}-${first.value}`,
        label: 'Khởi tạo',
        type: 'process_step',
        rule: `Tạo mới → ${first.label}`,
        actor: 'Người dùng có quyền tạo',
        meta: { description: `Tạo mới bắt đầu ở trạng thái ${first.label}` },
      });

      for (const status of proc.statuses) {
        nodes.push({
          id: `${proc.id}-${status.value}`,
          type: 'status',
          level: 4,
          label: status.label,
          description: status.terminal
            ? 'Trạng thái kết thúc — không thể chuyển tiếp'
            : 'Trạng thái trung gian',
          group: `status-${proc.id}`,
          employees: [],
          roles: [],
          rules: [],
          statuses: [],
          meta: {
            color: status.color,
            icon: status.terminal ? 'check-circle' : 'circle',
            parentId: proc.id,
            statusValue: status.value,
            terminal: status.terminal,
          },
        });
      }

      // Transition edges between status nodes
      for (const t of proc.transitions) {
        edges.push({
          id: `e-${proc.id}-${t.from}-${t.to}`,
          source: `${proc.id}-${t.from}`,
          target: `${proc.id}-${t.to}`,
          label: t.action,
          type: 'workflow_transition',
          rule: t.rule,
          actor: t.actor,
          meta: {
            description: `${t.from} → ${t.to} | ${t.rule}`,
          },
        });
      }
    }

    return {
      nodes,
      edges,
      meta: {
        version: '2.0.0',
        generatedAt: new Date().toISOString(),
        layout: 'vertical',
        totalNodes: nodes.length,
        totalEdges: edges.length,
      },
    };
  }
}

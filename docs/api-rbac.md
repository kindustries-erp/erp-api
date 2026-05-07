# API: /rbac

Nhóm endpoint RBAC hiện có trong backend, dùng để quản lý role và quyền (permission) theo role.

Tất cả endpoint bên dưới đều có prefix:

```http
/api/v1/rbac
```

Yêu cầu xác thực:

```http
Authorization: Bearer <access_token>
```

---

## Danh sách endpoint

| Method   | Endpoint                                 | Mô tả                                                       |
| -------- | ---------------------------------------- | ----------------------------------------------------------- |
| `GET`    | `/api/v1/rbac/roles-table`               | Lấy bảng RBAC đã tổng hợp role + user + policy + permission |
| `GET`    | `/api/v1/rbac/roles`                     | Lấy danh sách role có phân trang (kèm users)                |
| `POST`   | `/api/v1/rbac/roles`                     | Tạo role mới                                                |
| `PATCH`  | `/api/v1/rbac/roles/:id`                 | Cập nhật role                                               |
| `DELETE` | `/api/v1/rbac/roles/:id`                 | Xóa role                                                    |
| `GET`    | `/api/v1/rbac/roles/:roleId/permissions` | Lấy permission theo role                                    |
| `PATCH`  | `/api/v1/rbac/roles/:roleId/permissions` | Cập nhật permission theo role                               |
| `GET`    | `/api/v1/rbac/roles/:roleId/users`       | Lấy danh sách user thuộc role                               |
| `PATCH`  | `/api/v1/rbac/roles/:roleId/users`       | Cập nhật danh sách user thuộc role                          |

---

## 1) GET /rbac/roles-table

Trả về dữ liệu tổng hợp để hiển thị ma trận RBAC. Mỗi role bao gồm danh sách user, policy và permission.

### Request

```http
GET /api/v1/rbac/roles-table
Authorization: Bearer <access_token>
```

### Response 200 (example)

```json
[
  {
    "roleId": "2f7c6b10-7e95-4bd3-a1a5-9b6a12345678",
    "roleName": "Kế toán",
    "icon": "supervised_user_circle",
    "description": "Nhóm kế toán",
    "users": [
      {
        "id": "a1b2c3d4-0000-0000-0000-000000000001",
        "email": "ketoan1@company.com",
        "first_name": "Nguyễn",
        "last_name": "Văn A"
      }
    ],
    "policies": [
      {
        "id": "9e8123a0-8ff7-4a84-a7bd-3b1d11111111",
        "name": "Policy kế toán",
        "icon": null,
        "description": null,
        "admin_access": false,
        "app_access": true
      }
    ],
    "permissions": [
      {
        "id": "0dba2222-82df-4f11-9fbe-2a9f22222222",
        "collection": "gw_payment_vouchers",
        "action": "read",
        "permissions": null,
        "validation": null,
        "presets": null,
        "fields": ["*"],
        "policy": "9e8123a0-8ff7-4a84-a7bd-3b1d11111111"
      }
    ]
  }
]
```

---

## 2) GET /rbac/roles

Lấy danh sách role có phân trang. Mỗi role bao gồm mảng `users` chứa email của các user thuộc role đó.

### Query params

| Param      | Type     | Mặc định    | Mô tả            |
| ---------- | -------- | ----------- | ---------------- |
| `page`     | `number` | `1`         | Trang hiện tại   |
| `pageSize` | `number` | `20`        | Số bản ghi/trang |
| `search`   | `string` | `undefined` | Từ khóa tìm kiếm |

### Request

```http
GET /api/v1/rbac/roles?page=1&pageSize=20&search=ke%20toan
Authorization: Bearer <access_token>
```

### Response 200 (example)

```json
{
  "items": [
    {
      "id": "2f7c6b10-7e95-4bd3-a1a5-9b6a12345678",
      "name": "Kế toán",
      "icon": "supervised_user_circle",
      "description": "Nhóm kế toán",
      "users": [
        {
          "id": "a1b2c3d4-0000-0000-0000-000000000001",
          "email": "ketoan1@company.com",
          "first_name": "Nguyễn",
          "last_name": "Văn A"
        }
      ]
    }
  ],
  "total": 14,
  "page": 1,
  "pageSize": 20,
  "totalPages": 1
}
```

Ghi chú: users được fetch batch bằng một request duy nhất sau khi lấy page roles, không gây N+1 query.

---

## 3) POST /rbac/roles

Tạo role mới. Payload được forward sang Directus `/roles`.

### Request body (example)

```json
{
  "name": "Trưởng phòng mua hàng",
  "icon": "badge",
  "description": "Role cho trưởng phòng mua hàng"
}
```

### Response 201/200 (example)

```json
{
  "id": "0dd7a333-7688-4c84-aad4-b66633333333",
  "name": "Trưởng phòng mua hàng",
  "icon": "badge",
  "description": "Role cho trưởng phòng mua hàng"
}
```

Ghi chú: cấu trúc field hợp lệ phụ thuộc schema/validation của Directus.

---

## 4) PATCH /rbac/roles/:id

Cập nhật role theo `id`. Payload được forward sang Directus `/roles/:id`.

### Path param

| Param | Type     | Mô tả     |
| ----- | -------- | --------- |
| `id`  | `string` | UUID role |

### Request body (example)

```json
{
  "name": "Kế toán tổng hợp",
  "description": "Cập nhật mô tả role"
}
```

### Response 200 (example)

```json
{
  "id": "2f7c6b10-7e95-4bd3-a1a5-9b6a12345678",
  "name": "Kế toán tổng hợp",
  "icon": "supervised_user_circle",
  "description": "Cập nhật mô tả role"
}
```

---

## 5) DELETE /rbac/roles/:id

Xóa role theo `id`.

### Path param

| Param | Type     | Mô tả     |
| ----- | -------- | --------- |
| `id`  | `string` | UUID role |

### Request

```http
DELETE /api/v1/rbac/roles/2f7c6b10-7e95-4bd3-a1a5-9b6a12345678
Authorization: Bearer <access_token>
```

### Response 200/204

API forward theo phản hồi từ Directus khi xóa thành công (thường không có payload chi tiết).

---

## 6) GET /rbac/roles/:roleId/permissions

Lấy danh sách permission đang áp dụng cho role thông qua policy đang map với role đó.

### Path param

| Param    | Type     | Mô tả     |
| -------- | -------- | --------- |
| `roleId` | `string` | UUID role |

### Request

```http
GET /api/v1/rbac/roles/2f7c6b10-7e95-4bd3-a1a5-9b6a12345678/permissions
Authorization: Bearer <access_token>
```

### Response 200 (khi role chưa có policy)

```json
{
  "permissions": []
}
```

### Response 200 (example có dữ liệu)

```json
{
  "permissions": [
    {
      "id": "0dba2222-82df-4f11-9fbe-2a9f22222222",
      "collection": "gw_payment_vouchers",
      "action": "read",
      "permissions": null,
      "validation": null,
      "presets": null,
      "fields": ["*"],
      "policy": "9e8123a0-8ff7-4a84-a7bd-3b1d11111111"
    }
  ]
}
```

---

## 7) PATCH /rbac/roles/:roleId/permissions

Cập nhật quyền cho role theo danh sách `permissions`.

Luồng xử lý hiện tại:

1. Tìm access record `role + user null` để lấy policy của role.
2. Nếu chưa có policy, API tự tạo policy mới và tạo access map role -> policy.
3. Với từng item trong payload:
   - `access = false`: xóa permission tương ứng (nếu đang tồn tại).
   - `access = true`: update permission nếu đã có, hoặc tạo mới nếu chưa có.

### Path param

| Param    | Type     | Mô tả     |
| -------- | -------- | --------- |
| `roleId` | `string` | UUID role |

### Request body schema

```json
{
  "permissions": [
    {
      "collection": "string",
      "action": "string",
      "access": true,
      "fields": ["string"],
      "permissions": {},
      "validation": {}
    }
  ]
}
```

### Validation rules

| Field                       | Required | Type                 | Mô tả                                                |
| --------------------------- | -------- | -------------------- | ---------------------------------------------------- |
| `permissions`               | Bắt buộc | `array`              | Mảng cấu hình permission                             |
| `permissions[].collection`  | Bắt buộc | `string`             | Tên collection                                       |
| `permissions[].action`      | Bắt buộc | `string`             | Action (ví dụ: `read`, `create`, `update`, `delete`) |
| `permissions[].access`      | Bắt buộc | `boolean`            | `false` để xóa permission; `true` để tạo/cập nhật    |
| `permissions[].fields`      | Không    | `string[] \| string` | Field whitelist cho action                           |
| `permissions[].permissions` | Không    | `object`             | Điều kiện filter của Directus                        |
| `permissions[].validation`  | Không    | `object`             | Validation rule của Directus                         |

### Request body (example)

```json
{
  "permissions": [
    {
      "collection": "gw_payment_vouchers",
      "action": "read",
      "access": true,
      "fields": ["*"],
      "permissions": null,
      "validation": null
    },
    {
      "collection": "gw_payment_vouchers",
      "action": "delete",
      "access": false
    }
  ]
}
```

### Response 200

```json
{
  "success": true,
  "message": "Cập nhật quyền thành công"
}
```

---

## 8) GET /rbac/roles/:roleId/users

Lấy danh sách user (kèm email) đang thuộc role.

### Path param

| Param    | Type     | Mô tả     |
| -------- | -------- | --------- |
| `roleId` | `string` | UUID role |

### Request

```http
GET /api/v1/rbac/roles/2f7c6b10-7e95-4bd3-a1a5-9b6a12345678/users
Authorization: Bearer <access_token>
```

### Response 200

```json
{
  "users": [
    {
      "id": "a1b2c3d4-0000-0000-0000-000000000001",
      "email": "ketoan1@company.com",
      "first_name": "Nguyễn",
      "last_name": "Văn A"
    },
    {
      "id": "a1b2c3d4-0000-0000-0000-000000000002",
      "email": "ketoan2@company.com",
      "first_name": "Trần",
      "last_name": "Thị B"
    }
  ]
}
```

### Response 200 (khi role chưa có user)

```json
{
  "users": []
}
```

---

## 9) PATCH /rbac/roles/:roleId/users

Cập nhật danh sách user thuộc role. Payload là **danh sách đầy đủ** mong muốn — API tự diff so với trạng thái hiện tại và thực hiện gán/bỏ từng user.

Luồng xử lý:

1. Fetch danh sách user hiện đang thuộc role (current).
2. So sánh với `userIds` trong payload.
3. User có trong payload nhưng chưa thuộc role → PATCH `role = roleId`.
4. User đang thuộc role nhưng không có trong payload → PATCH `role = null`.

### Path param

| Param    | Type     | Mô tả     |
| -------- | -------- | --------- |
| `roleId` | `string` | UUID role |

### Request body schema

```json
{
  "userIds": ["string"]
}
```

### Validation rules

| Field     | Required | Type       | Mô tả                                       |
| --------- | -------- | ---------- | ------------------------------------------- |
| `userIds` | Bắt buộc | `string[]` | Danh sách UUID của các user muốn thuộc role |

### Request body (example)

```json
{
  "userIds": [
    "a1b2c3d4-0000-0000-0000-000000000001",
    "a1b2c3d4-0000-0000-0000-000000000002"
  ]
}
```

### Response 200

```json
{
  "success": true,
  "message": "Cập nhật user trong role thành công"
}
```

Ghi chú: gửi `userIds: []` sẽ bỏ toàn bộ user ra khỏi role (set `role = null` cho tất cả).

---

## Error responses thường gặp

| HTTP               | Khi nào xảy ra                                                                     |
| ------------------ | ---------------------------------------------------------------------------------- |
| `400 Bad Request`  | Payload không qua được `ValidationPipe` (sai kiểu, thiếu field bắt buộc trong DTO) |
| `401 Unauthorized` | Thiếu hoặc sai Bearer token                                                        |
| `4xx/5xx`          | Lỗi từ Directus sẽ được forward lại qua `HttpException`                            |

import { describe, expect, it } from 'bun:test';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApiCoreData } from './apiCoreData.mjs';
import { buildCoreManifest } from './apiCoreManifest.mjs';
import {
  WORKFLOW_STYLE,
  assertModuleAbsent,
  buildApiWorkflowData,
  workflowFileMap,
} from './apiWorkflowData.mjs';

const workflowManifest = buildCoreManifest(
  buildApiCoreData({ familyInput: 'sample-orders', entityInput: 'SampleOrder', styleInput: 'abstract-services' }),
);
const crudManifest = buildCoreManifest(
  buildApiCoreData({ familyInput: 'sample-items', entityInput: 'SampleItem', styleInput: 'engine' }),
);

const answers = {
  moduleInput: 'garage-sample-orders',
  entityInput: 'GarageSampleOrder',
  fieldSpecInput: 'code:string:required,name:string:required',
  tableNameInput: '',
  routePathInput: '',
  permissionResourceInput: '',
  wireInput: false,
};

describe('api-workflow-module: dữ liệu', () => {
  it('chỉ nhận họ kiểu abstract-services', () => {
    expect(WORKFLOW_STYLE).toBe('abstract-services');
    expect(() => buildApiWorkflowData(answers, crudManifest)).toThrow(/api-thin-module/);
  });

  it('sinh docType và tên Action của lõi từ manifest', () => {
    const data = buildApiWorkflowData(answers, workflowManifest);
    expect(data.docType).toBe('GARAGE_SAMPLE_ORDER');
    expect(data.coreEntity).toBe('SampleOrder');
    expect(data.modulePath).toBe('src/v2/modules/garage-sample-orders');
    expect(data.baseEntity).toBe('BaseSampleOrderEntity');
  });

  it('từ chối trường trùng với trường đã có trong lõi (status, createdBy)', () => {
    const clash = { ...answers, fieldSpecInput: 'status:status' };
    expect(() => buildApiWorkflowData(clash, workflowManifest, ['status', 'createdBy'])).toThrow(/status/);
  });
});

describe('api-workflow-module: danh sách file', () => {
  it('sinh đúng 6 file: entity, DTO tạo, command, spec command, controller, module', () => {
    const data = buildApiWorkflowData(answers, workflowManifest);
    const paths = workflowFileMap(data).map((f) => f.path);
    expect(paths).toEqual([
      'src/v2/modules/garage-sample-orders/entities/garage-sample-order.entity.ts',
      'src/v2/modules/garage-sample-orders/dto/create-garage-sample-order.dto.ts',
      'src/v2/modules/garage-sample-orders/services/garage-sample-order-command.service.ts',
      'src/v2/modules/garage-sample-orders/services/garage-sample-order-command.service.spec.ts',
      'src/v2/modules/garage-sample-orders/controllers/garage-sample-order.controller.ts',
      'src/v2/modules/garage-sample-orders/garage-sample-orders.module.ts',
    ]);
  });

  it('mọi template tham chiếu đều nằm trong plop-templates đã có', () => {
    const data = buildApiWorkflowData(answers, workflowManifest);
    for (const { template } of workflowFileMap(data)) {
      expect(template).toMatch(/^(thin-common|workflow-common)\/[\w.-]+\.hbs$/);
    }
  });
});

describe('api-workflow-module: chống ghi đè', () => {
  it('báo lỗi khi thư mục module đã tồn tại', () => {
    const root = mkdtempSync(join(tmpdir(), 'wf-test-'));
    const data = buildApiWorkflowData(answers, workflowManifest);
    mkdirSync(join(root, data.modulePath), { recursive: true });
    expect(() => assertModuleAbsent(root, data)).toThrow(/đã tồn tại/);
  });

  it('cho qua khi thư mục module chưa có', () => {
    const root = mkdtempSync(join(tmpdir(), 'wf-test-'));
    const data = buildApiWorkflowData(answers, workflowManifest);
    expect(() => assertModuleAbsent(root, data)).not.toThrow();
  });
});

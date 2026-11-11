/**
 * Danh sách file sinh ra cho một họ lõi V2.
 * `template` là đường dẫn trong `plop-templates/`, `path` là đường dẫn đích từ thư mục gốc của repo.
 */
export function coreFileMap(data) {
  const dir = data.coreDir;
  const svc = data.serviceTemplateDir;
  // Orchestrator không có entity, DTO hay vòng đời: chỉ cổng (contract), khung service, barrel và manifest
  if (data.orchestrator) {
    return [
      { template: 'core-orchestrator/contract.ts.hbs', path: `${dir}/contracts/${data.family}.contract.ts` },
      { template: 'core-orchestrator/barrel.ts.hbs', path: `${dir}/index.ts` },
      { template: 'core-common/manifest.json.hbs', path: `${dir}/core.manifest.json` },
      { template: `${svc}/service.ts.hbs`, path: `${dir}/services/${data.serviceFile}.ts` },
      { template: `${svc}/service.spec.ts.hbs`, path: `${dir}/services/${data.serviceFile}.spec.ts` },
    ];
  }
  // Kiểu abstract-services là họ chứng từ có vòng đời: dùng khung workflow (trạng thái, transition, hook CUSTOM)
  const workflow = data.style === 'abstract-services';
  return [
    {
      template: workflow ? 'workflow-common/contract.ts.hbs' : 'core-common/contract.ts.hbs',
      path: `${dir}/contracts/${data.family}.contract.ts`,
    },
    {
      template: workflow ? 'workflow-common/entity.ts.hbs' : 'core-common/entity.ts.hbs',
      path: `${dir}/entities/base-${data.entityKebab}.entity.ts`,
    },
    { template: 'core-common/create-dto.ts.hbs', path: `${dir}/dto/base-create-${data.entityKebab}.dto.ts` },
    { template: 'core-common/barrel.ts.hbs', path: `${dir}/index.ts` },
    { template: 'core-common/manifest.json.hbs', path: `${dir}/core.manifest.json` },
    { template: `${svc}/service.ts.hbs`, path: `${dir}/services/${data.serviceFile}.ts` },
    { template: `${svc}/service.spec.ts.hbs`, path: `${dir}/services/${data.serviceFile}.spec.ts` },
  ];
}

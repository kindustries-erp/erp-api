/**
 * Danh sách file sinh ra cho một họ lõi V2.
 * `template` là đường dẫn trong `plop-templates/`, `path` là đường dẫn đích từ thư mục gốc của repo.
 */
export function coreFileMap(data) {
  const dir = data.coreDir;
  const svc = data.serviceTemplateDir;
  return [
    { template: 'core-common/contract.ts.hbs', path: `${dir}/contracts/${data.family}.contract.ts` },
    { template: 'core-common/entity.ts.hbs', path: `${dir}/entities/base-${data.entityKebab}.entity.ts` },
    { template: 'core-common/create-dto.ts.hbs', path: `${dir}/dto/base-create-${data.entityKebab}.dto.ts` },
    { template: 'core-common/module.ts.hbs', path: `${dir}/${data.moduleFile}.ts` },
    { template: 'core-common/barrel.ts.hbs', path: `${dir}/index.ts` },
    { template: 'core-common/manifest.json.hbs', path: `${dir}/core.manifest.json` },
    { template: `${svc}/service.ts.hbs`, path: `${dir}/services/${data.serviceFile}.ts` },
    { template: `${svc}/service.spec.ts.hbs`, path: `${dir}/services/${data.serviceFile}.spec.ts` },
  ];
}

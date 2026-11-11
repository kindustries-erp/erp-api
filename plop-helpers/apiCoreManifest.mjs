/**
 * `core.manifest.json` của một họ lõi.
 * `api-thin-module` đọc file này để biết tên class Base, file barrel và kiểu service,
 * nên generator core và generator module mỏng không lệch nhau.
 */
export function buildCoreManifest(data) {
  return {
    schemaVersion: 1,
    layer: 'api',
    family: data.family,
    entity: data.entity,
    style: data.style,
    barrel: `${data.coreDir}/index.ts`,
    module: data.moduleClass ?? null,
    moduleFile: data.moduleFile ? `${data.moduleFile}.ts` : null,
    // Orchestrator không có entity và DTO: chỉ khai báo cổng (contract) và service nền
    baseClasses: data.orchestrator
      ? { contract: data.baseContract, service: data.serviceClass }
      : {
          entity: data.baseEntity,
          createDto: data.baseCreateDto,
          contract: data.baseContract,
          service: data.serviceClass,
        },
    serviceFile: `${data.serviceFile}.ts`,
    permissionPattern: data.family,
    requiredModuleFiles: data.orchestrator
      ? ['services']
      : ['contracts', 'controllers', 'dto', 'entities', 'services'],
  };
}

/** Nội dung JSON của manifest, đã thụt lề để ghi đúng file. */
export function manifestJson(data) {
  return `${JSON.stringify(buildCoreManifest(data), null, 2)}\n`;
}

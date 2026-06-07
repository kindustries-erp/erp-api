import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello() {
    return {
      message: 'ERP Core API bootstrap active',
    };
  }

  getHealth() {
    return {
      status: 'ok',
      app: 'erp-core-api',
    };
  }
}

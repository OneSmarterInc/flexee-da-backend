// src/app.setup.ts
//
// App-wide setup shared by main.ts and the e2e tests, so the tests run the
// same prefix and pipes as the deployed app.

import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { DISCOVERY_PATHS } from './modules/reporting/reporting.controller';

export function configureApp(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );

  app.enableCors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: '*',
    credentials: true,
  });

  // OAuth discovery documents must sit at the host root, outside /api.
  app.setGlobalPrefix(process.env.GLOBAL_PREFIX || 'api', {
    exclude: DISCOVERY_PATHS.map((path) => ({
      path,
      method: RequestMethod.GET,
    })),
  });
}

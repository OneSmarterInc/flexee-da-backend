// src/modules/reporting/urls.ts
import type { Request } from 'express';
import type { Urls } from './reporting-oauth.service';

/**
 * The API's public address (for the connector's metadata and token endpoint)
 * and the web app's (where admins sign in). PUBLIC_API_URL and FRONTEND_URL
 * should be set; without PUBLIC_API_URL, the address the request came in on
 * is used.
 */
export function reportingUrls(
  req: Request,
  env: NodeJS.ProcessEnv = process.env,
): Urls {
  const strip = (u: string) => u.replace(/\/+$/, '');
  const proto = (req.header('x-forwarded-proto') ?? req.protocol ?? 'https')
    .split(',')[0]
    .trim();
  const host = (
    req.header('x-forwarded-host') ??
    req.header('host') ??
    'localhost'
  )
    .split(',')[0]
    .trim();
  return {
    api: strip(env.PUBLIC_API_URL || `${proto}://${host}`),
    web: strip(env.FRONTEND_URL || 'http://localhost:3000'),
  };
}

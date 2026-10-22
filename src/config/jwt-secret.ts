// src/config/jwt-secret.ts
//
// The secret every login token is signed with. The backend used to fall back
// to the fixed string "your-secret-key" when JWT_SECRET was unset, which would
// let anyone sign an admin token. Now it refuses to start instead (V3 F2).

import { Logger } from '@nestjs/common';

/** Values seen in templates and tutorials; never accepted. */
const PLACEHOLDERS = new Set([
  'your-secret-key',
  'secret',
  'changeme',
  'change-me',
  'jwt-secret',
  'your_jwt_secret',
]);

let warned = false;

export function jwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error(
      'JWT_SECRET is not set. The backend will not start without it, because every login token is signed with it. Set it to a long random string.',
    );
  }
  if (PLACEHOLDERS.has(secret.toLowerCase())) {
    throw new Error(
      'JWT_SECRET is a well-known placeholder, so anyone could sign a login token. Set it to a long random string.',
    );
  }
  if (secret.length < 32 && !warned) {
    warned = true;
    new Logger('JwtSecret').warn(
      'JWT_SECRET is shorter than 32 characters. Use a longer random string.',
    );
  }
  return secret;
}

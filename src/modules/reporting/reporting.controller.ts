// src/modules/reporting/reporting.controller.ts
//
// The reporting connector's HTTP side (Flexee family reporting contract v1),
// ported from Flexee BPM.
//
// Machine-facing endpoints (no session): discovery metadata at the host root,
// client registration, the token endpoint and the MCP endpoint at
// /api/mcp/reporting. The sign-in page lives on the web app, where the admin
// is signed in; it calls the admin-only check/approve/deny endpoints here.

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { UserRole } from '../../entities/index.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  ReportingOAuthService,
  SCOPE,
  authorizationServerMetadata,
  protectedResourceMetadata,
  resourceUrl,
} from './reporting-oauth.service';
import { JsonRpcMessage, McpService } from './mcp.service';
import { reportingUrls } from './urls';

const CALLS_PER_MINUTE = 120;
const window = new Map<string, { start: number; count: number }>();
function limited(key: string) {
  const now = Date.now();
  const w = window.get(key);
  if (!w || now - w.start >= 60_000) {
    window.set(key, { start: now, count: 1 });
    return false;
  }
  w.count++;
  return w.count > CALLS_PER_MINUTE;
}

const asBody = (b: unknown) =>
  (b && typeof b === 'object' ? b : {}) as Record<string, unknown>;

/** The paths main.ts keeps out of the /api prefix. */
export const DISCOVERY_PATHS = [
  '.well-known/oauth-protected-resource',
  '.well-known/oauth-protected-resource/api/mcp/reporting',
  '.well-known/oauth-authorization-server',
  '.well-known/oauth-authorization-server/api/oauth/reporting',
];

/** Discovery documents, served at the host root. */
@ApiExcludeController()
@Controller('.well-known')
export class ReportingDiscoveryController {
  @Get([
    'oauth-protected-resource',
    'oauth-protected-resource/api/mcp/reporting',
  ])
  resource(@Req() req: Request) {
    return protectedResourceMetadata(reportingUrls(req));
  }

  @Get([
    'oauth-authorization-server',
    'oauth-authorization-server/api/oauth/reporting',
  ])
  server(@Req() req: Request) {
    return authorizationServerMetadata(reportingUrls(req));
  }
}

@ApiExcludeController()
@Controller()
export class ReportingController {
  constructor(
    private readonly oauth: ReportingOAuthService,
    private readonly mcp: McpService,
  ) {}

  @Post('oauth/reporting/register')
  async register(
    @Req() req: Request,
    @Body() body: unknown,
    @Res() res: Response,
  ) {
    if (limited(`register:${req.ip}`))
      return res.status(429).json({ error: 'rate_limited' });
    const result = await this.oauth.register(asBody(body));
    res
      .set('Cache-Control', 'no-store')
      .status(result.ok ? 201 : 400)
      .json(result.body);
  }

  @Post('oauth/reporting/token')
  async token(
    @Req() req: Request,
    @Body() body: unknown,
    @Res() res: Response,
  ) {
    if (limited(`token:${req.ip}`))
      return res.status(429).json({ error: 'rate_limited' });
    const result = await this.oauth.token(asBody(body));
    res
      .set({ 'Cache-Control': 'no-store', Pragma: 'no-cache' })
      .status(result.ok ? 200 : 400)
      .json(result.body);
  }

  @Post('mcp/reporting')
  async mcpPost(@Req() req: Request, @Res() res: Response) {
    const header = req.header('authorization') ?? '';
    const bearer = /^Bearer\s+(.+)$/i.exec(header)?.[1]?.trim();
    const connection = await this.oauth.authenticate(bearer);
    if (!connection) {
      const urls = reportingUrls(req);
      let challenge = `Bearer resource_metadata="${urls.api}/.well-known/oauth-protected-resource/api/mcp/reporting", scope="${SCOPE}"`;
      if (bearer) challenge += ', error="invalid_token"';
      return res.status(401).set('WWW-Authenticate', challenge).json({
        error: 'invalid_token',
        error_description:
          'Sign in with a Flexee DA admin account to use the reporting connector.',
      });
    }
    if (limited(`mcp:${connection.id}`))
      return res
        .status(429)
        .set('Retry-After', '60')
        .json({ error: 'rate_limited' });
    const message: unknown = req.body;
    if (!message || typeof message !== 'object' || Array.isArray(message))
      return res
        .status(400)
        .json(
          this.mcp.error(
            null,
            -32700,
            'Send one JSON-RPC message as a JSON object.',
          ),
        );
    const reply = await this.mcp.handle(message as JsonRpcMessage, connection);
    if (reply === null) return res.status(202).end();
    res.status(200).json(reply);
  }

  @Get('mcp/reporting')
  mcpGet(@Res() res: Response) {
    res
      .status(405)
      .set('Allow', 'POST')
      .send('This MCP endpoint answers POST requests only.');
  }
}

type AdminRequest = Request & { user?: { _id?: Types.ObjectId | string } };

/**
 * For the web app's sign-in page and Admin › Reporting. Admins only, and the
 * account must still be an active admin.
 */
@ApiExcludeController()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportingAdminController {
  constructor(private readonly oauth: ReportingOAuthService) {}

  private async admin(req: AdminRequest) {
    const id = req.user?._id ? String(req.user._id) : '';
    if (!(await this.oauth.isAdmin(id)))
      throw new BadRequestException(
        'Only Flexee DA admins can connect Claude to reporting.',
      );
    return id;
  }

  /** What the sign-in page shows: the client's name, or why the request can't go ahead. */
  @Get('oauth/reporting/check')
  @Roles(UserRole.ADMIN)
  async check(
    @Req() req: AdminRequest,
    @Query() q: Record<string, string | undefined>,
  ) {
    await this.admin(req);
    const urls = reportingUrls(req);
    const c = await this.oauth.check(q, urls);
    if (c.error && !c.redirectable)
      return { ok: false, description: c.description };
    if (c.error)
      return {
        ok: false,
        description: c.description,
        redirect: back(c.redirect!, {
          error: c.error,
          error_description: c.description,
          state: q.state,
        }),
      };
    return {
      ok: true,
      client: c.client!.name ?? 'Claude',
      resource: resourceUrl(urls),
    };
  }

  @Post('oauth/reporting/approve')
  @HttpCode(200)
  @Roles(UserRole.ADMIN)
  async approve(
    @Req() req: AdminRequest,
    @Body() body: Record<string, string | undefined>,
  ) {
    const userId = await this.admin(req);
    const urls = reportingUrls(req);
    const c = await this.oauth.check(body, urls);
    if (c.error) throw new BadRequestException(c.description);
    const code = await this.oauth.issueCode(
      c.client!,
      userId,
      c.redirect!,
      body.code_challenge!,
    );
    return {
      redirect: back(c.redirect!, { code, state: body.state, iss: urls.api }),
    };
  }

  @Post('oauth/reporting/deny')
  @HttpCode(200)
  @Roles(UserRole.ADMIN)
  async deny(
    @Req() req: AdminRequest,
    @Body() body: Record<string, string | undefined>,
  ) {
    await this.admin(req);
    const c = await this.oauth.check(body, reportingUrls(req));
    if (!c.redirectable) throw new BadRequestException(c.description);
    return {
      redirect: back(c.redirect!, {
        error: 'access_denied',
        error_description: 'The admin declined.',
        state: body.state,
      }),
    };
  }

  @Get('admin/reporting')
  @Roles(UserRole.ADMIN)
  async connections(@Req() req: AdminRequest) {
    await this.admin(req);
    return {
      connectorUrl: resourceUrl(reportingUrls(req)),
      connections: await this.oauth.connections(),
    };
  }

  @Post('admin/reporting/connections/:id/revoke')
  @HttpCode(200)
  @Roles(UserRole.ADMIN)
  async revoke(@Req() req: AdminRequest, @Param('id') id: string) {
    const userId = await this.admin(req);
    await this.oauth.revoke(id, userId);
    return { connections: await this.oauth.connections() };
  }
}

function back(redirect: string, params: Record<string, string | undefined>) {
  const url = new URL(redirect);
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== '') url.searchParams.set(k, v);
  return url.toString();
}

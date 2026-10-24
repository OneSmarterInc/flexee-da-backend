// src/modules/reporting/reporting-oauth.service.ts
//
// The OAuth side of the reporting connector (Flexee family reporting contract
// v1, RP3), ported from Flexee BPM's reporting-oauth.service.ts (itself from
// Financial Accounting's ReportingOAuth), with PostgreSQL swapped for MongoDB.
//
// Authorization code with S256 PKCE for public clients: Claude's Client ID
// Metadata Document (read only from claude.ai or claude.com) or Dynamic
// Client Registration. Codes are single-use for ten minutes, access tokens
// last an hour and refresh tokens rotate on every use. Only DA admins can
// approve, and a connection stops working the moment its admin stops being
// an active admin. Every code and token is stored only as a SHA-256 hash.
//
// The sign-in page is the web app's (it holds the admin's session); this
// service checks and approves for it.

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Model, Types } from 'mongoose';
import { User, UserDocument, UserRole } from '../../entities/index.entity';
import {
  ReportingCall,
  ReportingClient,
  ReportingCode,
  ReportingConnection,
} from './reporting.schemas';

export const SCOPE = 'reporting:read';
export const ACCESS_MINUTES = 60;
export const REFRESH_DAYS = 30;
const REDIRECT_HOSTS = ['claude.ai', 'claude.com', 'localhost', '127.0.0.1'];
const CLIENT_METADATA_HOSTS = ['claude.ai', 'claude.com'];
const PKCE = /^[A-Za-z0-9\-._~]{43,128}$/;

export interface Urls {
  api: string;
  web: string;
}
export interface ClientRow {
  id: string;
  clientId: string;
  kind: 'cimd' | 'dcr';
  name: string | null;
  redirectUris: string[];
  updatedAt: Date;
}
export interface Connection {
  id: string;
  userId: string;
  clientRef: string;
}
type Body = Record<string, unknown>;
export type OAuthResult =
  | { ok: true; body: Body }
  | { ok: false; body: { error: string; error_description: string } };

export const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
const token = (prefix: string) => prefix + randomBytes(32).toString('hex');
const fail = (error: string, error_description: string): OAuthResult => ({
  ok: false,
  body: { error, error_description },
});
/** A form or JSON field as a string; anything else counts as missing. */
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const minutesFromNow = (m: number) => new Date(Date.now() + m * 60_000);
const daysFromNow = (d: number) => new Date(Date.now() + d * 86_400_000);

/** The connector's MCP address. */
export function resourceUrl(urls: Urls) {
  return `${urls.api}/mcp/reporting`;
}

/** RFC 9728 */
export function protectedResourceMetadata(urls: Urls) {
  return {
    resource: resourceUrl(urls),
    authorization_servers: [urls.api],
    scopes_supported: [SCOPE],
    bearer_methods_supported: ['header'],
    resource_name: 'Flexee DA reporting',
  };
}

/** RFC 8414. Sign-in happens on the web app, where the admin is signed in; tokens come from the API. */
export function authorizationServerMetadata(urls: Urls) {
  return {
    issuer: urls.api,
    authorization_endpoint: `${urls.web}/oauth/reporting/authorize`,
    token_endpoint: `${urls.api}/api/oauth/reporting/token`,
    registration_endpoint: `${urls.api}/api/oauth/reporting/register`,
    scopes_supported: [SCOPE],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    client_id_metadata_document_supported: true,
  };
}

/** https on Claude's hosts, or a loopback address (Claude Code's local callback). */
export function redirectAllowed(uri: string) {
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  const host = u.hostname.toLowerCase();
  if (u.hash || !REDIRECT_HOSTS.includes(host)) return false;
  const loopback = ['localhost', '127.0.0.1'].includes(host);
  return u.protocol === 'https:' || (loopback && u.protocol === 'http:');
}

/** Exact match, or for a loopback address everything but the port (RFC 8252). */
export function redirectMatches(registered: string[], uri: string) {
  for (const r of registered) {
    if (same(r, uri)) return true;
    try {
      const a = new URL(r);
      const b = new URL(uri);
      if (
        ['localhost', '127.0.0.1'].includes(a.hostname) &&
        a.protocol === b.protocol &&
        a.hostname === b.hostname &&
        a.pathname === b.pathname
      )
        return true;
    } catch {
      /* not a URL */
    }
  }
  return false;
}

type ClientDoc = ReportingClient & { _id: Types.ObjectId };
const toClient = (d: ClientDoc): ClientRow => ({
  id: String(d._id),
  clientId: d.clientId,
  kind: d.kind,
  name: d.name,
  redirectUris: d.redirectUris,
  updatedAt: d.updatedAt,
});

@Injectable()
export class ReportingOAuthService {
  /** Replaced in tests. */
  fetcher: typeof fetch = fetch;

  constructor(
    @InjectModel(ReportingClient.name)
    private readonly clients: Model<ReportingClient>,
    @InjectModel(ReportingCode.name)
    private readonly codes: Model<ReportingCode>,
    @InjectModel(ReportingConnection.name)
    private readonly connectionsModel: Model<ReportingConnection>,
    @InjectModel(ReportingCall.name)
    private readonly calls: Model<ReportingCall>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
  ) {}

  /** RFC 7591 */
  async register(input: Body): Promise<OAuthResult> {
    const uris = input.redirect_uris;
    if (!Array.isArray(uris) || uris.length === 0 || uris.length > 5)
      return fail('invalid_redirect_uri', 'Give one to five redirect URIs.');
    if (
      !uris.every(
        (u) => typeof u === 'string' && u.length <= 500 && redirectAllowed(u),
      )
    )
      return fail(
        'invalid_redirect_uri',
        'This connector signs in only for Claude.',
      );
    if ((input.token_endpoint_auth_method ?? 'none') !== 'none')
      return fail(
        'invalid_client_metadata',
        'Only public clients (token_endpoint_auth_method "none") are supported.',
      );
    const clientId = `flexee-da-${randomBytes(16).toString('hex')}`;
    const name =
      typeof input.client_name === 'string'
        ? input.client_name.replace(/<[^>]*>/g, '').slice(0, 200)
        : null;
    const now = new Date();
    await this.clients.create({
      clientIdHash: hash(clientId),
      clientId,
      kind: 'dcr',
      name,
      redirectUris: uris as string[],
    });
    return {
      ok: true,
      body: {
        client_id: clientId,
        client_id_issued_at: Math.floor(now.getTime() / 1000),
        client_name: name,
        redirect_uris: uris,
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        scope: SCOPE,
      },
    };
  }

  /** A client registered here, or Claude's published identity, read from its metadata document (cached a day). */
  async client(clientId: string): Promise<ClientRow | null> {
    if (!clientId || clientId.length > 500) return null;
    const found = await this.clients
      .findOne({ clientIdHash: hash(clientId) })
      .lean<ClientDoc>();
    if (
      found &&
      (found.kind === 'dcr' ||
        new Date(found.updatedAt).getTime() > Date.now() - 86_400_000)
    )
      return toClient(found);
    let url: URL;
    try {
      url = new URL(clientId);
    } catch {
      return null;
    }
    if (
      url.protocol !== 'https:' ||
      !CLIENT_METADATA_HOSTS.includes(url.hostname.toLowerCase())
    )
      return null;
    let doc: Body;
    try {
      const res = await this.fetcher(clientId, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return found ? toClient(found) : null;
      doc = (await res.json()) as Body;
    } catch {
      return found ? toClient(found) : null;
    }
    if (doc?.client_id !== clientId || !Array.isArray(doc.redirect_uris))
      return null;
    const uris = (doc.redirect_uris as unknown[]).filter(
      (u): u is string =>
        typeof u === 'string' && u.length <= 500 && redirectAllowed(u),
    );
    if (uris.length === 0) return null;
    const name =
      typeof doc.client_name === 'string'
        ? doc.client_name.replace(/<[^>]*>/g, '').slice(0, 200)
        : null;
    const saved = await this.clients
      .findOneAndUpdate(
        { clientIdHash: hash(clientId) },
        {
          $set: { name, redirectUris: uris },
          $setOnInsert: {
            clientIdHash: hash(clientId),
            clientId,
            kind: 'cimd',
          },
        },
        { upsert: true, new: true },
      )
      .lean<ClientDoc>();
    return saved ? toClient(saved) : null;
  }

  /**
   * Checks an authorization request. A bad client or return address is shown
   * on our page (redirectable false); anything else goes back to the client
   * as an OAuth error.
   */
  async check(
    q: Record<string, string | undefined>,
    urls: Urls,
  ): Promise<{
    client?: ClientRow;
    redirect?: string;
    error?: string;
    description?: string;
    redirectable: boolean;
  }> {
    const client = await this.client(q.client_id ?? '');
    if (!client)
      return {
        error: 'invalid_client',
        description:
          "This sign-in request comes from a client the Flexee DA reporting connector doesn't know.",
        redirectable: false,
      };
    let redirect = q.redirect_uri ?? '';
    if (!redirect && client.redirectUris.length === 1)
      redirect = client.redirectUris[0];
    if (!redirect || !redirectMatches(client.redirectUris, redirect))
      return {
        error: 'invalid_request',
        description:
          "The sign-in request names a return address that wasn't registered.",
        redirectable: false,
      };
    const base = { client, redirect, redirectable: true };
    if (q.response_type !== 'code')
      return {
        ...base,
        error: 'unsupported_response_type',
        description: 'Only response_type=code is supported.',
      };
    if (
      q.code_challenge_method !== 'S256' ||
      !PKCE.test(q.code_challenge ?? '')
    )
      return {
        ...base,
        error: 'invalid_request',
        description: 'A PKCE code_challenge with method S256 is required.',
      };
    const scopes = (q.scope ?? '').trim().split(/\s+/).filter(Boolean);
    if (scopes.some((s) => s !== SCOPE && s !== 'offline_access'))
      return {
        ...base,
        error: 'invalid_scope',
        description: `The only scope is ${SCOPE}.`,
      };
    if (q.resource && q.resource.replace(/\/$/, '') !== resourceUrl(urls))
      return {
        ...base,
        error: 'invalid_target',
        description: `The resource must be ${resourceUrl(urls)}.`,
      };
    return base;
  }

  async issueCode(
    client: ClientRow,
    userId: string,
    redirect: string,
    challenge: string,
  ) {
    const code = randomBytes(32).toString('hex');
    await this.codes.create({
      codeHash: hash(code),
      clientRef: new Types.ObjectId(client.id),
      userId: new Types.ObjectId(userId),
      redirectUri: redirect,
      codeChallenge: challenge,
      scope: SCOPE,
      expiresAt: minutesFromNow(10),
    });
    return code;
  }

  async token(p: Body): Promise<OAuthResult> {
    if (p.grant_type === 'authorization_code') return this.exchange(p);
    if (p.grant_type === 'refresh_token') return this.refresh(p);
    return fail(
      'unsupported_grant_type',
      'Use authorization_code or refresh_token.',
    );
  }

  private async exchange(p: Body): Promise<OAuthResult> {
    const client = await this.client(str(p.client_id));
    const code = await this.codes
      .findOne({ codeHash: hash(str(p.code)) })
      .lean();
    if (!client || !code || String(code.clientRef) !== client.id)
      return fail('invalid_grant', "The code isn't valid.");
    // One use only: claim the code before checking the rest.
    const claimed = await this.codes.updateOne(
      { _id: code._id, usedAt: null },
      { $set: { usedAt: new Date() } },
    );
    if (
      claimed.modifiedCount !== 1 ||
      new Date(code.expiresAt).getTime() < Date.now()
    )
      return fail('invalid_grant', 'The code has been used or has expired.');
    if (str(p.redirect_uri) && !same(code.redirectUri, str(p.redirect_uri)))
      return fail(
        'invalid_grant',
        "The redirect_uri doesn't match the sign-in.",
      );
    const verifier = str(p.code_verifier);
    const expected = createHash('sha256').update(verifier).digest('base64url');
    if (!PKCE.test(verifier) || !same(code.codeChallenge, expected))
      return fail('invalid_grant', "The PKCE code_verifier doesn't match.");
    if (!(await this.isAdmin(String(code.userId))))
      return fail('invalid_grant', 'Only Flexee DA admins can connect.');
    const access = token('flxa_');
    const refresh = token('flxr_');
    await this.connectionsModel.create({
      clientRef: new Types.ObjectId(client.id),
      userId: code.userId,
      scope: code.scope,
      accessHash: hash(access),
      accessExpiresAt: minutesFromNow(ACCESS_MINUTES),
      refreshHash: hash(refresh),
      refreshExpiresAt: daysFromNow(REFRESH_DAYS),
    });
    await this.clients.updateOne(
      { _id: new Types.ObjectId(client.id) },
      { $set: { lastUsedAt: new Date() } },
    );
    return this.tokens(access, refresh);
  }

  private async refresh(p: Body): Promise<OAuthResult> {
    const client = await this.client(str(p.client_id));
    const old = hash(str(p.refresh_token));
    const c = await this.connectionsModel
      .findOne({
        refreshHash: old,
        revokedAt: null,
        refreshExpiresAt: { $gt: new Date() },
      })
      .lean();
    if (
      !client ||
      !c ||
      String(c.clientRef) !== client.id ||
      !(await this.isAdmin(String(c.userId)))
    )
      return fail('invalid_grant', "The refresh token isn't valid.");
    const access = token('flxa_');
    const refresh = token('flxr_');
    // Rotate: the old refresh token stops working in the same write that issues the new one.
    const rotated = await this.connectionsModel.updateOne(
      { _id: c._id, refreshHash: old },
      {
        $set: {
          accessHash: hash(access),
          accessExpiresAt: minutesFromNow(ACCESS_MINUTES),
          refreshHash: hash(refresh),
          refreshExpiresAt: daysFromNow(REFRESH_DAYS),
        },
      },
    );
    if (rotated.modifiedCount !== 1)
      return fail('invalid_grant', 'The refresh token has already been used.');
    return this.tokens(access, refresh);
  }

  /** The live connection a bearer token belongs to, while its admin is still an active admin. */
  async authenticate(bearer: string | undefined): Promise<Connection | null> {
    if (!bearer || !bearer.startsWith('flxa_')) return null;
    const c = await this.connectionsModel
      .findOne({
        accessHash: hash(bearer),
        revokedAt: null,
        accessExpiresAt: { $gt: new Date() },
      })
      .lean();
    if (!c || !(await this.isAdmin(String(c.userId)))) return null;
    await this.connectionsModel.updateOne(
      { _id: c._id },
      { $set: { lastUsedAt: new Date() } },
    );
    return {
      id: String(c._id),
      userId: String(c.userId),
      clientRef: String(c.clientRef),
    };
  }

  async isAdmin(userId: string) {
    if (!Types.ObjectId.isValid(userId)) return false;
    const u = await this.users.findById(userId).select('role isActive').lean();
    return !!u && u.role === UserRole.ADMIN && u.isActive === true;
  }

  async activeConnections(): Promise<number> {
    return this.connectionsModel.countDocuments({
      revokedAt: null,
      refreshExpiresAt: { $gt: new Date() },
    });
  }

  /** Admin › Reporting: every connection, newest first. */
  async connections() {
    const rows = await this.connectionsModel
      .find({})
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    const users = await this.users
      .find({ _id: { $in: rows.map((r) => r.userId) } })
      .select('email')
      .lean();
    const clients = await this.clients
      .find({ _id: { $in: rows.map((r) => r.clientRef) } })
      .select('name')
      .lean();
    const since = new Date(Date.now() - 7 * 86_400_000);
    const counts = await this.calls.aggregate<{
      _id: Types.ObjectId;
      n: number;
    }>([
      {
        $match: {
          connectionId: { $in: rows.map((r) => r._id) },
          createdAt: { $gt: since },
        },
      },
      { $group: { _id: '$connectionId', n: { $sum: 1 } } },
    ]);
    const email = new Map(
      users.map((u) => [(u._id as Types.ObjectId).toHexString(), u.email]),
    );
    const clientName = new Map(clients.map((c) => [String(c._id), c.name]));
    const calls = new Map(counts.map((c) => [String(c._id), c.n]));
    return rows.map((r) => ({
      id: String(r._id),
      admin: email.get(String(r.userId)) ?? null,
      client: clientName.get(String(r.clientRef)) ?? 'Claude',
      connectedAt: new Date(r.createdAt).toISOString(),
      lastUsedAt: r.lastUsedAt ? new Date(r.lastUsedAt).toISOString() : null,
      active:
        !r.revokedAt && new Date(r.refreshExpiresAt).getTime() > Date.now(),
      revokedAt: r.revokedAt ? new Date(r.revokedAt).toISOString() : null,
      calls7d: calls.get(String(r._id)) ?? 0,
    }));
  }

  async revoke(connectionId: string, byUserId: string) {
    if (!Types.ObjectId.isValid(connectionId)) return false;
    const r = await this.connectionsModel.updateOne(
      { _id: new Types.ObjectId(connectionId), revokedAt: null },
      {
        $set: {
          revokedAt: new Date(),
          revokedBy: Types.ObjectId.isValid(byUserId)
            ? new Types.ObjectId(byUserId)
            : null,
        },
      },
    );
    return r.modifiedCount === 1;
  }

  /** One tool call, for Admin › Reporting's seven-day count. Never throws. */
  async logCall(
    connection: Connection,
    tool: string,
    status: string,
    rows: number,
    ms: number,
  ) {
    try {
      await this.calls.create({
        connectionId: new Types.ObjectId(connection.id),
        tool,
        status,
        rows,
        ms,
      });
    } catch {
      /* a logging failure must not fail the call */
    }
  }

  private tokens(access: string, refresh: string): OAuthResult {
    return {
      ok: true,
      body: {
        access_token: access,
        token_type: 'Bearer',
        expires_in: ACCESS_MINUTES * 60,
        refresh_token: refresh,
        scope: SCOPE,
      },
    };
  }
}

// src/modules/reporting/mcp.service.ts
//
// The connector's MCP side, ported from Flexee BPM. Stateless JSON-RPC over
// HTTP POST (Streamable HTTP, answered as JSON): initialize, ping, tools/list
// and tools/call. Every tool is read-only and takes no arguments. Each call is
// logged with its tool, status, row count and time, never its rows.

import { Injectable, Logger } from '@nestjs/common';
import {
  CONTRACT,
  SIM,
  TOOLS,
  ReportingViewsService,
} from './reporting-views.service';
import { Connection, ReportingOAuthService } from './reporting-oauth.service';

export const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26'];
export type JsonRpcMessage = {
  jsonrpc?: unknown;
  id?: unknown;
  method?: unknown;
  params?: unknown;
};

@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name);

  constructor(
    private readonly views: ReportingViewsService,
    private readonly oauth: ReportingOAuthService,
  ) {}

  /** The reply to one JSON-RPC message, or null for a notification. */
  async handle(
    message: JsonRpcMessage,
    connection: Connection,
  ): Promise<Record<string, unknown> | null> {
    const id = message.id ?? null;
    if (message.jsonrpc !== '2.0' || typeof message.method !== 'string')
      return this.error(id, -32600, 'Invalid request.');
    if (!('id' in message)) return null;
    const params = (
      message.params && typeof message.params === 'object' ? message.params : {}
    ) as Record<string, unknown>;
    switch (message.method) {
      case 'initialize': {
        const asked =
          typeof params.protocolVersion === 'string'
            ? params.protocolVersion
            : '';
        return this.result(id, {
          protocolVersion: PROTOCOL_VERSIONS.includes(asked)
            ? asked
            : PROTOCOL_VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: {
            name: 'flexee-da-reporting',
            title: 'Flexee DA reporting',
            version: CONTRACT,
          },
          instructions:
            `Read-only operational reporting for ${SIM} (Flexee family reporting contract ${CONTRACT}). ` +
            'Each tool returns {"rows": [...]}; every row starts with "sim". Times are UTC (ISO 8601), money is US dollars. ' +
            'In DA a course is a simulation; quarters 1 to 3 are warm-up history and students decide from quarter 4. ' +
            'There are no names of people, no student work and no firm results.',
        });
      }
      case 'ping':
        return this.result(id, {});
      case 'tools/list':
        return this.result(id, { tools: this.tools() });
      case 'tools/call':
        return this.call(id, params, connection);
      default:
        return this.error(id, -32601, `Method not found: ${message.method}`);
    }
  }

  tools() {
    return Object.entries(TOOLS).map(([name, tool]) => ({
      name,
      title: tool.title,
      description: `${tool.description}\n\nColumns:\n${Object.entries(
        tool.columns,
      )
        .map(([c, d]) => `${c}: ${d}`)
        .join('\n')}`,
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      outputSchema: {
        type: 'object',
        properties: { rows: { type: 'array', items: { type: 'object' } } },
        required: ['rows'],
      },
      annotations: {
        title: tool.title,
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    }));
  }

  private async call(
    id: unknown,
    params: Record<string, unknown>,
    connection: Connection,
  ) {
    const name = typeof params.name === 'string' ? params.name : '';
    if (!(name in TOOLS))
      return this.error(id, -32602, `Unknown tool: ${name}`);
    const started = Date.now();
    try {
      const rows = await this.views.run(name);
      await this.oauth.logCall(
        connection,
        name,
        'ok',
        rows.length,
        Date.now() - started,
      );
      return this.result(id, {
        content: [{ type: 'text', text: JSON.stringify({ rows }) }],
        structuredContent: { rows },
        isError: false,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[reporting] ${name} failed: ${message}`);
      await this.oauth.logCall(
        connection,
        name,
        'error',
        0,
        Date.now() - started,
      );
      return this.result(id, {
        content: [
          {
            type: 'text',
            text: "The report couldn't be worked out just now. Try again shortly.",
          },
        ],
        isError: true,
      });
    }
  }

  private result(id: unknown, result: unknown) {
    return { jsonrpc: '2.0', id, result };
  }

  error(id: unknown, code: number, message: string) {
    return { jsonrpc: '2.0', id, error: { code, message } };
  }
}

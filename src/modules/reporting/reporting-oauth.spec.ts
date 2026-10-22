import {
  authorizationServerMetadata,
  protectedResourceMetadata,
  redirectAllowed,
  redirectMatches,
} from './reporting-oauth.service';
import { reportingUrls } from './urls';
import { McpService } from './mcp.service';
import { TOOLS } from './reporting-views.service';

describe('reporting connector rules', () => {
  const urls = {
    api: 'https://api.example.test',
    web: 'https://da.example.test',
  };

  it('signs in only for Claude, or a loopback callback', () => {
    expect(redirectAllowed('https://claude.ai/api/mcp/auth_callback')).toBe(
      true,
    );
    expect(redirectAllowed('https://claude.com/api/mcp/auth_callback')).toBe(
      true,
    );
    expect(redirectAllowed('http://localhost:33418/callback')).toBe(true);
    expect(redirectAllowed('http://claude.ai/callback')).toBe(false);
    expect(redirectAllowed('https://evil.example/callback')).toBe(false);
    expect(redirectAllowed('https://claude.ai/cb#frag')).toBe(false);
    expect(redirectAllowed('not a url')).toBe(false);
  });

  it('matches a registered address exactly, or a loopback one on any port', () => {
    expect(
      redirectMatches(['https://claude.ai/cb'], 'https://claude.ai/cb'),
    ).toBe(true);
    expect(
      redirectMatches(['https://claude.ai/cb'], 'https://claude.ai/cb2'),
    ).toBe(false);
    expect(
      redirectMatches(['http://localhost:1/cb'], 'http://localhost:9999/cb'),
    ).toBe(true);
    expect(
      redirectMatches(['http://localhost:1/cb'], 'http://localhost:9999/other'),
    ).toBe(false);
  });

  it('publishes discovery metadata with the API and the web sign-in page', () => {
    expect(protectedResourceMetadata(urls)).toMatchObject({
      resource: 'https://api.example.test/api/mcp/reporting',
      authorization_servers: ['https://api.example.test'],
      scopes_supported: ['reporting:read'],
    });
    expect(authorizationServerMetadata(urls)).toMatchObject({
      issuer: 'https://api.example.test',
      authorization_endpoint:
        'https://da.example.test/oauth/reporting/authorize',
      token_endpoint: 'https://api.example.test/api/oauth/reporting/token',
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
    });
  });

  it('uses PUBLIC_API_URL and FRONTEND_URL, else the request host', () => {
    const req = {
      header: (h: string) =>
        ({ 'x-forwarded-proto': 'https', host: 'da-api.vercel.app' })[h],
      protocol: 'http',
    } as never;
    expect(reportingUrls(req, {})).toEqual({
      api: 'https://da-api.vercel.app',
      web: 'http://localhost:3000',
    });
    expect(
      reportingUrls(req, {
        PUBLIC_API_URL: 'https://api.da.test/',
        FRONTEND_URL: 'https://da.test/',
      }),
    ).toEqual({ api: 'https://api.da.test', web: 'https://da.test' });
  });

  it("lists the contract's six tools, read-only and without arguments", () => {
    const mcp = new McpService({} as never, {} as never);
    const tools = mcp.tools();
    expect(tools.map((t) => t.name)).toEqual([
      'report_courses',
      'report_quarters',
      'report_closes',
      'report_requests',
      'report_ai_use',
      'report_health',
    ]);
    for (const t of tools) {
      expect(t.annotations.readOnlyHint).toBe(true);
      expect(t.inputSchema).toEqual({
        type: 'object',
        properties: {},
        additionalProperties: false,
      });
    }
  });

  it('starts every tool\'s columns with "sim"', () => {
    for (const tool of Object.values(TOOLS)) {
      expect(Object.keys(tool.columns)[0]).toBe('sim');
    }
  });
  it('has exactly the contract v1 columns, in order', () => {
    // Columns copied from CF_V3_Reporting_Contract_v1.md. report_closes also has
    // `source`, as in BPM's connector.
    const CONTRACT_V1: Record<string, string[]> = {
      report_courses: [
        'sim',
        'course_id',
        'course',
        'institution',
        'product',
        'engine_version',
        'status',
        'quarter_now',
        'quarters',
        'firms',
        'students',
        'students_confirmed',
        'next_deadline_at',
        'created_at',
        'deployed_at',
      ],
      report_quarters: [
        'sim',
        'course_id',
        'course',
        'quarter',
        'warm_up',
        'state',
        'deadline_at',
        'deadline_extended',
        'opened_at',
        'opened_after_deadline',
        'overdue',
        'close_started_at',
        'closed_at',
        'close_minutes',
        'firms',
        'firms_submitted',
        'firms_carried_forward',
        'explanations_required',
        'explanations_submitted',
      ],
      report_closes: [
        'sim',
        'close_id',
        'course_id',
        'course',
        'quarter',
        'firm_id',
        'status',
        'error_code',
        'started_at',
        'completed_at',
        'seconds',
      ],
      report_requests: [
        'sim',
        'request_id',
        'course_id',
        'course',
        'quarter',
        'status',
        'filed_at',
        'decided_at',
        'days_waiting',
        'has_reason',
        'review',
      ],
      report_ai_use: [
        'sim',
        'course_id',
        'course',
        'month',
        'feature',
        'calls',
        'failures',
        'sentences_dropped',
        'input_tokens',
        'output_tokens',
        'cost_usd',
      ],
      report_health: [
        'sim',
        'contract',
        'checked_at',
        'environment',
        'commit',
        'php_version',
        'database_version',
        'migrations_pending',
        'jobs_waiting',
        'oldest_job_minutes',
        'failed_jobs_7d',
        'scheduler_last_run_at',
        'scheduler_ok',
        'courses_running',
        'quarters_overdue',
        'closes_failed',
        'requests_waiting',
        'ai_enabled',
        'ai_spent_this_month_usd',
        'ai_ceiling_usd',
        'certificate_expires_at',
        'certificate_days_left',
        'connections_active',
      ],
    };
    for (const [name, cols] of Object.entries(CONTRACT_V1)) {
      const mine = Object.keys(TOOLS[name].columns).filter(
        (c) => c !== 'source',
      );
      expect([name, mine]).toEqual([name, cols]);
    }
  });
});

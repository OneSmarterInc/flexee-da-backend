// Ask Claude's lookups: read-only, and limited to the one course on screen.
// They run our own code (ask-claude-results.ts) against data loaded for that
// course, so nothing Claude asks for can change anything or reach another
// course. Firm names are given; people's names never are.

import {
  MEASURES,
  MEASURE_KEYS,
  ResultsLookups,
  type CourseData,
  type TableView,
} from './ask-claude-results';

export interface Lookup {
  name: string;
  summary: string;
}

type ToolDefinition = {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
};

const measureHelp = `Which measures: ${Object.entries(MEASURES)
  .map(([k, v]) => `${k} (${v.label})`)
  .join(', ')}. Leave out for all of them.`;

export class AskClaudeTools {
  private readonly lookups: ResultsLookups;
  /** Tables to show beside the answer. */
  readonly views: TableView[] = [];

  constructor(data: CourseData, now?: () => Date) {
    this.lookups = new ResultsLookups(data, now);
  }

  definitions(): ToolDefinition[] {
    return [
      {
        name: 'get_course_status',
        description:
          'Where this course stands now: its status, the quarter now open and of how many, when it closes and the time left (in course time), each analytics module and the quarter it opens or opened, each firm with its student count and whether it has submitted, has a draft or has nothing this quarter, and whether AI is on.',
        input_schema: { type: 'object', properties: {} },
      },
      {
        name: 'get_close_history',
        description:
          'Every quarter closed so far: when (course time), whether at the deadline or by faculty, how many firms submitted, how many were played on last quarter’s decisions, and how long the close took.',
        input_schema: { type: 'object', properties: {} },
      },
      {
        name: 'get_results',
        description:
          'Stored results at the close of chosen quarters: chosen measures for chosen firms (every firm unless named). At most 5 quarters; the latest closed quarter if none is named. Use it to read results; use show_table when faculty should see the figures too.',
        input_schema: {
          type: 'object',
          properties: {
            measures: {
              type: 'array',
              items: { type: 'string', enum: MEASURE_KEYS },
              description: measureHelp,
            },
            firms: {
              type: 'array',
              items: { type: 'string' },
              description:
                'Firm names, such as "Firm 2". Leave out for every firm.',
            },
            quarters: {
              type: 'array',
              items: { type: 'integer' },
              description:
                'Closed quarters, at most 5. Leave out for the latest closed quarter.',
            },
          },
        },
      },
      {
        name: 'show_table',
        description:
          'The same stored results as get_results, also shown to faculty as a table beside your answer. Call it at most once per answer, when figures matter. Keep it small: one measure over a few quarters, or a few measures at one quarter.',
        input_schema: {
          type: 'object',
          properties: {
            measures: {
              type: 'array',
              items: { type: 'string', enum: MEASURE_KEYS },
              description: measureHelp,
            },
            firms: { type: 'array', items: { type: 'string' } },
            quarters: { type: 'array', items: { type: 'integer' } },
          },
          required: ['measures'],
        },
      },
      {
        name: 'get_firm_detail',
        description:
          'One firm as of the latest closed quarter: every measure, the scorecard overall, and its outcome with the tests that decided it and how many quarters it did not submit.',
        input_schema: {
          type: 'object',
          properties: { firm: { type: 'string' } },
          required: ['firm'],
        },
      },
      {
        name: 'get_decisions',
        description:
          'What one firm decided in one quarter, in plain words, whether it was a draft or submitted, and how it came to be submitted (by the team, a draft submitted at the deadline, or last quarter’s decisions used).',
        input_schema: {
          type: 'object',
          properties: {
            firm: { type: 'string' },
            quarter: { type: 'integer' },
          },
          required: ['firm', 'quarter'],
        },
      },
      {
        name: 'get_readings',
        description:
          "The simulation's own written reading of each closed quarter (most recent first, at most 5): demand against last quarter, forecasts against actual demand, events, submissions and what unlocks next.",
        input_schema: {
          type: 'object',
          properties: {
            quarters: { type: 'array', items: { type: 'integer' } },
          },
        },
      },
      {
        name: 'get_forecast_accuracy',
        description:
          'Forecast accuracy by firm and quarter: the forecast total, the actual total, accuracy, MAPE, bias, and whether the forecast was the team’s own estimate, a forecasting model or last quarter’s figures.',
        input_schema: {
          type: 'object',
          properties: {
            firms: { type: 'array', items: { type: 'string' } },
            quarters: { type: 'array', items: { type: 'integer' } },
          },
        },
      },
    ];
  }

  run(name: string, input: Record<string, unknown>): Record<string, unknown> {
    if (name === 'get_course_status') return this.lookups.status();
    if (name === 'get_close_history') return this.lookups.closeHistory();
    if (name === 'get_results') return this.lookups.results(input);
    if (name === 'show_table') {
      const r = this.lookups.table(input);
      if (r.view && this.views.length === 0) this.views.push(r.view);
      return r.result;
    }
    if (name === 'get_firm_detail') return this.lookups.firmDetail(input);
    if (name === 'get_decisions') return this.lookups.decisions(input);
    if (name === 'get_readings') return this.lookups.readings(input);
    if (name === 'get_forecast_accuracy')
      return this.lookups.forecastAccuracy(input);
    return { error: `There is no lookup called ${name}.` };
  }

  /** One line for "Claude looked up: …". */
  summary(name: string, result: Record<string, unknown>): string {
    if (result.error) return String(result.error);
    if (name === 'get_course_status') {
      const q = result.quarter_now as { quarter: number } | null;
      return q
        ? `where the course stands: Quarter ${q.quarter} open`
        : `where the course stands: ${String(result.status)}`;
    }
    if (name === 'get_close_history') {
      const n = (result.closes as unknown[]).length;
      return n
        ? `the close history, ${n} ${n === 1 ? 'quarter' : 'quarters'}`
        : 'the close history: no quarters closed yet';
    }
    if (name === 'get_results' || name === 'show_table') {
      const rows = result.results as Array<{
        firm: string;
        quarters: Array<{ quarter: number }>;
      }>;
      const qs = rows[0]?.quarters.map((r) => r.quarter) ?? [];
      const span =
        qs.length > 1
          ? `Quarters ${qs[0]} to ${qs.at(-1)}`
          : `Quarter ${qs[0]}`;
      return `${rows.length} ${rows.length === 1 ? 'firm' : 'firms'}' stored results for ${span}${name === 'show_table' ? ', shown as a table' : ''}`;
    }
    if (name === 'get_firm_detail')
      return `${String(result.firm)}'s latest results and outcome`;
    if (name === 'get_decisions')
      return `${String(result.firm)}'s Quarter ${String(result.quarter)} decisions`;
    if (name === 'get_readings') {
      const n = (result.readings as unknown[]).length;
      return `the written readings, ${n} ${n === 1 ? 'quarter' : 'quarters'}`;
    }
    if (name === 'get_forecast_accuracy')
      return 'forecast accuracy by firm and quarter';
    return 'nothing';
  }
}

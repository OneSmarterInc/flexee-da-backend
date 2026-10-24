// Ask Claude's lookups over this one course's stored figures. Everything
// here is pure: it reads a CourseData loaded for the one course on screen,
// so nothing Claude asks for can change anything or reach another course.
//
// Every figure is handed over written the way the pages write it (dollars
// with commas, percentages with one decimal, dates in course time with the
// zone), so Claude can quote it exactly and the figure check can match it.
// Firm names are given; people's names, emails and payment notes never are.

import { formatCourseDateTime } from '../../lib/courseTime';
import type { Outcome } from '../reports/outcome';

export interface CourseData {
  simulation: {
    name: string;
    status: string;
    currentQuarter: number;
    totalQuarters: number;
    orientationQuarters: number;
    timezone: string;
    quarterEndsAt: Date | null;
    aiEnabled: boolean;
    modules: Array<{
      moduleId: string;
      unlocksAtQuarter: number;
      enabled: boolean;
    }>;
  };
  firms: Array<{ id: string; number: number; name: string; students: number }>;
  decisions: Array<Record<string, any>>;
  kpis: Array<Record<string, any>>;
  forecastLogs: Array<Record<string, any>>;
  closeLogs: Array<Record<string, any>>;
  outcomes: Map<string, Outcome>;
  /** The engine's own text for each closed quarter (never Claude's rewording). */
  readings: Array<{ quarter: number; engineText: string }>;
}

export interface TableView {
  title: string;
  columns: string[];
  rows: Array<{ firm: string; cells: string[] }>;
  source: string;
}

type Dict = Record<string, unknown>;

const usd = (n: number | null | undefined) =>
  typeof n !== 'number' || !Number.isFinite(n)
    ? 'no value yet'
    : `${n < 0 ? '-' : ''}$${Math.round(Math.abs(n)).toLocaleString('en-US')}`;
const one = (n: number | null | undefined) =>
  typeof n !== 'number' || !Number.isFinite(n)
    ? 'no value yet'
    : String(Math.round(n * 10) / 10);
const pctOfFraction = (n: number | null | undefined) =>
  typeof n !== 'number' || !Number.isFinite(n)
    ? 'no value yet'
    : `${(Math.round(n * 1000) / 10).toFixed(1)}%`;
const pctOfPercent = (n: number | null | undefined) =>
  typeof n !== 'number' || !Number.isFinite(n)
    ? 'no value yet'
    : `${(Math.round(n * 10) / 10).toFixed(1)}%`;

/** The measures get_results offers, with the labels the performance page uses. */
export const MEASURES: Record<
  string,
  {
    label: string;
    read: (k: any) => number | undefined;
    show: (n: number | undefined) => string;
  }
> = {
  revenue: { label: 'Revenue', read: (k) => k.financial?.revenue, show: usd },
  net_income: {
    label: 'Net income',
    read: (k) => k.financial?.netIncome,
    show: usd,
  },
  cash: { label: 'Cash', read: (k) => k.financial?.cash, show: usd },
  gross_margin: {
    label: 'Gross margin',
    read: (k) => k.financial?.grossMarginPct,
    show: pctOfPercent,
  },
  customer_satisfaction: {
    label: 'Customer satisfaction',
    read: (k) => k.customer?.csi,
    show: one,
  },
  market_share: {
    label: 'Market share',
    read: (k) => k.customer?.marketShare,
    show: pctOfFraction,
  },
  fill_rate: {
    label: 'Fill rate',
    read: (k) => k.customer?.fillRate,
    show: pctOfFraction,
  },
  perfect_order: {
    label: 'Perfect order',
    read: (k) => k.operations?.perfectOrder,
    show: pctOfFraction,
  },
  capacity_use: {
    label: 'Capacity use',
    read: (k) => k.operations?.capacityUtilization,
    show: pctOfFraction,
  },
  financial_score: {
    label: 'Financial score',
    read: (k) => k.bsc?.financial,
    show: one,
  },
  customer_score: {
    label: 'Customer score',
    read: (k) => k.bsc?.customer,
    show: one,
  },
  process_score: {
    label: 'Process score',
    read: (k) => k.bsc?.process,
    show: one,
  },
  learning_score: {
    label: 'Learning score',
    read: (k) => k.bsc?.learning,
    show: one,
  },
};
export const MEASURE_KEYS = Object.keys(MEASURES);

export const MODULE_NAMES: Record<string, string> = {
  ds: 'Demand Science',
  sa: 'Supplier Analytics',
  ci: 'Customer Intelligence',
  nd: 'Network Design',
  pi: 'Product Innovation',
  me: 'Market Expansion',
};
const COURSE_STATUS: Record<string, string> = {
  CREATED: 'being set up',
  INITIALIZED: 'ready to start',
  IN_PROGRESS: 'running',
  PAUSED: 'paused',
  COMPLETED: 'finished',
};
const FORECAST_KIND: Record<string, string> = {
  GUT: "the team's own estimate",
  MODEL: 'a forecasting model',
  BASELINE: "last quarter's figures",
};
const SUBMITTED_HOW: Record<string, string> = {
  team: 'submitted by the team',
  draft_promoted: 'the team’s draft, submitted at the deadline',
  carried_forward: "not submitted: last quarter's decisions were used",
  baseline: 'not submitted: starting decisions were used',
  reference: 'played by a reference path',
};
const SUPPLIERS: Record<string, string> = {
  SUP001: 'SUP001 (GlobalTech Mfg, China)',
  SUP002: 'SUP002 (Precision Parts Inc, USA)',
  SUP003: 'SUP003 (EuroComponents GmbH, Germany)',
  SUP004: 'SUP004 (Pacific Rim Supply, Vietnam)',
  SUP005: 'SUP005 (MexiParts SA, Mexico)',
  SUP006: 'SUP006 (IndiaSource Ltd, India)',
  NONE: 'none',
};
const DC_STATUS: Record<string, string> = {
  NO: 'no',
  YES: 'open',
  CLOSE: 'closing',
};
const TIDY = (s: string) =>
  s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function timeLeft(ms: number) {
  const mins = Math.max(0, Math.round(ms / 60000));
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  return d > 0
    ? `${plural(d, 'day')} ${plural(h, 'hour')}`
    : `${plural(h, 'hour')} ${mins % 60} minutes`;
}

export class ResultsLookups {
  constructor(
    private readonly data: CourseData,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private get tz() {
    return this.data.simulation.timezone || 'UTC';
  }
  private when(d: Date | null | undefined) {
    return d ? formatCourseDateTime(new Date(d), this.tz) : 'no time set';
  }
  /** The latest quarter with stored results. */
  latestClosed() {
    return this.data.kpis.reduce((m, k) => Math.max(m, k.quarter), 0);
  }

  /** A firm by "Firm 2", "2" or its name. */
  firm(input: unknown) {
    const typed = String(input ?? '')
      .trim()
      .toLowerCase();
    const num = /^(?:firm\s*)?(\d{1,2})$/.exec(typed)?.[1];
    return (
      this.data.firms.find((f) => f.name.toLowerCase() === typed) ??
      (num
        ? this.data.firms.find((f) => f.number === Number(num))
        : undefined) ?? {
        error: `There is no firm called "${String(input ?? '')}". The firms are ${this.data.firms.map((f) => f.name).join(', ')}.`,
      }
    );
  }
  private firms(input: unknown) {
    if (Array.isArray(input) && input.length) {
      const out: CourseData['firms'] = [];
      for (const n of input) {
        const f = this.firm(n);
        if ('error' in f) return f;
        out.push(f);
      }
      return out;
    }
    return this.data.firms;
  }
  private kpi(firmId: string, quarter: number) {
    return this.data.kpis.find(
      (k) => String(k.firm) === firmId && k.quarter === quarter,
    );
  }

  status(): Dict {
    const { simulation: s, firms, decisions } = this.data;
    const open = s.status === 'IN_PROGRESS';
    const unlocked = (m: { unlocksAtQuarter: number; enabled: boolean }) =>
      m.enabled &&
      s.currentQuarter > 3 + s.orientationQuarters &&
      s.currentQuarter >= m.unlocksAtQuarter;
    const thisQuarter = (firmId: string) => {
      const d = decisions.find(
        (x) => String(x.firm) === firmId && x.quarter === s.currentQuarter,
      );
      if (!d) return 'nothing saved yet';
      return d.status === 'DRAFT' ? 'has a draft, not submitted' : 'submitted';
    };
    return {
      course: s.name,
      status: COURSE_STATUS[s.status] ?? 'unknown',
      quarter_now: open
        ? { quarter: s.currentQuarter, of: s.totalQuarters }
        : null,
      quarters_closed: this.latestClosed(),
      time_zone: s.timezone,
      ...(open && s.quarterEndsAt
        ? {
            open_quarter_closes: this.when(s.quarterEndsAt),
            time_left:
              s.quarterEndsAt.getTime() > this.now().getTime()
                ? timeLeft(s.quarterEndsAt.getTime() - this.now().getTime())
                : 'past its deadline; it closes within a few minutes',
          }
        : {}),
      how_quarters_work:
        'A quarter closes at its deadline in the course time zone, or earlier when faculty click Advance. A firm with no submission is played on last quarter’s decisions.',
      modules: s.modules
        .slice()
        .sort((a, b) => a.unlocksAtQuarter - b.unlocksAtQuarter)
        .map((m) => ({
          module: MODULE_NAMES[m.moduleId] ?? m.moduleId,
          state: !m.enabled
            ? 'not used in this course'
            : unlocked(m)
              ? `open (opened in Quarter ${m.unlocksAtQuarter})`
              : `opens in Quarter ${m.unlocksAtQuarter}`,
        })),
      firms: firms.map((f) => ({
        firm: f.name,
        students: f.students,
        ...(open ? { this_quarter: thisQuarter(f.id) } : {}),
      })),
      students_note:
        'students counts the people placed in each firm. Their names are not available.',
      ask_claude_and_other_ai: s.aiEnabled
        ? 'on for this course'
        : 'off for this course',
    };
  }

  closeHistory(): Dict {
    const rows = this.data.closeLogs
      .slice()
      .sort(
        (a, b) =>
          a.quarter - b.quarter ||
          +new Date(a.completedAt) - +new Date(b.completedAt),
      );
    return {
      time_zone: this.tz,
      closes: rows.map((r) => ({
        quarter: r.quarter,
        closed_at: this.when(r.completedAt),
        closed: r.source === 'faculty' ? 'by faculty' : 'at the deadline',
        result: r.status === 'succeeded' ? 'closed' : 'failed',
        firms_submitted: r.firmsSubmitted,
        firms_carried_forward: r.firmsCarriedForward,
        took_seconds: Math.round(r.seconds * 10) / 10,
      })),
    };
  }

  results(input: Dict): Dict {
    const closed = this.latestClosed();
    if (closed === 0)
      return {
        error: 'No quarter has closed yet, so there are no stored results.',
      };
    const keys = (
      Array.isArray(input.measures) && input.measures.length
        ? input.measures
        : MEASURE_KEYS
    ).filter(
      (k): k is string => typeof k === 'string' && MEASURE_KEYS.includes(k),
    );
    if (!keys.length)
      return { error: `Measures are: ${MEASURE_KEYS.join(', ')}.` };
    const quarters = (
      Array.isArray(input.quarters) && input.quarters.length
        ? input.quarters.map(Number)
        : [closed]
    )
      .filter((q) => Number.isInteger(q) && q >= 1 && q <= closed)
      .slice(0, 5);
    if (!quarters.length)
      return { error: `Quarters 1 to ${closed} have stored results.` };
    const firms = this.firms(input.firms);
    if ('error' in firms) return firms;
    return {
      note: 'Values are as stored at the close of each quarter, written as the performance page writes them. Quarters 1 to 3 are history the engine generates.',
      results: firms.map((f) => ({
        firm: f.name,
        quarters: quarters.map((q) => {
          const k = this.kpi(f.id, q);
          return {
            quarter: q,
            ...Object.fromEntries(
              keys.map((key) => [
                MEASURES[key].label,
                k ? MEASURES[key].show(MEASURES[key].read(k)) : 'no value yet',
              ]),
            ),
          };
        }),
      })),
    };
  }

  table(input: Dict): { result: Dict; view?: TableView } {
    const result = this.results(input);
    if ('error' in result) return { result };
    const rows = result.results as Array<{
      firm: string;
      quarters: Array<Record<string, string | number>>;
    }>;
    const keys = Object.keys(rows[0]?.quarters[0] ?? {}).filter(
      (k) => k !== 'quarter',
    );
    const quarters = rows[0]?.quarters.map((r) => Number(r.quarter)) ?? [];
    const view: TableView = {
      title: keys.length === 1 ? keys[0] : `Quarter ${quarters[0]}`,
      columns:
        quarters.length > 1
          ? keys.flatMap((k) => quarters.map((q) => `${k} · Q${q}`))
          : keys,
      rows: rows.map((f) => ({
        firm: f.firm,
        cells: keys.flatMap((k) => f.quarters.map((r) => String(r[k]))),
      })),
      source: `Stored results at the close of ${quarters.length > 1 ? `Quarters ${quarters[0]} to ${quarters.at(-1)}` : `Quarter ${quarters[0]}`}.`,
    };
    return { result: { ...result, shown_to_faculty: true }, view };
  }

  firmDetail(input: Dict): Dict {
    const f = this.firm(input.firm);
    if ('error' in f) return f;
    const closed = this.latestClosed();
    const k = this.kpi(f.id, closed);
    if (!k) return { error: `${f.name} has no stored results yet.` };
    const outcome = this.data.outcomes.get(f.id);
    return {
      firm: f.name,
      students: f.students,
      as_of_quarter: closed,
      measures: Object.fromEntries(
        MEASURE_KEYS.map((key) => [
          MEASURES[key].label,
          MEASURES[key].show(MEASURES[key].read(k)),
        ]),
      ),
      scorecard_overall: one(k.bsc?.overall),
      ...(outcome?.label
        ? {
            outcome: outcome.label,
            outcome_lines: outcome.lines,
            quarters_not_submitted: outcome.missed,
            student_quarters_played: outcome.played,
          }
        : { outcome: 'not available until Quarter 4 has closed' }),
    };
  }

  decisions(input: Dict): Dict {
    const f = this.firm(input.firm);
    if ('error' in f) return f;
    const quarter = Number(input.quarter);
    const d = this.data.decisions.find(
      (x) => String(x.firm) === f.id && x.quarter === quarter,
    );
    if (!d)
      return {
        firm: f.name,
        quarter,
        decision: 'no decision saved for this quarter',
      };
    const unlocked: string[] = d.modulesUnlockedAtSubmit ?? [];
    const has = (id: string) => unlocked.includes(id);
    return {
      firm: f.name,
      quarter,
      state: d.status === 'DRAFT' ? 'a draft, not submitted' : 'submitted',
      how_it_was_submitted: SUBMITTED_HOW[d.submittedHow ?? 'team'],
      production: { 'P1 units': d.productionP1, 'P2 units': d.productionP2 },
      prices: { P1: usd(d.priceP1), P2: usd(d.priceP2) },
      marketing_budget: usd(d.marketingBudget),
      modules_open_when_submitted: unlocked.map((m) => MODULE_NAMES[m] ?? m),
      ...(has('ds')
        ? {
            forecast: {
              East: d.forecastR1,
              Central: d.forecastR2,
              West: d.forecastR3,
              source:
                FORECAST_KIND[d.forecastMethod] ??
                TIDY(String(d.forecastMethod)),
            },
          }
        : {}),
      ...(has('sa')
        ? {
            suppliers: {
              main: SUPPLIERS[d.primarySupplier] ?? d.primarySupplier,
              second: SUPPLIERS[d.secondarySupplier] ?? d.secondarySupplier,
              'share to the main supplier': `${d.primaryAllocation}%`,
              'global order units': d.orderGlobal,
              'emergency regional order units': d.emergencyRegionalOrder,
            },
          }
        : {}),
      ...(has('ci')
        ? {
            segments: {
              Champions: `${d.segmentChampions}%`,
              Growth: `${d.segmentGrowth}%`,
              'At risk': `${d.segmentAtRisk}%`,
              Other: `${d.segmentOther}%`,
            },
          }
        : {}),
      ...(has('nd')
        ? {
            distribution_centres: {
              Central: DC_STATUS[d.dcCentralStatus] ?? d.dcCentralStatus,
              West: DC_STATUS[d.dcWestStatus] ?? d.dcWestStatus,
              'units to Central': d.allocateCentral,
              'units to West': d.allocateWest,
            },
          }
        : {}),
      ...(has('pi')
        ? {
            product_p3: d.launchP3
              ? {
                  launched: true,
                  configuration: TIDY(String(d.p3Config)),
                  price: usd(d.p3Price),
                  'production units': d.productionP3,
                }
              : { launched: false },
          }
        : {}),
      ...(has('me')
        ? {
            new_regions: {
              Canada: d.enterR4
                ? `entered, forecast ${d.forecastR4} units`
                : 'not entered',
              'EU (Germany)': d.enterR5
                ? `entered, forecast ${d.forecastR5} units`
                : 'not entered',
              'APAC (Japan)': d.enterR6
                ? `entered, forecast ${d.forecastR6} units`
                : 'not entered',
            },
          }
        : {}),
    };
  }

  readings(input: Dict): Dict {
    const quarters =
      Array.isArray(input.quarters) && input.quarters.length
        ? input.quarters.map(Number)
        : null;
    const rows = this.data.readings
      .filter((r) => !quarters || quarters.includes(r.quarter))
      .sort((a, b) => b.quarter - a.quarter)
      .slice(0, 5);
    if (!rows.length)
      return { error: 'No quarter readings have been written yet.' };
    return {
      note: "Each reading is the simulation's own text about a closed quarter, written from stored figures.",
      readings: rows.map((r) => ({
        quarter: r.quarter,
        reading: r.engineText,
      })),
    };
  }

  forecastAccuracy(input: Dict): Dict {
    const firms = this.firms(input.firms);
    if ('error' in firms) return firms;
    const quarters =
      Array.isArray(input.quarters) && input.quarters.length
        ? input.quarters.map(Number)
        : null;
    const rows = firms.map((f) => ({
      firm: f.name,
      quarters: this.data.forecastLogs
        .filter(
          (l) =>
            String(l.firm) === f.id &&
            (!quarters || quarters.includes(l.quarter)),
        )
        .sort((a, b) => a.quarter - b.quarter)
        .slice(-8)
        .map((l) => ({
          quarter: l.quarter,
          forecast_total: Math.round(l.forecast?.total ?? 0).toLocaleString(
            'en-US',
          ),
          actual_total: Math.round(l.actual?.total ?? 0).toLocaleString(
            'en-US',
          ),
          accuracy: pctOfFraction(l.accuracy),
          mape: pctOfFraction(l.mape),
          bias: pctOfFraction(l.bias),
          forecast_was:
            FORECAST_KIND[l.forecastSource ?? l.forecastMethod] ?? 'unknown',
        })),
    }));
    return {
      note: 'Accuracy is 100% minus the average percentage error across the three regions. Quarters 1 to 3 are history, forecast from last quarter’s figures. Bias is the share by which the forecast total was above or below the actual total.',
      firms: rows,
    };
  }
}

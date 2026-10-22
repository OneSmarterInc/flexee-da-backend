// src/modules/reporting/reporting-views.service.ts
//
// The six views of the Flexee family reporting contract v1, worked out from
// DA's own data. The tools and columns are the contract's; how DA fills them:
//
// - A course is a simulation. Quarters 1 to 3 are generated history before
//   students decide, so they are the warm-up quarters.
// - report_closes has one row per quarter close (DA closes every firm in one
//   step), so firm_id is null, as in BPM. Closes are recorded from V3 layer 3
//   on; earlier ones have no record.
// - report_requests has no rows: DA has no accounting-method requests.
// - report_ai_use comes from ai_calls (V3 layer 4); it has rows once an AI
//   feature runs.
// - report_health: DA runs on Node with no queue, so the job columns and
//   php_version are null; the scheduler columns come from scheduler_state.
//
// Operational facts only (RP2): no person's name or email, no team's work and
// no firm results. DA has no practice courses or test accounts to leave out.

import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection as MongoConnection, Model, Types } from 'mongoose';
import {
  Decision,
  DecisionDocument,
  DecisionStatus,
  Enrollment,
  EnrollmentDocument,
  EnrollmentStatus,
  Firm,
  FirmDocument,
  Simulation,
  SimulationDocument,
  SimulationStatus,
} from '../../entities/index.entity';
import { QuarterCloseLog, SchedulerState } from './reporting.schemas';
import { ReportingOAuthService } from './reporting-oauth.service';
import { AiCall } from '../ai/ai-use.schema';
import { AiUseService, monthStart } from '../ai/ai-use.service';

export const SIM = 'data_analytics';
export const CONTRACT = 'v1';
const WARM_UP_QUARTERS = 3;
const SWEEP_KEY = 'quarter-sweep';

type Tool = {
  title: string;
  description: string;
  columns: Record<string, string>;
};
const col = (entries: Array<[string, string]>) =>
  Object.fromEntries([['sim', 'Which sim the row comes from.'], ...entries]);

export const TOOLS: Record<string, Tool> = {
  report_courses: {
    title: 'Courses',
    description:
      'One row per course: its status, the quarter it is on, and how many firms and students it has.',
    columns: col([
      ['course_id', "The course's id."],
      ['course', "The course's name."],
      ['institution', "The institution's name, else null."],
      ['product', 'Flexee DA.'],
      ['engine_version', 'Always "1": DA has one engine.'],
      [
        'status',
        'setting_up (not yet deployed to students), running or finished.',
      ],
      ['quarter_now', 'The quarter open or closing now, else null.'],
      ['quarters', 'Quarters in the course, warm-up included.'],
      ['firms', 'Firms in the course.'],
      ['students', 'Students enrolled, leaving out dropped ones.'],
      ['students_confirmed', 'Enrolled students whose enrollment is active.'],
      ['next_deadline_at', "The open quarter's decision deadline, else null."],
      ['created_at', 'When the course was created.'],
      ['deployed_at', 'When the course was deployed to students, else null.'],
    ]),
  },
  report_quarters: {
    title: 'Quarters',
    description:
      'One row per course quarter: its state and deadline, when it opened and closed, how long the close took, and how many firms submitted.',
    columns: col([
      ['course_id', "The course's id."],
      ['course', "The course's name."],
      ['quarter', "The quarter's number."],
      [
        'warm_up',
        'True for quarters 1 to 3, the history generated before students decide.',
      ],
      ['state', 'locked, open, processing or closed.'],
      ['deadline_at', 'The decision deadline, where known.'],
      ['deadline_extended', 'True when faculty extended the deadline.'],
      ['opened_at', 'When the quarter opened, where known.'],
      ['opened_after_deadline', 'Always false.'],
      [
        'overdue',
        'True when the quarter is open more than 10 minutes past its deadline, which happens only if nothing is closing quarters.',
      ],
      ['close_started_at', 'When the close began, where recorded.'],
      ['closed_at', 'When the close finished, where recorded.'],
      ['close_minutes', 'Minutes the close took, where recorded.'],
      ['firms', 'Firms in the course.'],
      [
        'firms_submitted',
        'Firms whose team submitted: counted live for the open quarter, and as recorded at the close for closed ones.',
      ],
      [
        'firms_carried_forward',
        "Firms that played on last quarter's decisions, as recorded at the close.",
      ],
      ['explanations_required', 'Always false.'],
      ['explanations_submitted', 'Always null.'],
    ]),
  },
  report_closes: {
    title: 'Quarter closes',
    description:
      'One row per quarter close in the last 90 days. DA closes every firm in one step.',
    columns: col([
      ['close_id', "The close's id."],
      ['course_id', "The course's id."],
      ['course', "The course's name, kept after the course is deleted."],
      ['quarter', 'The quarter closed.'],
      ['firm_id', 'Always null: a close covers every firm at once.'],
      ['status', 'succeeded or failed.'],
      ['error_code', 'other for a failed close, else null.'],
      [
        'source',
        'deadline (the sweep or a page load after the deadline) or faculty (the advance button).',
      ],
      ['started_at', 'When it started.'],
      ['completed_at', 'When it finished.'],
      ['seconds', 'Seconds it took.'],
    ]),
  },
  report_requests: {
    title: 'Accounting-method requests',
    description:
      'DA has no accounting-method requests, so this returns no rows.',
    columns: col([
      ['request_id', "The request's id."],
      ['course_id', "The course's id."],
      ['course', "The course's name."],
      ['quarter', 'The quarter.'],
      ['status', 'pending, approved or declined.'],
      ['filed_at', 'When it was filed.'],
      ['decided_at', 'When it was decided.'],
      ['days_waiting', 'Days waiting.'],
      ['has_reason', 'Whether it had a reason.'],
      ['review', "Claude's review."],
    ]),
  },
  report_ai_use: {
    title: 'AI use',
    description:
      'One row per course, month and AI feature in the last 12 months: calls, failures, sentences the checks dropped, tokens and cost.',
    columns: col([
      ['course_id', "The course's id."],
      ['course', "The course's name."],
      ['month', 'The month, as YYYY-MM.'],
      [
        'feature',
        'ask_claude, readings, team_explanations or debrief_captions.',
      ],
      ['calls', 'Calls to Claude, each retry counted.'],
      ['failures', 'Calls that failed or came back unusable.'],
      ['sentences_dropped', 'Sentences the checks removed.'],
      ['input_tokens', 'Input tokens.'],
      ['output_tokens', 'Output tokens.'],
      ['cost_usd', 'Cost in US dollars.'],
    ]),
  },
  report_health: {
    title: 'Site health',
    description:
      'One row for the site: the deployed commit, the database, the scheduler, overdue quarters, failed closes and connections.',
    columns: col([
      ['contract', "The reporting contract's version."],
      ['checked_at', 'When these figures were worked out.'],
      ['environment', 'The app environment.'],
      ['commit', 'The deployed commit, else null.'],
      ['php_version', 'Always null: DA runs on Node.'],
      [
        'database_version',
        'The database server\'s version, e.g. "MongoDB 7.0.14".',
      ],
      [
        'migrations_pending',
        'Always null: DA has no record of which migration scripts have run.',
      ],
      ['jobs_waiting', 'Always null: DA has no queue.'],
      ['oldest_job_minutes', 'Always null.'],
      ['failed_jobs_7d', 'Always null.'],
      ['scheduler_last_run_at', 'When the quarter sweep last ran, else null.'],
      ['scheduler_ok', 'True when the sweep ran in the last 10 minutes.'],
      ['courses_running', 'Courses running now.'],
      [
        'quarters_overdue',
        'Open quarters more than 10 minutes past their deadline.',
      ],
      ['closes_failed', 'Failed closes in the last 7 days.'],
      ['requests_waiting', 'Always 0.'],
      ['ai_enabled', 'True when AI features can run on this site.'],
      ['ai_spent_this_month_usd', 'AI spend this month, in US dollars.'],
      ['ai_ceiling_usd', "The site's monthly AI ceiling, in US dollars."],
      [
        'certificate_expires_at',
        'Always null: the host renews the certificate.',
      ],
      ['certificate_days_left', 'Always null.'],
      ['connections_active', 'Active reporting connections.'],
    ]),
  },
};

const iso = (d: Date | string | null | undefined) =>
  d ? new Date(d).toISOString().replace(/\.\d{3}Z$/, 'Z') : null;

/** An open quarter more than ten minutes past its deadline: only possible when nothing is closing quarters. */
const isOverdue = (state: string, due?: Date | null) =>
  state === 'open' &&
  !!due &&
  Date.now() - new Date(due).getTime() > 10 * 60_000;

type SimLean = SimulationDocument & { _id: Types.ObjectId; createdAt?: Date };

@Injectable()
export class ReportingViewsService {
  constructor(
    @InjectModel(Simulation.name)
    private readonly sims: Model<SimulationDocument>,
    @InjectModel(Firm.name) private readonly firms: Model<FirmDocument>,
    @InjectModel(Enrollment.name)
    private readonly enrollments: Model<EnrollmentDocument>,
    @InjectModel(Decision.name)
    private readonly decisions: Model<DecisionDocument>,
    @InjectModel(QuarterCloseLog.name)
    private readonly closeLogs: Model<QuarterCloseLog>,
    @InjectModel(SchedulerState.name)
    private readonly scheduler: Model<SchedulerState>,
    @InjectConnection() private readonly db: MongoConnection,
    private readonly oauth: ReportingOAuthService,
    @InjectModel(AiCall.name) private readonly aiCalls: Model<AiCall>,
    private readonly ai: AiUseService,
  ) {}

  async run(name: string): Promise<Array<Record<string, unknown>>> {
    switch (name) {
      case 'report_courses':
        return this.courses();
      case 'report_quarters':
        return this.quarters();
      case 'report_closes':
        return this.closes();
      case 'report_requests':
        return [];
      case 'report_ai_use':
        return this.aiUse();
      case 'report_health':
        return [await this.health()];
      default:
        throw new Error(`Unknown view ${name}`);
    }
  }

  private async allSims(): Promise<SimLean[]> {
    return this.sims
      .find({})
      .select(
        'name institutionName status currentQuarter totalQuarters quarterStartedAt quarterEndsAt closingQuarter quarterSchedule deployedForStudentAt createdAt',
      )
      .sort({ createdAt: 1 })
      .lean<SimLean[]>();
  }

  /** setting_up until deployed to students, finished when completed, else running. */
  private status(sim: SimLean): 'setting_up' | 'running' | 'finished' {
    if (sim.status === SimulationStatus.COMPLETED) return 'finished';
    if (
      sim.status === SimulationStatus.IN_PROGRESS ||
      sim.status === SimulationStatus.PAUSED
    )
      return 'running';
    return sim.deployedForStudentAt ? 'running' : 'setting_up';
  }

  private async firmCounts(): Promise<Map<string, number>> {
    const rows = await this.firms.aggregate<{ _id: Types.ObjectId; n: number }>(
      [{ $group: { _id: '$simulation', n: { $sum: 1 } } }],
    );
    return new Map(rows.map((r) => [String(r._id), r.n]));
  }

  private async courses() {
    const sims = await this.allSims();
    const firms = await this.firmCounts();
    const countBySim = async (match: Record<string, unknown>) => {
      const rows = await this.enrollments.aggregate<{
        _id: Types.ObjectId;
        n: number;
      }>([
        { $match: match },
        { $group: { _id: '$simulation', n: { $sum: 1 } } },
      ]);
      return new Map(rows.map((r) => [String(r._id), r.n]));
    };
    const enrolled = await countBySim({
      status: { $ne: EnrollmentStatus.DROPPED },
    });
    const confirmed = await countBySim({ status: EnrollmentStatus.ACTIVE });
    return sims.map((sim) => {
      const id = String(sim._id);
      const status = this.status(sim);
      return {
        sim: SIM,
        course_id: id,
        course: sim.name,
        institution: sim.institutionName || null,
        product: 'Flexee DA',
        engine_version: '1',
        status,
        quarter_now:
          status === 'finished' ? null : (sim.currentQuarter ?? null),
        quarters: sim.totalQuarters,
        firms: firms.get(id) ?? 0,
        students: enrolled.get(id) ?? 0,
        students_confirmed: confirmed.get(id) ?? 0,
        next_deadline_at: status === 'running' ? iso(sim.quarterEndsAt) : null,
        created_at: iso(sim.createdAt),
        deployed_at: iso(sim.deployedForStudentAt),
      };
    });
  }

  private async quarters() {
    const sims = await this.allSims();
    const firms = await this.firmCounts();
    const logs = await this.closeLogs
      .find({ status: 'succeeded' })
      .sort({ completedAt: 1 })
      .lean();
    const logKey = (simId: string, q: number) => `${simId}#${q}`;
    const closed = new Map(
      logs.map((l) => [logKey(String(l.simulationId), l.quarter), l]),
    );
    const live = await this.decisions.aggregate<{
      _id: { sim: Types.ObjectId; q: number };
      n: number;
    }>([
      {
        $match: {
          status: { $in: [DecisionStatus.SUBMITTED, DecisionStatus.PROCESSED] },
        },
      },
      {
        $group: {
          _id: { sim: '$simulation', q: '$quarter', firm: '$firm' },
        },
      },
      { $group: { _id: { sim: '$_id.sim', q: '$_id.q' }, n: { $sum: 1 } } },
    ]);
    const submittedLive = new Map(
      live.map((r) => [logKey(String(r._id.sim), r._id.q), r.n]),
    );

    const rows: Array<Record<string, unknown>> = [];
    for (const sim of sims) {
      const id = String(sim._id);
      const finished = sim.status === SimulationStatus.COMPLETED;
      const extended = new Map(
        (sim.quarterSchedule ?? []).map((q) => [
          q.quarterNumber,
          (q.extendedByDays ?? 0) > 0,
        ]),
      );
      for (let q = 1; q <= sim.totalQuarters; q++) {
        const warmUp = q <= WARM_UP_QUARTERS;
        let state: 'locked' | 'open' | 'processing' | 'closed';
        if (finished || q < sim.currentQuarter) state = 'closed';
        else if (q === sim.currentQuarter)
          state = sim.closingQuarter === q ? 'processing' : 'open';
        else state = 'locked';
        const log = closed.get(logKey(id, q));
        const current = q === sim.currentQuarter && !finished;
        const deadline = current
          ? sim.quarterEndsAt
          : (log?.deadlineAt ?? null);
        rows.push({
          sim: SIM,
          course_id: id,
          course: sim.name,
          quarter: q,
          warm_up: warmUp,
          state,
          deadline_at: warmUp ? null : iso(deadline),
          deadline_extended: extended.get(q) ?? false,
          opened_at: current
            ? iso(sim.quarterStartedAt)
            : iso(log?.openedAt ?? null),
          opened_after_deadline: false,
          overdue: isOverdue(state, deadline),
          close_started_at: iso(log?.startedAt ?? null),
          closed_at: iso(log?.completedAt ?? null),
          close_minutes: log ? Math.round(log.seconds / 60) : null,
          firms: firms.get(id) ?? 0,
          firms_submitted: current
            ? (submittedLive.get(logKey(id, q)) ?? 0)
            : (log?.firmsSubmitted ?? null),
          firms_carried_forward:
            log?.firmsCarriedForward ?? (current ? 0 : null),
          explanations_required: false,
          explanations_submitted: null,
        });
      }
    }
    return rows;
  }

  private async closes() {
    const since = new Date(Date.now() - 90 * 86_400_000);
    const logs = await this.closeLogs
      .find({ completedAt: { $gte: since } })
      .sort({ completedAt: 1 })
      .lean();
    return logs.map((l) => ({
      sim: SIM,
      close_id: String(l._id),
      course_id: String(l.simulationId),
      course: l.course,
      quarter: l.quarter,
      firm_id: null,
      status: l.status,
      error_code: l.errorCode,
      source: l.source,
      started_at: iso(l.startedAt),
      completed_at: iso(l.completedAt),
      seconds: Math.round(l.seconds * 10) / 10,
    }));
  }

  private async aiUse() {
    const start = monthStart(new Date());
    const since = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 11, 1),
    );
    const calls = await this.aiCalls
      .find({ createdAt: { $gte: since } })
      .select(
        'simulationId course feature outcome sentencesDropped inputTokens outputTokens costUsd createdAt',
      )
      .lean();
    type Row = {
      sim: string;
      course_id: string | null;
      course: string | null;
      month: string;
      feature: string;
      calls: number;
      failures: number;
      sentences_dropped: number;
      input_tokens: number;
      output_tokens: number;
      cost_usd: number;
    };
    const rows = new Map<string, Row>();
    for (const c of calls) {
      const month = new Date(c.createdAt).toISOString().slice(0, 7);
      const courseId = c.simulationId ? String(c.simulationId) : null;
      const key = `${courseId}#${month}#${c.feature}`;
      const row: Row = rows.get(key) ?? {
        sim: SIM,
        course_id: courseId,
        course: c.course,
        month,
        feature: c.feature,
        calls: 0,
        failures: 0,
        sentences_dropped: 0,
        input_tokens: 0,
        output_tokens: 0,
        cost_usd: 0,
      };
      row.calls += 1;
      if (c.outcome === 'error') row.failures += 1;
      row.sentences_dropped += c.sentencesDropped ?? 0;
      row.input_tokens += c.inputTokens ?? 0;
      row.output_tokens += c.outputTokens ?? 0;
      row.cost_usd += c.costUsd ?? 0;
      rows.set(key, row);
    }
    const sortKey = (r: Row) => `${r.month}#${r.course ?? ''}#${r.feature}`;
    return [...rows.values()]
      .map((r) => ({ ...r, cost_usd: Math.round(r.cost_usd * 100) / 100 }))
      .sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  }

  private async databaseVersion(): Promise<string | null> {
    try {
      const info = await this.db.db!.admin().command({ buildInfo: 1 });
      return info?.version ? `MongoDB ${info.version as string}` : null;
    } catch {
      return null;
    }
  }

  async health() {
    const sims = await this.allSims();
    const [version, state, failed, connections, spent] = await Promise.all([
      this.databaseVersion(),
      this.scheduler.findOne({ key: SWEEP_KEY }).lean(),
      this.closeLogs.countDocuments({
        status: 'failed',
        completedAt: { $gt: new Date(Date.now() - 7 * 86_400_000) },
      }),
      this.oauth.activeConnections(),
      this.ai.siteSpend(),
    ]);
    const overdue = sims.filter(
      (s) =>
        this.status(s) === 'running' &&
        isOverdue(
          s.closingQuarter === s.currentQuarter ? 'processing' : 'open',
          s.quarterEndsAt,
        ),
    ).length;
    const lastRun = state?.lastRunAt ? new Date(state.lastRunAt) : null;
    return {
      sim: SIM,
      contract: CONTRACT,
      checked_at: iso(new Date()),
      environment: process.env.NODE_ENV ?? 'production',
      commit:
        process.env.GIT_COMMIT?.trim() ||
        process.env.VERCEL_GIT_COMMIT_SHA?.trim().slice(0, 7) ||
        null,
      php_version: null,
      database_version: version,
      migrations_pending: null,
      jobs_waiting: null,
      oldest_job_minutes: null,
      failed_jobs_7d: null,
      scheduler_last_run_at: iso(lastRun),
      scheduler_ok: lastRun
        ? Date.now() - lastRun.getTime() <= 10 * 60_000
        : false,
      courses_running: sims.filter((s) => this.status(s) === 'running').length,
      quarters_overdue: overdue,
      closes_failed: failed,
      requests_waiting: 0,
      ai_enabled: this.ai.settings.available,
      ai_spent_this_month_usd: spent,
      ai_ceiling_usd: this.ai.settings.ceilingUsd,
      certificate_expires_at: null,
      certificate_days_left: null,
      connections_active: connections,
    };
  }
}

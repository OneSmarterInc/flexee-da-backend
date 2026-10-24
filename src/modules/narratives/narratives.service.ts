// Builds and rewords the quarter texts (V3 Design D).
//
// Part 1: after a close, our own code writes each text from the stored
// figures (readingFor, explanationFor, debrief captions). A failure here is
// logged and never fails or undoes a close.
// Part 2: when AI is on for the course, the sweep has Claude reword up to 10
// pending texts per run. A rewording that fails the checks is dropped and the
// engine text stands.

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Decision,
  DecisionDocument,
  DemandHistory,
  DemandHistoryDocument,
  Event,
  EventDocument,
  EventImpact,
  EventImpactDocument,
  Firm,
  FirmDocument,
  ForecastLog,
  ForecastLogDocument,
  KpiHistory,
  KpiHistoryDocument,
  Simulation,
  SimulationDocument,
} from '../../entities/index.entity';
import { CONFIG } from '../simulation/simulation.config';
import { QuarterCloseLog } from '../reporting/reporting.schemas';
import { AiUseService } from '../ai/ai-use.service';
import type { AiFeature } from '../ai/ai-use.schema';
import {
  accuracyCaption,
  demandCaption,
  forecastStory,
  scorecardCaption,
} from './debrief';
import { loadOutcomes } from '../reports/outcome.loader';
import { explanationFor } from './explanation';
import { MODULE_NAMES, REGIONS, pct, usd } from './format';
import { Narrative, NarrativeKind } from './narrative.schema';
import { readingFor } from './reading';
import { rewordCheck } from './reword-check';

export const REWORD_BATCH = 10;
const FEATURE: Record<NarrativeKind, AiFeature> = {
  reading: 'readings',
  explanation: 'team_explanations',
  debrief_caption: 'debrief_captions',
};
const AUDIENCE: Record<NarrativeKind, string> = {
  reading: 'faculty',
  explanation: "the team's students",
  debrief_caption: 'faculty',
};

export const REWORD_SYSTEM = `You reword short factual texts about a supply chain simulation so they read more naturally. The text you are given is ENGINE_TEXT, written by the simulation from stored figures.
Rules:
- Reword ENGINE_TEXT for the reader named in READER, in plain sentences. Keep its meaning.
- Add no facts, figures, names, dates or claims of your own. Every number, firm name and region name you write must already be in ENGINE_TEXT.
- Don't praise, criticise, grade, rank or advise. Don't say what anyone should do.
- Output only the reworded text, with no quotation marks, no heading and no commentary.`;

@Injectable()
export class NarrativesService {
  private readonly logger = new Logger(NarrativesService.name);
  /** Replaced in tests. */
  rewordTimeoutMs = 20_000;

  constructor(
    private readonly ai: AiUseService,
    @InjectModel(Narrative.name) readonly narratives: Model<Narrative>,
    @InjectModel(Simulation.name)
    private readonly simulationModel: Model<SimulationDocument>,
    @InjectModel(Firm.name) private readonly firmModel: Model<FirmDocument>,
    @InjectModel(Decision.name)
    private readonly decisionModel: Model<DecisionDocument>,
    @InjectModel(KpiHistory.name)
    private readonly kpiModel: Model<KpiHistoryDocument>,
    @InjectModel(ForecastLog.name)
    private readonly forecastModel: Model<ForecastLogDocument>,
    @InjectModel(DemandHistory.name)
    private readonly demandModel: Model<DemandHistoryDocument>,
    @InjectModel(Event.name) private readonly eventModel: Model<EventDocument>,
    @InjectModel(EventImpact.name)
    private readonly impactModel: Model<EventImpactDocument>,
    @InjectModel(QuarterCloseLog.name)
    private readonly closeLogModel: Model<QuarterCloseLog>,
  ) {}

  // ── Part 1: the engine texts ─────────────────────────────────────────────

  /** Never throws: a failure to build texts must not fail or undo a close. */
  async buildSafely(
    simulationId: Types.ObjectId | string,
    quarter: number,
  ): Promise<void> {
    try {
      await this.buildQuarter(simulationId, quarter);
      const sim = await this.simulationModel
        .findById(simulationId)
        .select('totalQuarters')
        .lean();
      if (sim && quarter >= (sim as any).totalQuarters)
        await this.buildDebrief(simulationId, quarter);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[narratives] could not build the texts for Q${quarter}: ${message}`,
      );
    }
  }

  private async put(
    sim: { _id: Types.ObjectId; name: string },
    row: {
      firmId: Types.ObjectId | null;
      quarter: number;
      kind: NarrativeKind;
      key?: string;
      engineText: string;
    },
  ) {
    await this.narratives.updateOne(
      {
        simulationId: sim._id,
        firmId: row.firmId,
        quarter: row.quarter,
        kind: row.kind,
        key: row.key ?? '',
      },
      {
        $set: {
          course: sim.name,
          engineText: row.engineText,
          text: null,
          rewordOutcome: 'pending',
        },
      },
      { upsert: true },
    );
  }

  /** One reading and one explanation per firm for a closed quarter. A second build replaces them. */
  async buildQuarter(
    simulationId: Types.ObjectId | string,
    quarter: number,
  ): Promise<void> {
    const sim = await this.simulationModel.findById(simulationId).lean();
    if (!sim) return;
    const simId = (sim as any)._id as Types.ObjectId;
    const firms = (await this.firmModel
      .find({ simulation: simId })
      .sort({ firmNumber: 1 })
      .lean()) as any[];
    const [demand, prevDemand, forecasts, kpis, decisions, impacts, closeLog] =
      await Promise.all([
        this.demandModel.findOne({ simulation: simId, quarter }).lean(),
        this.demandModel
          .findOne({ simulation: simId, quarter: quarter - 1 })
          .lean(),
        this.forecastModel.find({ simulation: simId, quarter }).lean(),
        this.kpiModel
          .find({ simulation: simId, quarter: { $in: [quarter, quarter - 1] } })
          .lean(),
        this.decisionModel
          .find({ simulation: simId, quarter: { $in: [quarter, quarter - 1] } })
          .lean(),
        this.impactModel.find({ simulation: simId, quarter }).lean(),
        this.closeLogModel
          .findOne({ simulationId: simId, quarter })
          .sort({ createdAt: -1 })
          .lean(),
      ]);
    const regions = (d: any) =>
      d ? { r1: d.demandR1, r2: d.demandR2, r3: d.demandR3 } : null;
    const eventIds = [
      ...new Set((impacts as any[]).map((i) => String(i.event))),
    ];
    const events = (await this.eventModel
      .find({ _id: { $in: eventIds } })
      .lean()) as any[];
    const eventName = new Map(
      events.map((e) => [String(e._id), e.name as string]),
    );

    // The reading.
    const byEvent = new Map<string, { effect: string; firms: Set<string> }>();
    for (const i of impacts as any[]) {
      const k = String(i.event);
      const row = byEvent.get(k) ?? {
        effect: i.eventEffect,
        firms: new Set<string>(),
      };
      row.firms.add(String(i.firm));
      byEvent.set(k, row);
    }
    const nextQ = quarter + 1;
    const modules = ((sim as any).moduleSchedule?.modules ?? []) as any[];
    const reading = readingFor({
      quarter,
      demand: demand
        ? {
            current: regions(demand)!,
            previous: regions(prevDemand),
            seasonalMultiplier: (demand as any).seasonalMultiplier ?? 1,
          }
        : null,
      forecasts: (forecasts as any[]).map((f) => ({
        forecast: {
          r1: f.forecast?.r1 ?? 0,
          r2: f.forecast?.r2 ?? 0,
          r3: f.forecast?.r3 ?? 0,
        },
        actual: {
          r1: f.actual?.r1 ?? 0,
          r2: f.actual?.r2 ?? 0,
          r3: f.actual?.r3 ?? 0,
        },
      })),
      events: [...byEvent].map(([id, e]) => ({
        name: eventName.get(id) ?? 'event',
        effect: e.effect,
        firms: e.firms.size,
      })),
      close: closeLog
        ? {
            firms: (closeLog as any).firms,
            submitted: (closeLog as any).firmsSubmitted,
            carriedForward: (closeLog as any).firmsCarriedForward,
          }
        : null,
      opensNext: modules
        .filter(
          (m) =>
            m.enabled &&
            m.unlocksAtQuarter === nextQ &&
            nextQ <= (sim as any).totalQuarters,
        )
        .map((m) => ({ moduleId: m.moduleId, quarter: nextQ })),
    });
    if (reading)
      await this.put(
        { _id: simId, name: (sim as any).name },
        { firmId: null, quarter, kind: 'reading', engineText: reading },
      );

    // One explanation per firm, from its own figures only.
    const T = CONFIG.scoring.BSC_THRESHOLDS;
    const figs = (k: any) =>
      k
        ? {
            revenue: k.financial?.revenue ?? 0,
            netIncome: k.financial?.netIncome ?? 0,
            cash: k.financial?.cash ?? 0,
            fillRate: k.customer?.fillRate ?? 0,
            marketShare: k.customer?.marketShare ?? 0,
            csi: k.customer?.csi ?? 0,
          }
        : null;
    for (const firm of firms) {
      const fid = String(firm._id);
      const pick = (list: any[], q: number) =>
        list.find((x) => String(x.firm) === fid && x.quarter === q);
      const current = figs(pick(kpis as any[], quarter));
      if (!current) continue;
      const dec = pick(decisions as any[], quarter);
      const text = explanationFor({
        quarter,
        current,
        previous: figs(pick(kpis as any[], quarter - 1)),
        decision: dec ?? null,
        previousDecision: pick(decisions as any[], quarter - 1) ?? null,
        carriedForward:
          dec?.submittedHow === 'carried_forward' ||
          dec?.submittedHow === 'baseline',
        forecast: (() => {
          const f = (forecasts as any[]).find((x) => String(x.firm) === fid);
          return f
            ? {
                forecast: {
                  r1: f.forecast?.r1 ?? 0,
                  r2: f.forecast?.r2 ?? 0,
                  r3: f.forecast?.r3 ?? 0,
                },
                actual: {
                  r1: f.actual?.r1 ?? 0,
                  r2: f.actual?.r2 ?? 0,
                  r3: f.actual?.r3 ?? 0,
                },
              }
            : null;
        })(),
        events: (impacts as any[])
          .filter((i) => String(i.firm) === fid)
          .map((i) => ({
            name: eventName.get(String(i.event)) ?? 'event',
            effect: i.eventEffect,
            recorded: i.impacts?.partsDelayed,
          })),
        targets: {
          revenue: T.REVENUE_TARGET,
          netIncome: T.NET_INCOME_TARGET,
          cash: T.CASH_TARGET,
          fillRate: T.FILL_RATE_TARGET,
          marketShare: T.MARKET_SHARE_TARGET,
          csi: T.CSI_TARGET,
        },
      });
      await this.put(
        { _id: simId, name: (sim as any).name },
        { firmId: firm._id, quarter, kind: 'explanation', engineText: text },
      );
    }
  }

  /** The debrief's chart captions: per firm for forecast accuracy and the scorecard, one for demand. */
  async buildDebrief(
    simulationId: Types.ObjectId | string,
    lastQuarter: number,
  ): Promise<void> {
    const sim = (await this.simulationModel
      .findById(simulationId)
      .lean()) as any;
    if (!sim) return;
    const simId = sim._id as Types.ObjectId;
    const firms = (await this.firmModel
      .find({ simulation: simId })
      .sort({ firmNumber: 1 })
      .lean()) as any[];
    const [kpis, forecasts, demand] = await Promise.all([
      this.kpiModel
        .find({ simulation: simId, quarter: { $gte: 4 } })
        .sort({ quarter: 1 })
        .lean(),
      this.forecastModel
        .find({ simulation: simId, quarter: { $gte: 4 } })
        .sort({ quarter: 1 })
        .lean(),
      this.demandModel
        .find({ simulation: simId, quarter: { $gte: 4 } })
        .sort({ quarter: 1 })
        .lean(),
    ]);
    for (const firm of firms) {
      const fid = String(firm._id);
      const acc = (forecasts as any[])
        .filter((f) => String(f.firm) === fid)
        .map((f) => ({ quarter: f.quarter, value: f.accuracy }));
      const score = (kpis as any[])
        .filter((k) => String(k.firm) === fid)
        .map((k) => ({ quarter: k.quarter, value: k.bsc?.overall ?? 0 }));
      const a = accuracyCaption(firm.name, acc);
      const s = scorecardCaption(firm.name, score);
      if (a)
        await this.put(sim, {
          firmId: firm._id,
          quarter: lastQuarter,
          kind: 'debrief_caption',
          key: 'accuracy',
          engineText: a,
        });
      if (s)
        await this.put(sim, {
          firmId: firm._id,
          quarter: lastQuarter,
          kind: 'debrief_caption',
          key: 'scorecard',
          engineText: s,
        });
    }
    const d = demandCaption(
      (demand as any[]).map((x) => ({
        quarter: x.quarter,
        value: x.totalDemand,
      })),
    );
    if (d)
      await this.put(sim, {
        firmId: null,
        quarter: lastQuarter,
        kind: 'debrief_caption',
        key: 'demand',
        engineText: d,
      });
  }

  /**
   * "While you were away" (V3 Design E): the closed quarters a student has not
   * seen, newest first, at most four. Each says whether the firm submitted or
   * its decisions were carried forward, gives the firm's explanation (or, if
   * there is none, its figures against the quarter before) and names any
   * module that opened.
   */
  async catchUp(
    simulationId: Types.ObjectId | string,
    firmId: string,
    lastSeenQuarter: number | null,
  ) {
    const simId = new Types.ObjectId(String(simulationId));
    const fid = new Types.ObjectId(firmId);
    const sim = (await this.simulationModel.findById(simId).lean()) as any;
    if (!sim) return { quarters: [] };
    const kpis = (await this.kpiModel
      .find({ simulation: simId, firm: fid, quarter: { $gte: 3 } })
      .sort({ quarter: 1 })
      .lean()) as any[];
    const closed = kpis.map((k) => k.quarter).filter((q) => q >= 4);
    const after = lastSeenQuarter ?? 3;
    const unseen = closed
      .filter((q) => q > after)
      .sort((a, b) => b - a)
      .slice(0, 4);
    if (unseen.length === 0) return { quarters: [] };
    const [decisions, texts] = await Promise.all([
      this.decisionModel
        .find({ simulation: simId, firm: fid, quarter: { $in: unseen } })
        .lean() as Promise<any[]>,
      this.narratives
        .find({
          simulationId: simId,
          firmId: fid,
          kind: 'explanation',
          quarter: { $in: unseen },
        })
        .lean(),
    ]);
    const modules = (sim.moduleSchedule?.modules ?? []) as any[];
    const figs = (q: number) => {
      const k = kpis.find((x) => x.quarter === q);
      return k
        ? {
            revenue: k.financial?.revenue ?? 0,
            netIncome: k.financial?.netIncome ?? 0,
            fillRate: k.customer?.fillRate ?? 0,
            marketShare: k.customer?.marketShare ?? 0,
          }
        : null;
    };
    const line = (cur: any, prev: any) => {
      const move = (
        label: string,
        a: number | undefined,
        b: number,
        show: (n: number) => string,
      ) =>
        a === undefined
          ? `${label} was ${show(b)}`
          : `${label} went from ${show(a)} to ${show(b)}`;
      return (
        [
          move('Revenue', prev?.revenue, cur.revenue, usd),
          move('net income', prev?.netIncome, cur.netIncome, usd),
          move('fill rate', prev?.fillRate, cur.fillRate, pct),
          move('market share', prev?.marketShare, cur.marketShare, pct),
        ].join('; ') + '.'
      );
    };
    return {
      quarters: unseen.map((q) => {
        const d = decisions.find((x) => x.quarter === q);
        const missed =
          d?.submittedHow === 'carried_forward' ||
          d?.submittedHow === 'baseline';
        const text = texts.find((x) => x.quarter === q);
        const cur = figs(q);
        return {
          quarter: q,
          submitted: !missed,
          submissionLine: missed
            ? "Not submitted: last quarter's decisions were used."
            : 'Your team submitted.',
          explanation: text
            ? (text.text ?? text.engineText)
            : cur
              ? line(cur, figs(q - 1))
              : null,
          unlocked: modules
            .filter((m) => m.enabled && m.unlocksAtQuarter === q)
            .map((m) => MODULE_NAMES[m.moduleId] ?? m.moduleId),
        };
      }),
    };
  }

  /** Removes every text for a course (a practice course's "Start over"). */
  async clearFor(simulationId: Types.ObjectId | string): Promise<void> {
    await this.narratives.deleteMany({
      simulationId: new Types.ObjectId(String(simulationId)),
    });
  }

  // ── What the pages read ──────────────────────────────────────────────────

  /** Readings, latest first. engineText is included so faculty can open it. */
  async readings(simulationId: Types.ObjectId | string) {
    const rows = await this.narratives
      .find({
        simulationId: new Types.ObjectId(String(simulationId)),
        kind: 'reading',
      })
      .sort({ quarter: -1 })
      .lean();
    return rows.map((r) => ({
      quarter: r.quarter,
      text: r.text ?? r.engineText,
      reworded: r.text !== null,
      engineText: r.engineText,
    }));
  }

  /** One firm's explanations, latest first. Faculty also get the engine's wording. */
  async explanations(
    simulationId: Types.ObjectId | string,
    firmId: string,
    forFaculty: boolean,
  ) {
    const rows = await this.narratives
      .find({
        simulationId: new Types.ObjectId(String(simulationId)),
        firmId: new Types.ObjectId(firmId),
        kind: 'explanation',
      })
      .sort({ quarter: -1 })
      .lean();
    return rows.map((r) => ({
      quarter: r.quarter,
      text: r.text ?? r.engineText,
      reworded: r.text !== null,
      ...(forFaculty ? { engineText: r.engineText } : {}),
    }));
  }

  /**
   * The debrief: outcomes, the forecast story and the chart series with
   * captions. With a firmId, only that firm (the student version).
   */
  async debrief(
    simulationId: Types.ObjectId | string,
    firmId: string | null,
    forFaculty: boolean,
  ) {
    const simId = new Types.ObjectId(String(simulationId));
    const sim = (await this.simulationModel.findById(simId).lean()) as any;
    const complete =
      sim?.status === 'COMPLETED' ||
      (await this.narratives.exists({
        simulationId: simId,
        kind: 'debrief_caption',
      })) !== null;
    if (!sim || !complete) return { complete: false };
    const allFirms = (await this.firmModel
      .find({ simulation: simId })
      .sort({ firmNumber: 1 })
      .lean()) as any[];
    const firms = firmId
      ? allFirms.filter((f) => String(f._id) === firmId)
      : allFirms;
    const ids = new Set(firms.map((f) => String(f._id)));
    const [kpis, forecasts, demand, captions, outcomes] = await Promise.all([
      this.kpiModel
        .find({ simulation: simId, quarter: { $gte: 4 } })
        .sort({ quarter: 1 })
        .lean(),
      this.forecastModel
        .find({ simulation: simId, quarter: { $gte: 4 } })
        .sort({ quarter: 1 })
        .lean(),
      this.demandModel
        .find({ simulation: simId, quarter: { $gte: 4 } })
        .sort({ quarter: 1 })
        .lean(),
      this.narratives
        .find({ simulationId: simId, kind: 'debrief_caption' })
        .lean(),
      loadOutcomes(
        {
          kpiHistoryModel: this.kpiModel as any,
          decisionModel: this.decisionModel as any,
          simulationModel: this.simulationModel as any,
        },
        simId,
      ),
    ]);
    const caption = (key: string, fid: string | null) => {
      const c = captions.find(
        (x) => x.key === key && String(x.firmId ?? '') === (fid ?? ''),
      );
      return c
        ? {
            text: c.text ?? c.engineText,
            ...(forFaculty ? { engineText: c.engineText } : {}),
          }
        : null;
    };
    const story = forecastStory(
      (forecasts as any[]).map((f) => ({
        firmId: String(f.firm),
        quarter: f.quarter,
        accuracy: f.accuracy,
        source: f.forecastSource ?? f.forecastMethod,
      })),
    );
    return {
      complete: true,
      firms: firms.map((f) => ({
        id: String(f._id),
        name: f.name,
        number: f.firmNumber,
      })),
      outcomes: firms.map((f) => ({
        firmId: String(f._id),
        firm: f.name,
        outcome: outcomes.get(String(f._id)) ?? null,
      })),
      forecastStory: {
        course: story.course,
        firms: firms.map((f) => ({
          firmId: String(f._id),
          firm: f.name,
          ...(story.firms[String(f._id)] ?? {
            ownEstimate: { quarters: 0, average: null },
            model: { quarters: 0, average: null },
          }),
        })),
      },
      charts: {
        accuracy: firms.map((f) => ({
          firmId: String(f._id),
          firm: f.name,
          points: (forecasts as any[])
            .filter((x) => String(x.firm) === String(f._id))
            .map((x) => ({ quarter: x.quarter, value: x.accuracy })),
          caption: caption('accuracy', String(f._id)),
        })),
        scorecard: firms.map((f) => ({
          firmId: String(f._id),
          firm: f.name,
          points: (kpis as any[])
            .filter((x) => String(x.firm) === String(f._id))
            .map((x) => ({ quarter: x.quarter, value: x.bsc?.overall ?? 0 })),
          caption: caption('scorecard', String(f._id)),
        })),
        demand: {
          regions: REGIONS.map((name, i) => ({
            name,
            points: (demand as any[]).map((d) => ({
              quarter: d.quarter,
              value: [d.demandR1, d.demandR2, d.demandR3][i],
            })),
          })),
          caption: caption('demand', null),
        },
      },
      _firmCount: ids.size,
    };
  }

  // ── Part 2: rewording by Claude ──────────────────────────────────────────

  /** Rewords up to `limit` pending texts, oldest first. Returns how many were handled. */
  async rewordPending(limit = REWORD_BATCH): Promise<number> {
    const pending = await this.narratives
      .find({ rewordOutcome: 'pending' })
      .sort({ createdAt: 1 })
      .limit(limit);
    let handled = 0;
    const courses = new Map<string, { sim: any; names: string[] } | null>();
    for (const row of pending) {
      const key = String(row.simulationId);
      if (!courses.has(key)) {
        const sim = await this.simulationModel
          .findById(row.simulationId)
          .lean();
        const firms = sim
          ? ((await this.firmModel
              .find({ simulation: row.simulationId })
              .select('name')
              .lean()) as any[])
          : [];
        courses.set(
          key,
          sim
            ? {
                sim,
                names: [...firms.map((f) => f.name as string), ...REGIONS],
              }
            : null,
        );
      }
      const course = courses.get(key);
      handled += 1;
      if (!course || (await this.ai.state(course.sim as any)) !== 'on') {
        await this.narratives.updateOne(
          { _id: row._id },
          { $set: { rewordOutcome: 'off' } },
        );
        continue;
      }
      await this.rewordOne(row, course.sim, course.names);
    }
    return handled;
  }

  private async rewordOne(row: any, sim: any, names: string[]) {
    const reader = AUDIENCE[row.kind as NarrativeKind];
    let outcome: 'kept' | 'checks_failed' | 'error' = 'error';
    let text: string | null = null;
    let usage = { inputTokens: 0, outputTokens: 0 };
    try {
      const res = await this.callClaude(
        REWORD_SYSTEM,
        `READER: ${reader}\n\nENGINE_TEXT: ${row.engineText}`,
      );
      usage = res.usage;
      const reworded = res.text?.trim().replace(/^["“]|["”]$/g, '');
      if (!reworded) outcome = 'error';
      else if (rewordCheck(row.engineText, reworded, names).ok) {
        outcome = 'kept';
        text = reworded;
      } else outcome = 'checks_failed';
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[narratives] reword failed: ${message}`);
    }
    await this.ai.record({
      simulationId: row.simulationId,
      course: sim.name,
      feature: FEATURE[row.kind as NarrativeKind],
      outcome,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      sentencesDropped: outcome === 'checks_failed' ? 1 : 0,
    });
    await this.narratives.updateOne(
      { _id: row._id },
      { $set: { text, rewordOutcome: outcome } },
    );
  }

  /** One call to Claude. Replaced in tests with a stub. */
  async callClaude(
    system: string,
    user: string,
  ): Promise<{
    text: string | null;
    usage: { inputTokens: number; outputTokens: number };
  }> {
    const s = this.ai.settings;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.rewordTimeoutMs);
    try {
      const res = await fetch(
        process.env.ANTHROPIC_API_URL ||
          'https://api.anthropic.com/v1/messages',
        {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'content-type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: s.model,
            max_tokens: 400,
            temperature: 0.4,
            system,
            messages: [{ role: 'user', content: user }],
          }),
        },
      );
      if (!res.ok) throw new Error(`Anthropic answered ${res.status}`);
      const data = (await res.json()) as {
        content?: Array<{ type: string; text?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      return {
        text: data.content?.find((c) => c.type === 'text')?.text ?? null,
        usage: {
          inputTokens: Number(data.usage?.input_tokens ?? 0),
          outputTokens: Number(data.usage?.output_tokens ?? 0),
        },
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

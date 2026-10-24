// Ask Claude for faculty (V3 Design C), ported from Flexee BPM.
//
// One question runs during the request. Claude reads the faculty guide and
// the page it was asked from, looks up what it needs through AskClaudeTools
// (read-only, this course only) and answers. The answer goes through the
// figure check before anyone sees it, and the exchange is logged for 90 days.
//
// Financial Accounting's four live fixes are built in: the answer is every
// turn's text without the "I'll look at ..." lines; a reply that only
// announces lookups is sent back once; a lookup's empty input goes back as
// {}; and earlier answers in a conversation are treated as checked.

import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Decision,
  DecisionDocument,
  Enrollment,
  EnrollmentDocument,
  EnrollmentStatus,
  Firm,
  FirmDocument,
  ForecastLog,
  ForecastLogDocument,
  KpiHistory,
  KpiHistoryDocument,
  Simulation,
  SimulationDocument,
} from '../../entities/index.entity';
import { QuarterCloseLog } from '../reporting/reporting.schemas';
import { loadOutcomes } from '../reports/outcome.loader';
import { AiUseService, monthStart } from './ai-use.service';
import { AskQuestion } from './ask-question.schema';
import { Narrative } from '../narratives/narrative.schema';
import { AskClaudeTools, type Lookup } from './ask-claude-tools';
import type { CourseData, TableView } from './ask-claude-results';
import { compose } from './compose-answer';
import { FACULTY_GUIDE } from './faculty-guide';
import { figureCheck } from './figure-check';

export interface AskSettings {
  available: boolean;
  apiKey?: string;
  url: string;
  model: string;
  thinking: string;
  maxTokens: number;
  inputUsdPerMTok: number;
  outputUsdPerMTok: number;
  questionsPerMonth: number;
  timeoutMs: number;
  maxLookupRounds: number;
}

const number = (value: string | undefined, fallback: number) => {
  const n = Number(value);
  return value !== undefined &&
    value.trim() !== '' &&
    Number.isFinite(n) &&
    n >= 0
    ? n
    : fallback;
};

export function askSettings(env: NodeJS.ProcessEnv = process.env): AskSettings {
  const apiKey = env.ANTHROPIC_API_KEY;
  return {
    // The same site switch as the other AI features: on when the provider
    // is anthropic and a key is set.
    available: env.FLEXEE_LLM_PROVIDER === 'anthropic' && Boolean(apiKey),
    ...(apiKey ? { apiKey } : {}),
    url: env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1/messages',
    // C1: Claude Sonnet 5.5, at its list prices in US dollars per million tokens.
    model: env.FLEXEE_ASK_MODEL || 'claude-sonnet-5-5',
    // Sonnet 5.5 thinks by default; between_tools is its lowest setting.
    // Empty sends no thinking field.
    thinking: env.FLEXEE_ASK_THINKING ?? 'between_tools',
    maxTokens: number(env.FLEXEE_ASK_MAX_TOKENS, 4000),
    inputUsdPerMTok: number(env.FLEXEE_ASK_INPUT_USD_PER_MTOK, 2),
    outputUsdPerMTok: number(env.FLEXEE_ASK_OUTPUT_USD_PER_MTOK, 10),
    // C2: 100 questions per course per month.
    questionsPerMonth: number(env.FLEXEE_ASK_QUESTIONS_PER_MONTH, 100),
    timeoutMs: 55_000,
    maxLookupRounds: 4,
  };
}

export type AskState = 'on' | 'off_switch' | 'off_ceiling' | 'unavailable';

export interface AskContext {
  page: string;
  label: string;
  details?: Record<string, string>;
}

export interface AskAnswer {
  id: string;
  answer: string;
  dropped: Array<{ sentence: string; figures: string[] }>;
  lookups: Lookup[];
  checked: number;
  questionsLeft: number;
  tables: TableView[];
}

/** A refusal the panel shows as written (the controller makes it a 400, or a 503 when Claude can't be reached). */
export class AskRefused extends Error {
  constructor(
    message: string,
    readonly unreachable = false,
  ) {
    super(message);
  }
}

export const REFUSALS = {
  unavailable: "Ask Claude isn't set up on this site yet.",
  off_switch:
    'Ask Claude is off for this course. Turn it on with the switch above.',
  off_ceiling:
    "Ask Claude has reached this month's limit for the whole site. It will be back on the 1st.",
  length: 'Ask a question of up to 1,000 characters.',
  allowance:
    'This course has used all its questions for this month. They start again on the 1st.',
  unreachable:
    "Claude couldn't be reached just now. Please try again in a minute.",
  allDropped:
    'Every sentence of this answer quoted a figure the lookups did not return, so none of it is shown. Try asking in a different way.',
} as const;

type Block = {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  [k: string]: unknown;
};
type Message = {
  role: 'user' | 'assistant';
  content: string | Block[] | Array<Record<string, unknown>>;
};

/** Earlier turns go back as plain text, without their lookups. */
export const EARLIER =
  "Your earlier answers in this conversation were built from lookups that are not repeated here, and every figure in them was checked against those lookups before faculty saw it. Treat them as correct; look things up again only for what they did not cover, and don't comment on how they were made.";

/** A reply that only says what Claude is about to look up ("I'll look at ...", "Let me check ..."), not an answer. */
export function announcesLookups(text: string) {
  return (
    text === '' ||
    (text.length < 400 &&
      /^(I'll|I will|I'm going to|Let me|First,? I|To answer (this|that),? I)\b/i.test(
        text,
      ))
  );
}

/** Claude's turn as it must be sent back: a lookup's input always goes back as an object, never an array. */
export function replayable(content: Block[]): Block[] {
  return content.map((block) =>
    block.type === 'tool_use'
      ? {
          ...block,
          input: block.input && !Array.isArray(block.input) ? block.input : {},
        }
      : block,
  );
}

@Injectable()
export class AskClaudeService {
  private readonly logger = new Logger(AskClaudeService.name);
  /** Replaced in tests. */
  settings: AskSettings = askSettings();

  constructor(
    private readonly ai: AiUseService,
    @InjectModel(AskQuestion.name)
    private readonly questions: Model<AskQuestion>,
    @InjectModel(Simulation.name)
    private readonly simulationModel: Model<SimulationDocument>,
    @InjectModel(Firm.name) private readonly firmModel: Model<FirmDocument>,
    @InjectModel(Decision.name)
    private readonly decisionModel: Model<DecisionDocument>,
    @InjectModel(KpiHistory.name)
    private readonly kpiHistoryModel: Model<KpiHistoryDocument>,
    @InjectModel(ForecastLog.name)
    private readonly forecastLogModel: Model<ForecastLogDocument>,
    @InjectModel(Enrollment.name)
    private readonly enrollmentModel: Model<EnrollmentDocument>,
    @InjectModel(QuarterCloseLog.name)
    private readonly closeLogModel: Model<QuarterCloseLog>,
    @InjectModel(Narrative.name)
    private readonly narrativeModel: Model<Narrative>,
  ) {}

  allowance(sim: { askQuestionsPerMonth?: number | null } | null) {
    return sim?.askQuestionsPerMonth ?? this.settings.questionsPerMonth;
  }

  async questionsLeft(
    simulationId: Types.ObjectId | string,
    sim: { askQuestionsPerMonth?: number | null } | null,
    now = new Date(),
  ) {
    const used = await this.questions.countDocuments({
      simulationId: new Types.ObjectId(String(simulationId)),
      status: 'answered',
      createdAt: { $gte: monthStart(now) },
    });
    return Math.max(0, this.allowance(sim) - used);
  }

  /** on, or why not: the first three refusals come from AiUseService.state(). */
  async state(sim: { aiEnabled?: boolean | null } | null): Promise<AskState> {
    return this.ai.state(sim);
  }

  async ask(input: {
    userId: string;
    simulation: SimulationDocument;
    context: AskContext;
    question: string;
    conversationId: string;
  }): Promise<AskAnswer> {
    const question = input.question.trim();
    const sim = input.simulation;
    const state = await this.state(sim);
    if (state === 'unavailable') throw new AskRefused(REFUSALS.unavailable);
    if (state === 'off_switch') throw new AskRefused(REFUSALS.off_switch);
    if (state === 'off_ceiling') throw new AskRefused(REFUSALS.off_ceiling);
    if (question === '' || question.length > 1000)
      throw new AskRefused(REFUSALS.length);
    const leftBefore = await this.questionsLeft(sim._id as Types.ObjectId, sim);
    if (leftBefore === 0) throw new AskRefused(REFUSALS.allowance);

    const history = await this.history(
      input.userId,
      sim._id as Types.ObjectId,
      input.conversationId,
    );
    const tools = new AskClaudeTools(await this.loadCourse(sim));
    const messages: Message[] = [];
    for (const turn of history) {
      messages.push(
        { role: 'user', content: turn.question },
        { role: 'assistant', content: turn.answer ?? '' },
      );
    }
    messages.push({ role: 'user', content: question });
    const page =
      this.page(sim.name, input.context) +
      (history.length ? ` ${EARLIER}` : '');
    const sources: string[] = [
      FACULTY_GUIDE,
      question,
      JSON.stringify(input.context),
    ];
    const lookups: Lookup[] = [];
    const parts: string[] = [];
    let inputTokens = 0;
    let outputTokens = 0;
    let answered = false;
    let nudged = false;

    try {
      for (let round = 0; round <= this.settings.maxLookupRounds; round++) {
        const response = await this.send(page, tools, messages);
        const usage = (response.usage ?? {}) as Record<string, number>;
        inputTokens +=
          (usage.input_tokens ?? 0) +
          (usage.cache_read_input_tokens ?? 0) +
          (usage.cache_creation_input_tokens ?? 0);
        outputTokens += usage.output_tokens ?? 0;
        const content = replayable((response.content ?? []) as Block[]);
        const stop = String(response.stop_reason ?? '');
        const uses = content.filter((b) => b.type === 'tool_use');
        const text = content
          .filter((b) => b.type === 'text')
          .map((b) => String(b.text ?? ''))
          .join('\n\n')
          .trim();
        // The answer is every turn's text, less the "I'll look at ..." lines.
        if (text !== '' && !announcesLookups(text)) parts.push(text);
        // A long turn the API paused: send it back as it is, and Claude carries on.
        if (stop === 'pause_turn') {
          messages.push({ role: 'assistant', content });
          continue;
        }
        if (uses.length === 0 || stop === 'max_tokens') {
          // A reply that only says what it will look up, before any lookup, is sent back once.
          if (
            lookups.length === 0 &&
            !nudged &&
            round < this.settings.maxLookupRounds &&
            announcesLookups(text)
          ) {
            nudged = true;
            messages.push(
              { role: 'assistant', content },
              {
                role: 'user',
                content:
                  'Go ahead: use the lookups now, then answer the question.',
              },
            );
            continue;
          }
          answered = parts.length > 0;
          break;
        }
        messages.push({ role: 'assistant', content });
        const results = uses.map((use) => {
          const result = tools.run(String(use.name), use.input ?? {});
          sources.push(JSON.stringify(result));
          lookups.push({
            name: String(use.name),
            summary: tools.summary(String(use.name), result),
          });
          return {
            type: 'tool_result',
            tool_use_id: use.id,
            content: JSON.stringify(result),
          };
        });
        messages.push({ role: 'user', content: results });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[ask-claude] request failed: ${message}`);
    }

    const check = answered
      ? figureCheck(compose(parts), sources, [])
      : {
          answer: '',
          dropped: [] as Array<{ sentence: string; figures: string[] }>,
          checked: 0,
        };
    if (answered && check.answer === '') check.answer = REFUSALS.allDropped;
    const id = randomUUID();
    await this.record({
      id,
      userId: input.userId,
      simulation: sim,
      context: input.context,
      conversationId: input.conversationId,
      question,
      answer: answered ? check.answer : null,
      lookups,
      dropped: check.dropped,
      checked: check.checked,
      inputTokens,
      outputTokens,
    });
    if (!answered) throw new AskRefused(REFUSALS.unreachable, true);
    return {
      id,
      answer: check.answer,
      dropped: check.dropped,
      lookups,
      checked: check.checked,
      // The answer is saved and counted by now: a database blip here must not
      // turn it into an error.
      questionsLeft: await this.questionsLeft(
        sim._id as Types.ObjectId,
        sim,
      ).catch(() => Math.max(0, leftBefore - 1)),
      tables: tools.views,
    };
  }

  /** The last four answered turns of this person's conversation on this course, oldest first. */
  private async history(
    userId: string,
    simulationId: Types.ObjectId,
    conversationId: string,
  ) {
    const rows = await this.questions
      .find({
        simulationId,
        userId: new Types.ObjectId(userId),
        conversationId,
        status: 'answered',
      })
      .sort({ createdAt: -1 })
      .limit(4)
      .lean();
    return rows.reverse();
  }

  /** Everything the lookups read, loaded for this one course. */
  async loadCourse(sim: SimulationDocument): Promise<CourseData> {
    const simulationId = sim._id as Types.ObjectId;
    const [
      firms,
      enrollments,
      decisions,
      kpis,
      forecastLogs,
      closeLogs,
      outcomes,
      readings,
    ] = await Promise.all([
      this.firmModel
        .find({ simulation: simulationId })
        .sort({ firmNumber: 1 })
        .lean(),
      this.enrollmentModel
        .find({
          simulation: simulationId,
          firm: { $ne: null },
          status: { $ne: EnrollmentStatus.DROPPED },
        })
        .select('firm')
        .lean(),
      this.decisionModel.find({ simulation: simulationId }).lean(),
      this.kpiHistoryModel.find({ simulation: simulationId }).lean(),
      this.forecastLogModel.find({ simulation: simulationId }).lean(),
      this.closeLogModel.find({ simulationId }).lean(),
      loadOutcomes(
        {
          kpiHistoryModel: this.kpiHistoryModel,
          decisionModel: this.decisionModel,
          simulationModel: this.simulationModel,
        },
        simulationId,
      ),
      this.narrativeModel
        .find({ simulationId, kind: 'reading' })
        .select('quarter engineText')
        .lean(),
      this.narrativeModel
        .find({ simulationId, kind: 'reading' })
        .select('quarter engineText')
        .lean(),
    ]);
    const students = new Map<string, number>();
    for (const e of enrollments as any[])
      students.set(String(e.firm), (students.get(String(e.firm)) ?? 0) + 1);
    return {
      simulation: {
        name: sim.name,
        status: sim.status,
        currentQuarter: sim.currentQuarter,
        totalQuarters: sim.totalQuarters,
        orientationQuarters: sim.orientationQuarters ?? 2,
        timezone: sim.timezone || 'UTC',
        quarterEndsAt: sim.quarterEndsAt ?? null,
        aiEnabled: sim.aiEnabled !== false,
        modules: (sim.moduleSchedule?.modules ?? []).map((m: any) => ({
          moduleId: m.moduleId,
          unlocksAtQuarter: m.unlocksAtQuarter,
          enabled: m.enabled,
        })),
      },
      firms: (firms as any[]).map((f) => ({
        id: String(f._id),
        number: f.firmNumber,
        name: f.name,
        students: students.get(String(f._id)) ?? 0,
      })),
      decisions: decisions as any[],
      kpis: kpis as any[],
      forecastLogs: forecastLogs as any[],
      closeLogs: closeLogs as any[],
      outcomes,
      readings: (readings as any[]).map((r) => ({
        quarter: r.quarter,
        engineText: r.engineText,
      })),
    };
  }

  /** Replaced in tests with a stub. */
  async send(
    page: string,
    tools: AskClaudeTools,
    messages: Message[],
  ): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.settings.timeoutMs);
    try {
      const body: Record<string, unknown> = {
        model: this.settings.model,
        max_tokens: this.settings.maxTokens,
        // The rules and the guide are the same on every page, so they're cached; the page line isn't.
        system: [
          { type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: page },
        ],
        tools: tools.definitions(),
        messages,
        ...(this.settings.thinking.trim()
          ? { thinking: { type: this.settings.thinking.trim() } }
          : {}),
      };
      const res = await fetch(this.settings.url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.settings.apiKey ?? '',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok)
        throw new Error(
          `Anthropic answered ${res.status}: ${(await res.text()).slice(0, 300)}`,
        );
      return (await res.json()) as Record<string, unknown>;
    } finally {
      clearTimeout(timer);
    }
  }

  private page(name: string, context: AskContext) {
    const details = Object.entries(context.details ?? {})
      .map(([k, v]) => `${k}: ${v}`)
      .join('; ');
    return `Faculty are on the "${context.label}" page of the course "${name}".${details ? ` On screen: ${details}.` : ''}`;
  }

  /** Never throws: a logging failure must not lose the answer. Writes the question and the AI call. */
  private async record(r: {
    id: string;
    userId: string;
    simulation: SimulationDocument;
    context: AskContext;
    conversationId: string;
    question: string;
    answer: string | null;
    lookups: Lookup[];
    dropped: Array<{ sentence: string; figures: string[] }>;
    checked: number;
    inputTokens: number;
    outputTokens: number;
  }) {
    const s = this.settings;
    const costUsd =
      Math.round(
        ((r.inputTokens * s.inputUsdPerMTok +
          r.outputTokens * s.outputUsdPerMTok) /
          1e6) *
          1e6,
      ) / 1e6;
    try {
      await this.questions.create({
        simulationId: r.simulation._id,
        userId: new Types.ObjectId(r.userId),
        conversationId: r.conversationId,
        page: r.context.page,
        context: r.context as unknown as Record<string, unknown>,
        question: r.question,
        answer: r.answer,
        lookups: r.lookups,
        dropped: r.dropped,
        figuresChecked: r.checked,
        status: r.answer === null ? 'failed' : 'answered',
        model: s.model,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        costUsd,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[ask-claude] could not record the question: ${message}`,
      );
    }
    await this.ai.record({
      simulationId: r.simulation._id as Types.ObjectId,
      course: r.simulation.name,
      feature: 'ask_claude',
      outcome:
        r.answer === null
          ? 'error'
          : r.dropped.length > 0
            ? 'checks_failed'
            : 'kept',
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      sentencesDropped: r.dropped.length,
      model: s.model,
      inputUsdPerMTok: s.inputUsdPerMTok,
      outputUsdPerMTok: s.outputUsdPerMTok,
    });
  }
}

const SYSTEM = `You are Ask Claude, the helper on the faculty pages of FLEXEE DA, a supply chain simulation. Each team of students runs one firm in a supply chain with two products (P1 and P2) across three regions, and analytics modules open on a schedule so the team's decisions come to depend on its own analysis. Each quarter closes at 11:59 PM course time, or earlier when faculty click Advance; then the next quarter opens.

How to answer:
- Answer the question in a few short, plain sentences. No headings, no bold, and no bullet lists unless faculty ask for a list.
- Use the lookups straight away, without first saying what you will look up; the text you write is the answer faculty read.
- Quarters close at 11:59 PM in the course time zone; say the zone whenever you give a time. Say a quarter "closes" or "closed", not that faculty "release" it: results appear once a quarter closes.
- Use the lookups for anything about this course: where it stands, which firms have submitted, when quarters closed, the firms' stored results, what each firm decided and how its forecasts did. Use the guide for how FLEXEE DA works.
- For results, read them with get_results; when figures matter to the answer, call show_table once so faculty see them beside it. The table is drawn below your text, so if you mention it, call it "the table below". For forecasts, use get_forecast_accuracy. For what happened in a closed quarter in words, use get_readings.
- Quote figures exactly as the lookups and the guide give them; don't round, add up or work out new figures. Describe a change in words rather than computing it. Never guess a date, a count, a status or any other figure: if a lookup or the guide didn't give it to you, don't state it. Any sentence with a figure that no lookup or the guide gave you is removed before faculty see it.
- You can only read. If faculty want something done (advance or extend a quarter, change the schedule, move a student), say which page does it.
- This is for faculty only. Never write anything meant to be passed on to students, and don't suggest what a firm should decide. Describe; don't grade, and don't rank firms as better or worse. A firm's outcome describes what happened and is not a grade.
- Quarters 1 to 3 are history the engine generates; students decide from Quarter 4.
- If the guide and the lookups don't answer the question, say so plainly.

The faculty guide:
${FACULTY_GUIDE}`;

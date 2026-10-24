// src/modules/ai/ai-use.service.ts
//
// The house rules every DA AI feature runs under (V3 layer 4), as in Flexee
// BPM's ai-use.service.ts:
//
// - Every call to Claude is logged with its feature, tokens, cost and
//   outcome (kept, dropped by the checks, or an error).
// - One monthly ceiling for the whole site: once this calendar month's spend
//   (UTC) reaches it, every AI feature stops until the month turns over and
//   the engine's own output is used.
// - Each course has a switch (Simulation.aiEnabled); off means no AI.
//
// The engine always decides; Claude only rewords. A feature must ask
// state() before calling Claude and record() every call it made.

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AiCall, AiFeature, AiOutcome } from './ai-use.schema';

export interface AiSettings {
  available: boolean;
  model: string;
  ceilingUsd: number;
  inputUsdPerMTok: number;
  outputUsdPerMTok: number;
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

export function aiSettings(env: NodeJS.ProcessEnv = process.env): AiSettings {
  return {
    available:
      env.FLEXEE_LLM_PROVIDER === 'anthropic' && Boolean(env.ANTHROPIC_API_KEY),
    model: env.FLEXEE_LLM_MODEL || 'claude-haiku-4-5',
    // One ceiling for every AI feature on the site, as in BPM ($50).
    ceilingUsd: number(env.FLEXEE_AI_MONTHLY_CEILING_USD, 50),
    // Claude Haiku 4.5's list prices, US dollars per million tokens.
    // Override when the model changes.
    inputUsdPerMTok: number(env.FLEXEE_LLM_INPUT_USD_PER_MTOK, 1),
    outputUsdPerMTok: number(env.FLEXEE_LLM_OUTPUT_USD_PER_MTOK, 5),
  };
}

/** Cost of one call, in US dollars, to a millionth of a dollar. */
export function callCost(
  call: { inputTokens: number; outputTokens: number },
  settings: Pick<AiSettings, 'inputUsdPerMTok' | 'outputUsdPerMTok'>,
) {
  const usd =
    (call.inputTokens * settings.inputUsdPerMTok +
      call.outputTokens * settings.outputUsdPerMTok) /
    1e6;
  return Math.round(usd * 1e6) / 1e6;
}

/** The first moment of the current calendar month, UTC. */
export function monthStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** on, or why not. */
export type AiState = 'on' | 'off_switch' | 'off_ceiling' | 'unavailable';

export interface AiCallRecord {
  simulationId: Types.ObjectId | string | null;
  course: string | null;
  feature: AiFeature;
  outcome: AiOutcome;
  inputTokens: number;
  outputTokens: number;
  sentencesDropped?: number;
  /** The model and prices of this call; default to the layer 4 settings. */
  model?: string;
  inputUsdPerMTok?: number;
  outputUsdPerMTok?: number;
}

@Injectable()
export class AiUseService {
  private readonly logger = new Logger(AiUseService.name);
  /** Replaced in tests. */
  settings: AiSettings = aiSettings();

  constructor(
    @InjectModel(AiCall.name) private readonly calls: Model<AiCall>,
  ) {}

  /** This calendar month's spend on the whole site, in US dollars. */
  async siteSpend(now = new Date()): Promise<number> {
    const rows = await this.calls.aggregate<{ total: number }>([
      { $match: { createdAt: { $gte: monthStart(now) } } },
      { $group: { _id: null, total: { $sum: '$costUsd' } } },
    ]);
    return Math.round((rows[0]?.total ?? 0) * 100) / 100;
  }

  /** Whether a course may call Claude now. Ask before every call. */
  async state(
    course: { aiEnabled?: boolean | null } | null,
    now = new Date(),
  ): Promise<AiState> {
    if (!this.settings.available) return 'unavailable';
    if (course?.aiEnabled === false) return 'off_switch';
    if ((await this.siteSpend(now)) >= this.settings.ceilingUsd)
      return 'off_ceiling';
    return 'on';
  }

  /**
   * Log one call, retries included: each attempt reached Claude, so each is
   * spend. Never throws: a logging failure must not lose the answer.
   */
  async record(call: AiCallRecord): Promise<void> {
    try {
      await this.calls.create({
        simulationId:
          call.simulationId && Types.ObjectId.isValid(String(call.simulationId))
            ? new Types.ObjectId(String(call.simulationId))
            : null,
        course: call.course,
        feature: call.feature,
        model: call.model ?? this.settings.model,
        outcome: call.outcome,
        sentencesDropped: call.sentencesDropped ?? 0,
        inputTokens: call.inputTokens,
        outputTokens: call.outputTokens,
        costUsd: callCost(call, {
          inputUsdPerMTok:
            call.inputUsdPerMTok ?? this.settings.inputUsdPerMTok,
          outputUsdPerMTok:
            call.outputUsdPerMTok ?? this.settings.outputUsdPerMTok,
        }),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[ai-use] could not record a call: ${message}`);
    }
  }
}

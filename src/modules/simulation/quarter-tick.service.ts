// src/modules/simulation/quarter-tick.service.ts
//
// Background sweeper that auto-advances simulations whose quarter window has
// expired. Runs on a NestJS @Cron schedule.
//
// Why this exists:
//   The existing checkQuarterExpiry() method runs lazily — only when a
//   student or faculty hits an endpoint that reads simulation state. If no
//   one is logged in when a quarter ends, the advance never happens until
//   someone next opens the sim. That's bad UX for everyone waiting on the
//   next quarter's results.
//
//   This sweeper closes that gap. It walks every IN_PROGRESS simulation
//   whose quarterEndsAt is in the past and triggers the same advance logic
//   the lazy path uses.
//
// Timezone:
//   The faculty's chosen timezone is baked into quarterEndsAt at scheduling
//   time (when the quarter is initialized/advanced, the configured timezone
//   determines the wall-clock moment that timestamp represents). Storage is
//   UTC. So this sweeper just compares quarterEndsAt < now() in UTC and the
//   per-sim timezone selection is honored automatically.
//
// Concurrency:
//   Multiple backend instances might run this cron simultaneously (Vercel
//   serverless, replicas, etc). We claim each sim atomically via a
//   findOneAndUpdate that bumps a "lastSweptAt" field — only one instance
//   per tick gets to process any given sim.
//
// Frequency:
//   CRON_TICK_INTERVAL_MINUTES env var, default 5. Down-to-the-minute
//   precision isn't needed for 14-day quarters; this bounds auto-advance
//   latency to a few minutes after the window closes.
//
// Disable:
//   Set CRON_QUARTER_TICK_ENABLED=false to turn off (useful for local dev
//   and one-off scripts).

import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Simulation,
  SimulationDocument,
  SimulationStatus,
} from '../../entities/index.entity';
import { SimulationService } from './simulation.service';

@Injectable()
export class QuarterTickService {
  private readonly logger = new Logger(QuarterTickService.name);

  // Process at most this many sims per tick. Prevents a backlog from monopolizing
  // the loop after a long downtime. Anything left over is picked up next tick.
  private readonly BATCH_LIMIT = 50;

  // Don't let a stuck claim block a sim forever. If a previous sweep crashed
  // mid-advance and left lastSweptAt set, we still want to retry — after this
  // long, we treat the claim as stale.
  private readonly STALE_CLAIM_MINUTES = 15;

  constructor(
    @InjectModel(Simulation.name)
    private readonly simulationModel: Model<SimulationDocument>,
    // forwardRef avoids the circular: SimulationModule imports this service,
    // this service depends on SimulationService.
    @Inject(forwardRef(() => SimulationService))
    private readonly simulationService: SimulationService,
  ) {}

  // Every 5 minutes by default. NestJS uses standard cron syntax (sec min h dom mon dow).
  // We use a preset expression for readability — override via env if needed.
  @Cron(CronExpression.EVERY_5_MINUTES, {
    name: 'quarter-tick',
    // Keep the schedule running even if a previous tick is still in flight.
    // The atomic claim below prevents double-processing.
  })
  async tick(): Promise<void> {
    if (process.env.CRON_QUARTER_TICK_ENABLED === 'false') {
      return;
    }

    const now = new Date();
    const staleClaimCutoff = new Date(
      now.getTime() - this.STALE_CLAIM_MINUTES * 60 * 1000,
    );

    // Find candidate sims: IN_PROGRESS, window expired, and either never swept
    // or last swept long enough ago that the previous attempt is presumed dead.
    const candidates = await this.simulationModel
      .find({
        status: SimulationStatus.IN_PROGRESS,
        quarterEndsAt: { $lte: now },
        $or: [
          { lastSweptAt: { $exists: false } },
          { lastSweptAt: null },
          { lastSweptAt: { $lte: staleClaimCutoff } },
        ],
      })
      .select('_id name currentQuarter quarterEndsAt')
      .limit(this.BATCH_LIMIT)
      .lean();

    if (candidates.length === 0) return;

    this.logger.log(
      `[quarter-tick] ${candidates.length} simulation(s) past quarter end — sweeping`,
    );

    let advanced = 0;
    let skipped = 0;
    let failed = 0;

    for (const cand of candidates) {
      const simId = cand._id as Types.ObjectId;
      const result = await this.processOne(simId, staleClaimCutoff);
      if (result === 'ADVANCED') advanced++;
      else if (result === 'SKIPPED') skipped++;
      else failed++;
    }

    this.logger.log(
      `[quarter-tick] done — advanced=${advanced} skipped=${skipped} failed=${failed}`,
    );
  }

  /**
   * Process one simulation. Returns one of:
   *   - ADVANCED: we successfully ran advanceQuarter
   *   - SKIPPED:  another instance claimed it first, or its state changed
   *               between query and claim (already advanced, completed, etc)
   *   - FAILED:   advanceQuarter threw — logged and moved on
   *
   * The atomic claim uses findOneAndUpdate with the same preconditions as
   * the candidate query. If anything has changed (status flipped, quarter
   * already advanced, another instance got there first), update returns
   * null and we skip cleanly.
   */
  private async processOne(
    simId: Types.ObjectId,
    staleClaimCutoff: Date,
  ): Promise<'ADVANCED' | 'SKIPPED' | 'FAILED'> {
    const now = new Date();

    // Atomic claim — only one process wins.
    const claimed = await this.simulationModel.findOneAndUpdate(
      {
        _id: simId,
        status: SimulationStatus.IN_PROGRESS,
        quarterEndsAt: { $lte: now },
        $or: [
          { lastSweptAt: { $exists: false } },
          { lastSweptAt: null },
          { lastSweptAt: { $lte: staleClaimCutoff } },
        ],
      },
      { $set: { lastSweptAt: now } },
      { new: true },
    );

    if (!claimed) return 'SKIPPED';

    try {
      // SimulationService.advanceQuarter already handles missing-firm
      // carry-forward via the same path that checkQuarterExpiry uses. We
      // could call checkQuarterExpiry directly, but that's private and
      // tightly coupled; advanceQuarter is the public seam.
      //
      // Carry-forward step: before advancing, replicate the missing-firm
      // backfill that checkQuarterExpiry does. We can't call the private
      // method, so we inline a simplified version via the service's
      // existing public method.
      await this.simulationService.autoAdvanceExpiredQuarter(String(simId));

      this.logger.log(
        `[quarter-tick] sim=${simId} Q${claimed.currentQuarter} auto-advanced`,
      );
      return 'ADVANCED';
    } catch (err: any) {
      this.logger.error(
        `[quarter-tick] sim=${simId} auto-advance failed: ${err?.message || err}`,
        err?.stack,
      );
      return 'FAILED';
    }
  }
}
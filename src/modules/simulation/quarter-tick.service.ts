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
// Triggers:
//   On Vercel (serverless) the @Cron below does not run on a schedule, so
//   Vercel's own cron calls GET /api/cron/quarter-tick (CronController),
//   which runs the same sweep(). On a long-running server the @Cron runs
//   it too. Both are safe together: every close takes the claim in
//   SimulationService.claimQuarterClose, and reminders take their own.
//
// Timezone:
//   quarterEndsAt is computed on the course calendar (src/lib/courseTime)
//   and stored in UTC, so comparing it with now() honors the course zone.
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

import { Injectable, Logger, Inject, Optional, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
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
  User,
  UserDocument,
} from '../../entities/index.entity';
import { formatCourseDateTime } from '../../lib/courseTime';
import { SchedulerState } from '../reporting/reporting.schemas';
import { sendQuarterReminderEmail } from '../../utils/email.util';

export type SweepResult = {
  advanced: number;
  skipped: number;
  failed: number;
  remindersSent: number;
};
import { SimulationService } from './simulation.service';
import { NarrativesService } from '../narratives/narratives.service';

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
    @InjectModel(Firm.name)
    private readonly firmModel: Model<FirmDocument>,
    @InjectModel(Decision.name)
    private readonly decisionModel: Model<DecisionDocument>,
    @InjectModel(Enrollment.name)
    private readonly enrollmentModel: Model<EnrollmentDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(SchedulerState.name)
    private readonly schedulerStateModel: Model<SchedulerState>,
    // Rewords the quarter texts (Design D). Optional: a sweep never depends on it.
    @Optional() private readonly narratives?: NarrativesService,
  ) {}

  /** The scheduler_state key the reporting connector reads. */
  static readonly SWEEP_KEY = 'quarter-sweep';

  /** Send the day-before reminder this long before a quarter closes. */
  static readonly REMINDER_LEAD_HOURS = 24;

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
    await this.sweep();
  }

  /**
   * One pass: close every quarter that is past its deadline, then send the
   * day-before reminders that are due. Called by the @Cron above and by
   * Vercel's cron through CronController.
   */
  async sweep(): Promise<SweepResult> {
    // Recorded first, so report_health can tell the schedule is running even
    // when a sweep finds nothing to do or fails part-way.
    try {
      await this.schedulerStateModel.updateOne(
        { key: QuarterTickService.SWEEP_KEY },
        { $set: { lastRunAt: new Date() } },
        { upsert: true },
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[quarter-tick] could not record the run: ${message}`);
    }
    const closes = await this.closeExpiredQuarters();
    const remindersSent = await this.sendDueReminders();
    // Reword up to 10 pending texts; never lets a failure here stop the sweep.
    try {
      await this.narratives?.rewordPending();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[quarter-tick] rewording failed: ${message}`);
    }
    return { ...closes, remindersSent };
  }

  private async closeExpiredQuarters(): Promise<
    Omit<SweepResult, 'remindersSent'>
  > {
    const now = new Date();
    const staleClaimCutoff = new Date(
      now.getTime() - this.STALE_CLAIM_MINUTES * 60 * 1000,
    );

    // Find candidate sims: IN_PROGRESS, window expired, and either never swept
    // or last swept long enough ago that the previous attempt is presumed dead.
    const candidates = await this.simulationModel
      .find({
        status: SimulationStatus.IN_PROGRESS,
        // Practice courses have no deadlines: faculty close their quarters.
        isPractice: { $ne: true },
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

    if (candidates.length === 0) return { advanced: 0, skipped: 0, failed: 0 };

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
    return { advanced, skipped, failed };
  }

  /**
   * Email every student whose team hasn't submitted, once per quarter, when
   * the quarter closes within REMINDER_LEAD_HOURS. The sim is claimed for
   * the quarter first (reminderSentForQuarter), so two sweeps can't both
   * send. Returns the number of emails sent.
   */
  async sendDueReminders(): Promise<number> {
    const now = new Date();
    const horizon = new Date(
      now.getTime() + QuarterTickService.REMINDER_LEAD_HOURS * 3_600_000,
    );
    const due = await this.simulationModel
      .find({
        status: SimulationStatus.IN_PROGRESS,
        isPractice: { $ne: true },
        quarterEndsAt: { $gt: now, $lte: horizon },
      })
      .select('_id currentQuarter reminderSentForQuarter')
      .limit(this.BATCH_LIMIT)
      .lean();

    let sent = 0;
    for (const cand of due) {
      if (cand.reminderSentForQuarter === cand.currentQuarter) continue;
      const sim = await this.simulationModel.findOneAndUpdate(
        {
          _id: cand._id,
          currentQuarter: cand.currentQuarter,
          reminderSentForQuarter: { $ne: cand.currentQuarter },
        },
        { $set: { reminderSentForQuarter: cand.currentQuarter } },
        { new: true },
      );
      if (!sim) continue; // another sweep took it
      try {
        sent += await this.remindOneSimulation(sim);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `[quarter-tick] sim=${String(sim._id)} reminders failed: ${message}`,
        );
      }
    }
    return sent;
  }

  private async remindOneSimulation(sim: SimulationDocument): Promise<number> {
    const quarter = sim.currentQuarter;
    const firms = await this.firmModel
      .find({ simulation: sim._id })
      .select('_id')
      .lean();
    const submitted = await this.decisionModel.distinct('firm', {
      simulation: sim._id,
      quarter,
      status: { $in: [DecisionStatus.SUBMITTED, DecisionStatus.PROCESSED] },
    });
    const done = new Set(submitted.map((id) => String(id)));
    const waitingFirmIds = firms
      .map((f) => f._id as Types.ObjectId)
      .filter((id) => !done.has(id.toHexString()));
    if (waitingFirmIds.length === 0) return 0;

    const enrollments = await this.enrollmentModel
      .find({
        simulation: sim._id,
        firm: { $in: waitingFirmIds },
        status: EnrollmentStatus.ACTIVE,
        canSubmitDecisions: true,
      })
      .select('user')
      .lean();
    const users = await this.userModel
      .find({ _id: { $in: enrollments.map((e) => e.user) }, isActive: true })
      .select('email firstName')
      .lean();

    const closesAt = formatCourseDateTime(
      sim.quarterEndsAt!,
      sim.timezone || 'UTC',
    );
    const link = `${process.env.FRONTEND_URL || ''}/dashboard/student`;
    let sent = 0;
    for (const u of users) {
      if (!u.email) continue;
      const ok = await sendQuarterReminderEmail(
        u.email,
        u.firstName,
        sim.name,
        quarter,
        closesAt,
        link,
      );
      if (ok) sent += 1;
    }
    // Kept so "This week" can say when the reminder went and to how many firms.
    await this.simulationModel.updateOne(
      { _id: sim._id },
      { $set: { reminderSentAt: new Date(), reminderFirmCount: waitingFirmIds.length } },
    );
    this.logger.log(
      `[quarter-tick] sim=${String(sim._id)} Q${quarter} reminders sent=${sent} of ${users.length}`,
    );
    return sent;
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

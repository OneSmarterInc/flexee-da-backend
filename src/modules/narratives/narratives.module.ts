import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Decision,
  DecisionSchema,
  DemandHistory,
  DemandHistorySchema,
  Enrollment,
  EnrollmentSchema,
  Event,
  EventImpact,
  EventImpactSchema,
  EventSchema,
  Firm,
  FirmSchema,
  ForecastLog,
  ForecastLogSchema,
  KpiHistory,
  KpiHistorySchema,
  Simulation,
  SimulationSchema,
} from '../../entities/index.entity';
import {
  QuarterCloseLog,
  QuarterCloseLogSchema,
} from '../reporting/reporting.schemas';
import { NarrativesController } from './narratives.controller';
import { NarrativesService } from './narratives.service';
import { Narrative, NarrativeSchema } from './narrative.schema';

/** Readings, team explanations and the debrief (V3 Design D). */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Narrative.name, schema: NarrativeSchema },
      { name: Simulation.name, schema: SimulationSchema },
      { name: Firm.name, schema: FirmSchema },
      { name: Decision.name, schema: DecisionSchema },
      { name: KpiHistory.name, schema: KpiHistorySchema },
      { name: ForecastLog.name, schema: ForecastLogSchema },
      { name: DemandHistory.name, schema: DemandHistorySchema },
      { name: Event.name, schema: EventSchema },
      { name: EventImpact.name, schema: EventImpactSchema },
      { name: Enrollment.name, schema: EnrollmentSchema },
      { name: QuarterCloseLog.name, schema: QuarterCloseLogSchema },
    ]),
  ],
  controllers: [NarrativesController],
  providers: [NarrativesService],
  exports: [NarrativesService, MongooseModule],
})
export class NarrativesModule {}

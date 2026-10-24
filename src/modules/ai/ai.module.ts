import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Decision,
  DecisionSchema,
  Enrollment,
  EnrollmentSchema,
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
import { AiCall, AiCallSchema } from './ai-use.schema';
import { AiUseService } from './ai-use.service';
import { AskClaudeController } from './ask-claude.controller';
import { AskClaudeService } from './ask-claude.service';
import { AskQuestion, AskQuestionSchema } from './ask-question.schema';
import { Narrative, NarrativeSchema } from '../narratives/narrative.schema';

/** The house rules for every AI feature (V3 layer 4), and Ask Claude for faculty (Design C). */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AiCall.name, schema: AiCallSchema },
      { name: AskQuestion.name, schema: AskQuestionSchema },
      { name: Narrative.name, schema: NarrativeSchema },
      { name: Simulation.name, schema: SimulationSchema },
      { name: Firm.name, schema: FirmSchema },
      { name: Decision.name, schema: DecisionSchema },
      { name: KpiHistory.name, schema: KpiHistorySchema },
      { name: ForecastLog.name, schema: ForecastLogSchema },
      { name: Enrollment.name, schema: EnrollmentSchema },
      { name: QuarterCloseLog.name, schema: QuarterCloseLogSchema },
    ]),
  ],
  controllers: [AskClaudeController],
  providers: [AiUseService, AskClaudeService],
  exports: [AiUseService, AskClaudeService, MongooseModule],
})
export class AiModule {}

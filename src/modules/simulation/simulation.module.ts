import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SimulationController } from './simulation.controller';
import { SimulationService } from './simulation.service';
import { QuarterTickService } from './quarter-tick.service';
import {
  Simulation,
  SimulationSchema,
  Firm,
  FirmSchema,
  QuarterState,
  QuarterStateSchema,
  Decision,
  DecisionSchema,
  DemandHistory,
  DemandHistorySchema,
  Enrollment,
  EnrollmentSchema,
  User,
  UserSchema,
  Event,
  EventSchema,
  KpiHistory,
  KpiHistorySchema,
  SupplierOrder,
  SupplierOrderSchema,
  ForecastLog,
  ForecastLogSchema,
  TenQReportSchema,
  TenQReport,
  CreditHistory,
  CreditHistorySchema,
  SCRMHistory,
  SCRMHistorySchema,
  EventImpact,
  EventImpactSchema,
  StudentOnboarding,
  StudentOnboardingSchema,
} from '../../entities/index.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Simulation.name, schema: SimulationSchema },
      { name: Firm.name, schema: FirmSchema },
      { name: QuarterState.name, schema: QuarterStateSchema },
      { name: Decision.name, schema: DecisionSchema },
      { name: DemandHistory.name, schema: DemandHistorySchema },
      { name: Enrollment.name, schema: EnrollmentSchema },
      { name: User.name, schema: UserSchema },
      { name: Event.name, schema: EventSchema },
      { name: KpiHistory.name, schema: KpiHistorySchema },
      { name: SupplierOrder.name, schema: SupplierOrderSchema },
      { name: ForecastLog.name, schema: ForecastLogSchema },
      { name: TenQReport.name, schema: TenQReportSchema },
      { name: CreditHistory.name, schema: CreditHistorySchema },
      { name: SCRMHistory.name, schema: SCRMHistorySchema },
      { name: EventImpact.name, schema: EventImpactSchema },
      { name: StudentOnboarding.name, schema: StudentOnboardingSchema },
    ]),
  ],
  controllers: [SimulationController],
  providers: [SimulationService, QuarterTickService],
  exports: [SimulationService],
})
export class SimulationModule {}
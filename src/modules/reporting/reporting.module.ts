import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Decision,
  DecisionSchema,
  Enrollment,
  EnrollmentSchema,
  Firm,
  FirmSchema,
  Simulation,
  SimulationSchema,
  User,
  UserSchema,
} from '../../entities/index.entity';
import {
  QuarterCloseLog,
  QuarterCloseLogSchema,
  ReportingCall,
  ReportingCallSchema,
  ReportingClient,
  ReportingClientSchema,
  ReportingCode,
  ReportingCodeSchema,
  ReportingConnection,
  ReportingConnectionSchema,
  SchedulerState,
  SchedulerStateSchema,
} from './reporting.schemas';
import { ReportingOAuthService } from './reporting-oauth.service';
import { ReportingViewsService } from './reporting-views.service';
import { McpService } from './mcp.service';
import {
  ReportingAdminController,
  ReportingController,
  ReportingDiscoveryController,
} from './reporting.controller';

/** The Flexee family reporting connector (contract v1). */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Simulation.name, schema: SimulationSchema },
      { name: Firm.name, schema: FirmSchema },
      { name: Enrollment.name, schema: EnrollmentSchema },
      { name: Decision.name, schema: DecisionSchema },
      { name: User.name, schema: UserSchema },
      { name: QuarterCloseLog.name, schema: QuarterCloseLogSchema },
      { name: SchedulerState.name, schema: SchedulerStateSchema },
      { name: ReportingClient.name, schema: ReportingClientSchema },
      { name: ReportingCode.name, schema: ReportingCodeSchema },
      { name: ReportingConnection.name, schema: ReportingConnectionSchema },
      { name: ReportingCall.name, schema: ReportingCallSchema },
    ]),
  ],
  controllers: [
    ReportingDiscoveryController,
    ReportingController,
    ReportingAdminController,
  ],
  providers: [ReportingOAuthService, ReportingViewsService, McpService],
})
export class ReportingModule {}

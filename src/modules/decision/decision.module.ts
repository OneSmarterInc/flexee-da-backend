import {
  Decision,
  DecisionSchema,
  Firm,
  FirmSchema,
  QuarterState,
  QuarterStateSchema,
  Simulation,
  SimulationSchema,
  EnrollmentSchema,
  Enrollment,
  User,
  UserSchema,
  CreditHistorySchema,
  CreditHistory,
} from '../../entities/index.entity';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DecisionController } from './decision.controller';
import { DecisionService } from './decision.service';
import { SimulationModule } from '../simulation/simulation.module';

@Module({
  imports: [
    SimulationModule,
    MongooseModule.forFeature([
      { name: Decision.name, schema: DecisionSchema },
      { name: Firm.name, schema: FirmSchema },
      { name: QuarterState.name, schema: QuarterStateSchema },
      { name: Simulation.name, schema: SimulationSchema },
      { name: Enrollment.name, schema: EnrollmentSchema },
      { name: User.name, schema: UserSchema },
      { name: CreditHistory.name, schema: CreditHistorySchema },
    ]),
  ],
  controllers: [DecisionController],
  providers: [DecisionService],
  exports: [DecisionService],
})
export class DecisionModule {}
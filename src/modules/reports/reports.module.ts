import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { TenqReportController } from './tenq-report.controller';
import { TenqReportService } from './tenq-report.service';
import {
  KpiHistory,
  KpiHistorySchema,
  TenQReport,
  TenQReportSchema,
  Firm,
  FirmSchema,
  Decision,
  DecisionSchema,
  Simulation,
  SimulationSchema,
} from '../../entities/index.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: KpiHistory.name, schema: KpiHistorySchema },
      { name: TenQReport.name, schema: TenQReportSchema },
      { name: Firm.name, schema: FirmSchema },
      { name: Decision.name, schema: DecisionSchema },
      { name: Simulation.name, schema: SimulationSchema },
    ]),
  ],
  controllers: [ReportsController, TenqReportController],
  providers: [ReportsService, TenqReportService],
  exports: [ReportsService, TenqReportService],
})
export class ReportsModule {}
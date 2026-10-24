import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { AppModule } from '../app.module';
import { SimulationService } from '../modules/simulation/simulation.service';
import {
  CreditHistory,
  Decision,
  DemandHistory,
  Enrollment,
  EnrollmentRole,
  EnrollmentStatus,
  Event,
  EventImpact,
  Firm,
  ForecastLog,
  KpiHistory,
  ModuleScheduleMode,
  QuarterState,
  SCRMHistory,
  SchedulePreset,
  Simulation,
  StudentOnboarding,
  SupplierOrder,
  TenQReport,
  User,
  UserRole,
} from '../entities/index.entity';

dotenv.config();

// The seeder resets demo data and creates known accounts: never on production.
if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to run the seeder when NODE_ENV=production.');
  process.exit(1);
}

const PASSWORD = 'Demo1234!';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const DEMO_COURSE_CODE = 'FLEXEE-DA-SLICE1';

type DemoModels = {
  SimulationModel: Model<any>;
  FirmModel: Model<any>;
  EnrollmentModel: Model<any>;
  QuarterStateModel: Model<any>;
  DecisionModel: Model<any>;
  DemandHistoryModel: Model<any>;
  KpiHistoryModel: Model<any>;
  SupplierOrderModel: Model<any>;
  ForecastLogModel: Model<any>;
  TenQReportModel: Model<any>;
  CreditHistoryModel: Model<any>;
  SCRMHistoryModel: Model<any>;
  EventModel: Model<any>;
  EventImpactModel: Model<any>;
  StudentOnboardingModel: Model<any>;
};

async function upsertUser(UserModel: Model<any>, data: any, password: string = PASSWORD) {
  const passwordHash = await bcrypt.hash(password, 10);
  return UserModel.findOneAndUpdate(
    { email: data.email.toLowerCase() },
    {
      $set: {
        ...data,
        email: data.email.toLowerCase(),
        passwordHash,
        isActive: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

/**
 * A named account whose password comes from the environment, never from this
 * file. An account that already exists keeps its password: the seeder sets a
 * password only when it creates the account.
 */
async function ensureEnvUser(UserModel: Model<any>, data: any, envName: string) {
  const email = data.email.toLowerCase();
  const password = process.env[envName];
  if (!password) {
    console.log(`Skipped ${email}: set ${envName} to create it.`);
    return;
  }
  if (await UserModel.exists({ email })) {
    console.log(`${email} already exists; its password was left alone.`);
    return;
  }
  await upsertUser(UserModel, data, password);
  console.log(`Created ${email} (password from ${envName}).`);
}

async function deleteDemoSimulation(models: DemoModels): Promise<void> {
  const existing = await models.SimulationModel.findOne({ courseCode: DEMO_COURSE_CODE });
  if (!existing) return;

  const simulationId = existing._id as Types.ObjectId;
  await Promise.all([
    models.FirmModel.deleteMany({ simulation: simulationId }),
    models.EnrollmentModel.deleteMany({ simulation: simulationId }),
    models.QuarterStateModel.deleteMany({ simulation: simulationId }),
    models.DecisionModel.deleteMany({ simulation: simulationId }),
    models.DemandHistoryModel.deleteMany({ simulation: simulationId }),
    models.KpiHistoryModel.deleteMany({ simulation: simulationId }),
    models.SupplierOrderModel.deleteMany({ simulation: simulationId }),
    models.ForecastLogModel.deleteMany({ simulation: simulationId }),
    models.TenQReportModel.deleteMany({ simulation: simulationId }),
    models.CreditHistoryModel.deleteMany({ simulation: simulationId }),
    models.SCRMHistoryModel.deleteMany({ simulation: simulationId }),
    models.EventModel.deleteMany({ simulation: simulationId }),
    models.EventImpactModel.deleteMany({ simulation: simulationId }),
    models.StudentOnboardingModel.deleteMany({ simulation: simulationId }),
  ]);
  await models.SimulationModel.deleteOne({ _id: simulationId });
}

async function runSeeder() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const UserModel = app.get<Model<any>>(getModelToken(User.name));
    const models: DemoModels = {
      SimulationModel: app.get<Model<any>>(getModelToken(Simulation.name)),
      FirmModel: app.get<Model<any>>(getModelToken(Firm.name)),
      EnrollmentModel: app.get<Model<any>>(getModelToken(Enrollment.name)),
      QuarterStateModel: app.get<Model<any>>(getModelToken(QuarterState.name)),
      DecisionModel: app.get<Model<any>>(getModelToken(Decision.name)),
      DemandHistoryModel: app.get<Model<any>>(getModelToken(DemandHistory.name)),
      KpiHistoryModel: app.get<Model<any>>(getModelToken(KpiHistory.name)),
      SupplierOrderModel: app.get<Model<any>>(getModelToken(SupplierOrder.name)),
      ForecastLogModel: app.get<Model<any>>(getModelToken(ForecastLog.name)),
      TenQReportModel: app.get<Model<any>>(getModelToken(TenQReport.name)),
      CreditHistoryModel: app.get<Model<any>>(getModelToken(CreditHistory.name)),
      SCRMHistoryModel: app.get<Model<any>>(getModelToken(SCRMHistory.name)),
      EventModel: app.get<Model<any>>(getModelToken(Event.name)),
      EventImpactModel: app.get<Model<any>>(getModelToken(EventImpact.name)),
      StudentOnboardingModel: app.get<Model<any>>(getModelToken(StudentOnboarding.name)),
    };
    const simulationService = app.get(SimulationService);

    const command = process.argv[2];
    if (command === 'clear') {
      console.log('Clearing Slice 1 demo users and simulation...');
      await deleteDemoSimulation(models);
      await UserModel.deleteMany({
        email: {
          $in: [
            'faculty@flexeeda.com',
            'faculty1@flexee.com',
            'admin@flexee.com',
            'student1@flexeeda.com',
            'student2@flexeeda.com',
            'student3@flexeeda.com',
          ],
        },
      });
      console.log('Slice 1 demo data cleared.');
      return;
    }

    console.log('Seeding FLEXEE DA Slice 1 demo data...');

    const faculty = await upsertUser(UserModel, {
      email: 'faculty@flexeeda.com',
      firstName: 'Demo',
      lastName: 'Faculty',
      displayName: 'Demo Faculty',
      role: UserRole.FACULTY,
      organization: 'FLEXEE DA',
    });

    await ensureEnvUser(UserModel, {
      email: 'faculty1@flexee.com',
      firstName: 'Faculty',
      lastName: 'One',
      displayName: 'Faculty One',
      role: UserRole.FACULTY,
      organization: 'FLEXEE DA',
    }, 'SEED_FACULTY_PASSWORD');

    await ensureEnvUser(UserModel, {
      email: 'admin@flexee.com',
      firstName: 'Admin',
      lastName: 'User',
      displayName: 'Admin User',
      role: UserRole.ADMIN,
      organization: 'FLEXEE DA',
    }, 'SEED_ADMIN_PASSWORD');

    const students = await Promise.all([1, 2, 3].map((n) =>
      upsertUser(UserModel, {
        email: `student${n}@flexeeda.com`,
        firstName: `Student ${n}`,
        lastName: 'Demo',
        displayName: `Student ${n} Demo`,
        studentId: `FLEXEEDA00${n}`,
        role: UserRole.STUDENT,
        organization: 'FLEXEE DA',
      }),
    ));

    await deleteDemoSimulation(models);

    const created = await simulationService.create(String(faculty._id), {
      name: 'FLEXEE DA Slice 1 Demo',
      description: 'STANDARD_COURSE demo seeded for faculty schedule configuration.',
      totalQuarters: 11,
      orientationQuarters: 2,
      schedulePreset: SchedulePreset.STANDARD_COURSE,
      moduleSchedule: {
        mode: ModuleScheduleMode.PROGRESSIVE,
        modules: [],
      },
      numFirms: 3,
      numRegions: 3,
      numProducts: 2,
      startingCash: 50_000_000,
      startingRevenue: 1_000_000_000,
      totalMarketSize: 600_000,
      courseCode: DEMO_COURSE_CODE,
      institutionName: 'FLEXEE DA Demo',
      // The demo course runs on Dayton time; every course needs a zone.
      timezone: 'America/New_York',
      quarterDurationDays: 14,
      firmConfigs: [
        { firmNumber: 1, name: 'Firm 1', color: '#3B82F6' },
        { firmNumber: 2, name: 'Firm 2', color: '#10B981' },
        { firmNumber: 3, name: 'Firm 3', color: '#F59E0B' },
      ],
    } as any);

    const simulation = await models.SimulationModel.findById((created as any)._id);
    const firms = await models.FirmModel.find({ simulation: simulation._id }).sort({ firmNumber: 1 });

    await models.EnrollmentModel.deleteMany({ simulation: simulation._id });
    await Promise.all(firms.map(async (firm: any, index: number) => {
      const student = students[index];
      firm.members = [student._id];
      await firm.save();
      await models.EnrollmentModel.create({
        simulation: simulation._id,
        firm: firm._id,
        user: student._id,
        firmNumber: firm.firmNumber,
        status: EnrollmentStatus.ACTIVE,
        role: EnrollmentRole.TEAM_MEMBER,
        teamName: firm.name,
        canSubmitDecisions: true,
        canViewReports: true,
        canViewCompetitorData: false,
        decisionsSubmitted: 0,
      });
    }));

    const [demandCount, decisionCount, kpiCount, tenQCount] = await Promise.all([
      models.DemandHistoryModel.countDocuments({ simulation: simulation._id, quarter: { $in: [1, 2, 3] } }),
      models.DecisionModel.countDocuments({ simulation: simulation._id, quarter: { $in: [1, 2, 3] } }),
      models.KpiHistoryModel.countDocuments({ simulation: simulation._id, quarter: { $in: [1, 2, 3] } }),
      models.TenQReportModel.countDocuments({ simulation: simulation._id, quarter: { $in: [1, 2, 3] } }),
    ]);

    console.log('\nFLEXEE DA Slice 1 seed complete.');
    console.log(`Faculty: faculty@flexeeda.com / ${PASSWORD}`);
    console.log('Also: faculty1@flexee.com and admin@flexee.com, with the passwords you set in SEED_FACULTY_PASSWORD and SEED_ADMIN_PASSWORD.');
    console.log(`Students: student1@flexeeda.com, student2@flexeeda.com, student3@flexeeda.com / ${PASSWORD}`);
    console.log(`Faculty dashboard: ${FRONTEND_URL}/dashboard/faculty`);
    console.log(`Student login: ${FRONTEND_URL}/login`);
    console.log(`Seeded simulation: ${simulation.name} (${simulation._id}) at Q${simulation.currentQuarter}`);
    console.log(`Prehistory artifacts: demand=${demandCount}, decisions=${decisionCount}, kpis=${kpiCount}, tenQ=${tenQCount}`);
  } catch (error: any) {
    console.error('Seeding failed:', error.message);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

runSeeder();

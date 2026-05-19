import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import {
  StudentOnboarding,
  StudentOnboardingSchema,
  RegistrationLink,
  RegistrationLinkSchema,
  Simulation,
  SimulationSchema,
  User,
  UserSchema,
  Enrollment,
  EnrollmentSchema,
} from '../../entities/index.entity';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: StudentOnboarding.name, schema: StudentOnboardingSchema },
      { name: RegistrationLink.name, schema: RegistrationLinkSchema },
      { name: Simulation.name, schema: SimulationSchema },
      { name: User.name, schema: UserSchema },
      { name: Enrollment.name, schema: EnrollmentSchema },
    ]),
  ],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}

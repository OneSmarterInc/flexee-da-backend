import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { jwtSecret } from '../../config/jwt-secret';
import {
  User,
  UserSchema,
  Enrollment,
  EnrollmentSchema,
  Simulation,
  SimulationSchema,
} from '../../entities/index.entity';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        // Refuses to start without a real secret (V3 F2).
        const secret = jwtSecret({
          JWT_SECRET: configService.get<string>('JWT_SECRET'),
        });
        const expiresIn = configService.get<string>('JWT_EXPIRY') || '24h';

        return {
          secret,
          signOptions: {
            expiresIn: expiresIn as any, // Cast to bypass type checking
          },
        };
      },
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Enrollment.name, schema: EnrollmentSchema },
      { name: Simulation.name, schema: SimulationSchema },
    ]),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, LocalStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}

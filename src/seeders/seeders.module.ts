import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserSeeder } from './user.seeder';
import { User, UserSchema } from '../entities/index.entity';

@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])],
  providers: [UserSeeder],
  exports: [UserSeeder],
})
export class SeedersModule {}
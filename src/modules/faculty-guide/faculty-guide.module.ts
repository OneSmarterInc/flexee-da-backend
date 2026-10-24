import { Module } from '@nestjs/common';
import { FacultyGuideController } from './faculty-guide.controller';

@Module({ controllers: [FacultyGuideController] })
export class FacultyGuideModule {}

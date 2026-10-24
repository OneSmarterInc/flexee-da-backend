import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@/entities/index.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { FACULTY_GUIDE } from '../ai/faculty-guide';

@ApiTags('Faculty guide')
@Controller('faculty-guide')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class FacultyGuideController {
  @Get()
  @Roles(UserRole.FACULTY, UserRole.ADMIN)
  @Header('Content-Type', 'text/markdown; charset=utf-8')
  @ApiOperation({ summary: 'The faculty guide, as Markdown (faculty and admin only)' })
  get(): string {
    return FACULTY_GUIDE;
  }
}

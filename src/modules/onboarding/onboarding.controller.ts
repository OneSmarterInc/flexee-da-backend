import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Req,
  Response,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../entities/index.entity';
import { OnboardingService } from './onboarding.service';
import {
  InviteStudentDto,
  BulkInviteDto,
  BulkInviteResponseDto,
  ExcelImportDto,
  ExcelImportResponseDto,
  AcceptInviteDto,
  AcceptInviteResponseDto,
} from './dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Student Onboarding')
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  /**
   * Send invite to single student
   */
  @Post('invite')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.FACULTY, UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Invite a single student to a simulation' })
  @ApiResponse({ status: 201, description: 'Invite sent successfully' })
  async inviteStudent(
    @Body() dto: InviteStudentDto,
    @CurrentUser() facultyUser: any,
  ) {
    return this.onboardingService.inviteStudent(dto, facultyUser);
  }

  /**
   * Send bulk invites to multiple students
   */
  @Post('bulk-invite')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.FACULTY, UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Send invites to multiple students' })
  @ApiResponse({
    status: 201,
    description: 'Bulk invites processed',
    type: BulkInviteResponseDto,
  })
  async bulkInviteStudents(
    @Body() dto: BulkInviteDto,
    @CurrentUser() facultyUser: any,
  ): Promise<BulkInviteResponseDto> {
    return this.onboardingService.bulkInviteStudents(dto, facultyUser);
  }

  /**
   * Import students from Excel file
   */
  @Post('import-excel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.FACULTY, UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Bulk invite students from Excel file' })
  @ApiResponse({
    status: 201,
    description: 'Excel file processed',
    type: ExcelImportResponseDto,
  })
  async importFromExcel(
    @UploadedFile() file: any,
    @Body() dto: ExcelImportDto,
    @CurrentUser() facultyUser: any,
  ): Promise<ExcelImportResponseDto> {
    if (!file || !file.mimetype.includes('sheet')) {
      throw new BadRequestException(
        'Invalid file format. Please upload an Excel file.',
      );
    }

    return this.onboardingService.importFromExcel(file, dto, facultyUser);
  }

  /**
   * Accept invite and create user
   */
  @Post('accept')
  @ApiOperation({ summary: 'Accept invitation to join simulation' })
  @ApiResponse({
    status: 201,
    description: 'Invite accepted, user created/linked',
    type: AcceptInviteResponseDto,
  })
  async acceptInvite(
    @Body() dto: AcceptInviteDto,
  ): Promise<AcceptInviteResponseDto> {
    return this.onboardingService.acceptInvite(dto);
  }

  /**
   * Get invite details (before accepting)
   */
  @Get('invite/:inviteToken')
  @ApiOperation({ summary: 'Get details of an invitation' })
  @ApiResponse({ status: 200, description: 'Invite details' })
  async getInviteDetails(@Param('inviteToken') inviteToken: string) {
    return this.onboardingService.getInviteDetails(inviteToken);
  }

  /**
   * Get all invites for a simulation
   */
  @Get('simulation/:simulationId/invites')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.FACULTY, UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get all student invites for a simulation' })
  @ApiResponse({ status: 200, description: 'List of invites' })
  async getSimulationInvites(
    @Param('simulationId') simulationId: string,
    @CurrentUser() facultyUser: any,
  ) {
    return this.onboardingService.getSimulationInvites(
      simulationId,
      facultyUser,
    );
  }

  /**
   * Resend invite to student
   */
  @Post('resend/:inviteId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.FACULTY, UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Resend invitation email to student' })
  @ApiResponse({ status: 200, description: 'Invite resent successfully' })
  async resendInvite(
    @Param('inviteId') inviteId: string,
    @CurrentUser() facultyUser: any,
  ) {
    return this.onboardingService.resendInvite(inviteId, facultyUser);
  }

  /**
   * Download Excel template for bulk import
   */
  @Get('download-template')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.FACULTY, UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Download sample Excel template for bulk student import',
  })
  @ApiResponse({
    status: 200,
    description: 'Excel template file',
  })
  async downloadTemplate(@Response() res: any) {
    const buffer = this.onboardingService.generateExcelTemplate();

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="student-invites-template.xlsx"',
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }
}

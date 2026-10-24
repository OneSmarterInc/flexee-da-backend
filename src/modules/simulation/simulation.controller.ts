// src/modules/simulation/simulation.controller.ts
// FLEXEE 2.0 Supply Chain Simulation Controller - With Advanced Module Endpoints

import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiForbiddenResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CreateSimulationDto } from './dto/create-simulation.dto';
import { UpdateSimulationDto } from './dto/update-simulation.dto';
import { EnrollStudentsDto } from './dto/enroll-students.dto';
import { TriggerEventDto } from './dto/trigger-event.dto';
import { UpdateFeaturesDto } from './dto/update-features.dto';
import { QuarterDataVisibilityDto } from './dto/quarter-data-visibility.dto';
import { BulkDeleteEnrollmentsDto, DeleteEnrollmentResponseDto } from './dto/delete-enrollments.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@/entities/index.entity';
import { SimulationService } from './simulation.service';

@ApiTags('Simulations')
@Controller('simulations')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class SimulationController {
  constructor(private simulationService: SimulationService) {}

  // ============================================================================
  // SIMULATION CRUD
  // ============================================================================

  @Post()
  @Roles(UserRole.ADMIN, UserRole.FACULTY)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new simulation',
    description:
      'Creates simulation with firms, initializes Q0, pre-seeds Q1-Q3. Advanced modules enabled via feature toggles.',
  })
  @ApiResponse({
    status: 201,
    description: 'Simulation created and initialized to Q3',
  })
  @ApiForbiddenResponse({
    description: 'Only admins and faculty can create simulations',
  })
  async create(
    @Req() req: any,
    @Body() createSimulationDto: CreateSimulationDto,
  ) {
    return this.simulationService.create(req.user._id, createSimulationDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all simulations for current user',
    description:
      'Admins see all, Faculty see owned/assigned, Students see enrolled.',
  })
  @ApiResponse({
    status: 200,
    description: 'Simulations retrieved successfully',
  })
  async findAll(@Req() req: any) {
    return this.simulationService.findAllByUser(req.user._id);
  }

  @Get('faculty/:facultyId')
  @ApiOperation({ summary: 'Get simulations by faculty' })
  @ApiParam({ name: 'facultyId', description: 'Faculty user ObjectId' })
  @ApiResponse({
    status: 200,
    description: 'Simulations retrieved successfully',
  })
  async findByFaculty(@Param('facultyId') facultyId: string) {
    return this.simulationService.findSimulationsByFaculty(facultyId);
  }

  @Get('student/:studentId')
  @ApiOperation({ summary: 'Get simulations by student enrollment' })
  @ApiParam({ name: 'studentId', description: 'Student user ObjectId' })
  @ApiResponse({
    status: 200,
    description: 'Simulations retrieved successfully',
  })
  async findByStudent(@Param('studentId') studentId: string) {
    return this.simulationService.findSimulationsByStudent(studentId);
  }

  @Get(':simulationId')
  @ApiOperation({ summary: 'Get simulation by ID with full details' })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiResponse({
    status: 200,
    description: 'Simulation retrieved successfully',
  })
  async findOne(@Param('simulationId') simulationId: string) {
    return this.simulationService.findOne(simulationId);
  }

  @Patch(':simulationId')
  @Roles(UserRole.ADMIN, UserRole.FACULTY)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update simulation settings or status' })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiResponse({ status: 200, description: 'Simulation updated successfully' })
  @ApiForbiddenResponse({
    description: 'Only admins and faculty can update simulations',
  })
  async update(
    @Param('simulationId') simulationId: string,
    @Body() updateSimulationDto: UpdateSimulationDto,
  ) {
    return this.simulationService.update(simulationId, updateSimulationDto);
  }

  @Delete(':simulationId')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete simulation and all related data' })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiResponse({ status: 200, description: 'Simulation deleted successfully' })
  @ApiForbiddenResponse({ description: 'Only admins can delete simulations' })
  async delete(@Param('simulationId') simulationId: string) {
    return this.simulationService.delete(simulationId);
  }

  // ============================================================================
  // QUARTER DATA & PROGRESSION
  // ============================================================================

  @Get(':simulationId/current-quarter')
  @ApiOperation({
    summary: 'Get current quarter data',
    description:
      'Returns firm states, decisions, KPI trends, demand, events, and advanced module states.',
  })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiResponse({
    status: 200,
    description: 'Quarter data retrieved successfully',
  })
  async getCurrentQuarter(@Param('simulationId') simulationId: string) {
    return this.simulationService.getCurrentQuarterData(simulationId);
  }

  @Get(':simulationId/quarters/:quarterNumber')
  @ApiOperation({
    summary: 'Get specific quarter data',
    description:
      'Returns firm states, decisions, KPIs, demand, and events for a specific quarter.',
  })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiParam({ name: 'quarterNumber', description: 'Quarter number to fetch' })
  @ApiResponse({
    status: 200,
    description: 'Quarter data retrieved successfully',
  })
  async getQuarterByNumber(
    @Param('simulationId') simulationId: string,
    @Param('quarterNumber') quarterNumber: string,
  ) {
    const quarter = parseInt(quarterNumber, 10);
    if (isNaN(quarter)) {
      throw new BadRequestException('Quarter number must be a valid integer');
    }
    return this.simulationService.getQuarterByNumber(simulationId, quarter);
  }

  @Get(':simulationId/quarters')
  @ApiOperation({ summary: 'Get quarter history with demand and KPIs' })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiQuery({
    name: 'fromQuarter',
    required: false,
    description: 'Starting quarter (default: 1)',
  })
  @ApiQuery({
    name: 'toQuarter',
    required: false,
    description: 'Ending quarter (default: current)',
  })
  @ApiResponse({ status: 200, description: 'Quarter history retrieved' })
  async getQuarterHistory(
    @Param('simulationId') simulationId: string,
    @Query('fromQuarter') fromQuarter?: number,
    @Query('toQuarter') toQuarter?: number,
  ) {
    return this.simulationService.getQuarterHistory(
      simulationId,
      fromQuarter,
      toQuarter,
    );
  }

  @Get(':simulationId/demand')
  @ApiOperation({ summary: 'Get market demand history' })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiResponse({ status: 200, description: 'Demand history retrieved' })
  async getDemandHistory(@Param('simulationId') simulationId: string) {
    return this.simulationService.getDemandHistory(simulationId);
  }

  @Get(':simulationId/leaderboard')
  @ApiOperation({ summary: 'Get simulation leaderboard ranked by BSC score' })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiQuery({
    name: 'quarter',
    required: false,
    description: 'Quarter to show (default: current)',
  })
  @ApiResponse({ status: 200, description: 'Leaderboard retrieved' })
  async getLeaderboard(
    @Param('simulationId') simulationId: string,
    @Query('quarter') quarter?: number,
  ) {
    return this.simulationService.getLeaderboard(simulationId, quarter);
  }

  @Get(':simulationId/scrm')
  @ApiOperation({
    summary: 'Get SCRM risk data for a specific quarter',
    description:
      'Returns supply chain risk management data including risk scores, customer metrics, and recommendations for all firms in the specified quarter.',
  })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiQuery({
    name: 'quarter',
    required: true,
    description: 'Quarter number to retrieve SCRM data for',
  })
  @ApiResponse({ status: 200, description: 'SCRM data retrieved successfully' })
  async getSCRMByQuarter(
    @Param('simulationId') simulationId: string,
    @Query('quarter') quarter: number,
  ) {
    if (!quarter || isNaN(quarter)) {
      throw new BadRequestException('Quarter parameter is required and must be a valid number');
    }
    return this.simulationService.getSCRMDataByQuarter(simulationId, quarter);
  }

  @Get(':simulationId/firms/:firmId/scrm-history')
  @ApiOperation({
    summary: 'Get SCRM history for a specific firm',
    description:
      'Returns supply chain risk management data across all quarters for a specific firm.',
  })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiParam({ name: 'firmId', description: 'Firm ObjectId or firmNumber' })
  @ApiResponse({ status: 200, description: 'SCRM history retrieved successfully' })
  async getSCRMHistoryByFirm(
    @Param('simulationId') simulationId: string,
    @Param('firmId') firmId: string,
  ) {
    return this.simulationService.getSCRMHistoryByFirm(simulationId, firmId);
  }

  // ============================================================================
  // ENROLLMENT
  // ============================================================================

  @Post(':simulationId/firms/enroll')
  @Roles(UserRole.ADMIN, UserRole.FACULTY)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Enroll students in a firm' })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiResponse({ status: 201, description: 'Students enrolled successfully' })
  @ApiForbiddenResponse({
    description: 'Only admins and faculty can enroll students',
  })
  async enrollStudents(
    @Param('simulationId') simulationId: string,
    @Body() enrollStudentsDto: EnrollStudentsDto,
  ) {
    return this.simulationService.enrollStudentsInFirm(
      simulationId,
      enrollStudentsDto,
    );
  }

  @Get(':simulationId/enrollments')
  @ApiOperation({ summary: 'Get all enrollments grouped by firm' })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiResponse({ status: 200, description: 'Enrollments retrieved' })
  async getEnrollments(@Param('simulationId') simulationId: string) {
    return this.simulationService.getSimulationEnrollments(simulationId);
  }

  @Get(':simulationId/faculty')
  @ApiOperation({ summary: 'Get faculty members for a simulation' })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiResponse({ status: 200, description: 'Faculty members retrieved' })
  async getFaculty(@Param('simulationId') simulationId: string) {
    return this.simulationService.getFacultyForSimulation(simulationId);
  }

  @Post(':simulationId/faculty')
  @Roles(UserRole.ADMIN, UserRole.FACULTY)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add faculty member to simulation' })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiResponse({ status: 201, description: 'Faculty member added successfully' })
  @ApiForbiddenResponse({
    description: 'Only admins and faculty can add faculty',
  })
  async addFaculty(
    @Param('simulationId') simulationId: string,
    @Body() body: { email: string },
  ) {
    return this.simulationService.addFacultyToSimulation(simulationId, body.email);
  }

  @Delete(':simulationId/enrollments/:enrollmentId/firm')
  @Roles(UserRole.ADMIN, UserRole.FACULTY)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Unassign a student from their firm (returns them to unplaced pool)',
    description:
      'Removes the firm assignment from an enrollment without deleting the enrollment itself. The student stays enrolled in the simulation but reverts to PENDING status awaiting reassignment. Disallowed if the student has already submitted decisions.',
  })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiParam({ name: 'enrollmentId', description: 'Enrollment ObjectId' })
  @ApiResponse({ status: 200, description: 'Student unassigned from firm' })
  async unassignStudentFromFirm(
    @Param('simulationId') simulationId: string,
    @Param('enrollmentId') enrollmentId: string,
  ) {
    return this.simulationService.unassignStudentFromFirm(
      simulationId,
      enrollmentId,
    );
  }

  @Delete(':simulationId/enrollments/:enrollmentId')
  @Roles(UserRole.ADMIN, UserRole.FACULTY)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a student enrollment from simulation (enrollment only)',
    description:
      'Permanently removes a student enrollment record from the simulation. The student user account remains in the system. This cannot be undone.',
  })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiParam({ name: 'enrollmentId', description: 'Enrollment ObjectId' })
  @ApiResponse({ status: 200, description: 'Student enrollment deleted', type: DeleteEnrollmentResponseDto })
  async deleteEnrollment(
    @Param('simulationId') simulationId: string,
    @Param('enrollmentId') enrollmentId: string,
  ) {
    return this.simulationService.deleteEnrollment(simulationId, enrollmentId);
  }

  @Delete(':simulationId/enrollments/:enrollmentId/with-user')
  @Roles(UserRole.ADMIN, UserRole.FACULTY)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a student enrollment from simulation AND delete the user account',
    description:
      'Permanently removes a student enrollment record from the simulation AND deletes the student user account from the system. This cannot be undone.',
  })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiParam({ name: 'enrollmentId', description: 'Enrollment ObjectId' })
  @ApiResponse({ status: 200, description: 'Student enrollment and user deleted', type: DeleteEnrollmentResponseDto })
  async deleteEnrollmentWithUser(
    @Param('simulationId') simulationId: string,
    @Param('enrollmentId') enrollmentId: string,
  ) {
    return this.simulationService.deleteEnrollmentWithUser(simulationId, enrollmentId);
  }

  @Post(':simulationId/enrollments/bulk-delete')
  @Roles(UserRole.ADMIN, UserRole.FACULTY)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bulk delete multiple student enrollments from simulation (enrollments only)',
    description:
      'Permanently removes multiple student enrollment records from the simulation. Student user accounts remain in the system. This cannot be undone.',
  })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiResponse({ status: 200, description: 'Student enrollments deleted', type: DeleteEnrollmentResponseDto })
  async bulkDeleteEnrollments(
    @Param('simulationId') simulationId: string,
    @Body() dto: BulkDeleteEnrollmentsDto,
  ) {
    return this.simulationService.bulkDeleteEnrollments(simulationId, dto.enrollmentIds);
  }

  @Post(':simulationId/enrollments/bulk-delete-with-users')
  @Roles(UserRole.ADMIN, UserRole.FACULTY)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bulk delete multiple student enrollments AND delete user accounts',
    description:
      'Permanently removes multiple student enrollment records from the simulation AND deletes the student user accounts from the system. This cannot be undone.',
  })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiResponse({ status: 200, description: 'Student enrollments and users deleted', type: DeleteEnrollmentResponseDto })
  async bulkDeleteEnrollmentsWithUsers(
    @Param('simulationId') simulationId: string,
    @Body() dto: BulkDeleteEnrollmentsDto,
  ) {
    return this.simulationService.bulkDeleteEnrollmentsWithUsers(simulationId, dto.enrollmentIds);
  }

  // ============================================================================
  // STUDENT PAYMENT TRACKING (per-student)
  // ============================================================================

  @Post(':simulationId/enrollments/:enrollmentId/mark-paid')
  @Roles(UserRole.ADMIN, UserRole.FACULTY)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark a student as paid for this simulation',
    description: 'Faculty can mark individual students as paid for the simulation',
  })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiParam({ name: 'enrollmentId', description: 'Enrollment ObjectId' })
  @ApiResponse({ status: 200, description: 'Student marked as paid' })
  async markStudentPaid(
    @Param('simulationId') simulationId: string,
    @Param('enrollmentId') enrollmentId: string,
    @Body() body: { notes?: string },
  ) {
    return this.simulationService.markStudentPaid(
      simulationId,
      enrollmentId,
      body.notes,
    );
  }

  @Post(':simulationId/enrollments/:enrollmentId/mark-unpaid')
  @Roles(UserRole.ADMIN, UserRole.FACULTY)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark a student as unpaid for this simulation',
    description: 'Faculty can mark students as unpaid (e.g., reverting a previous paid mark)',
  })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiParam({ name: 'enrollmentId', description: 'Enrollment ObjectId' })
  @ApiResponse({ status: 200, description: 'Student marked as unpaid' })
  async markStudentUnpaid(
    @Param('simulationId') simulationId: string,
    @Param('enrollmentId') enrollmentId: string,
    @Body() body: { notes?: string },
  ) {
    return this.simulationService.markStudentUnpaid(
      simulationId,
      enrollmentId,
      body.notes,
    );
  }

  @Get(':simulationId/enrollments/payment-status')
  @Roles(UserRole.ADMIN, UserRole.FACULTY)
  @ApiOperation({
    summary: 'Get payment status of all students in simulation',
    description: 'Returns list of students with their payment status, grouped by firm or by payment status',
  })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiQuery({ name: 'groupBy', required: false, enum: ['firm', 'payment'], description: 'Group results by firm or payment status' })
  @ApiResponse({ status: 200, description: 'Payment status retrieved' })
  async getStudentPaymentStatus(
    @Param('simulationId') simulationId: string,
    @Query('groupBy') groupBy?: 'firm' | 'payment',
  ) {
    return this.simulationService.getStudentPaymentStatus(simulationId, groupBy);
  }

  @Post(':simulationId/enrollments/mark-all-paid')
  @Roles(UserRole.ADMIN, UserRole.FACULTY)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark all students as paid for this simulation',
    description: 'Faculty can mark all enrolled students as paid in one action',
  })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiResponse({ status: 200, description: 'All students marked as paid' })
  async markAllStudentsPaid(
    @Param('simulationId') simulationId: string,
    @Body() body: { notes?: string },
  ) {
    return this.simulationService.markAllStudentsPaid(simulationId, body.notes);
  }

  @Post(':simulationId/enrollments/mark-all-unpaid')
  @Roles(UserRole.ADMIN, UserRole.FACULTY)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark all students as unpaid for this simulation',
    description: 'Faculty can mark all enrolled students as unpaid in one action (e.g., to reset status)',
  })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiResponse({ status: 200, description: 'All students marked as unpaid' })
  async markAllStudentsUnpaid(
    @Param('simulationId') simulationId: string,
    @Body() body: { notes?: string },
  ) {
    return this.simulationService.markAllStudentsUnpaid(simulationId, body.notes);
  }

  @Get(':simulationId/billing-metrics')
  @Roles(UserRole.ADMIN, UserRole.FACULTY)
  @ApiOperation({
    summary: 'Get billing metrics for a simulation',
    description: 'Returns total billed, received, and pending amounts based on enrollment count and payment status',
  })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiQuery({ name: 'feePerStudent', required: false, description: 'Fee per student in dollars (default: 200)', type: Number })
  @ApiResponse({ status: 200, description: 'Billing metrics retrieved' })
  async getBillingMetrics(
    @Param('simulationId') simulationId: string,
    @Query('feePerStudent') feePerStudent?: number,
  ) {
    return this.simulationService.getBillingMetrics(simulationId, feePerStudent || 200);
  }

  @Post(':simulationId/enrollments/:enrollmentId/extend-payment-date')
  @Roles(UserRole.ADMIN, UserRole.FACULTY)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Extend payment deadline for individual student',
    description: 'Faculty can extend the payment deadline for a specific student by N days',
  })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiParam({ name: 'enrollmentId', description: 'Enrollment ObjectId' })
  @ApiQuery({ name: 'days', required: true, type: Number, description: 'Number of days to extend by (1-60)' })
  @ApiResponse({ status: 200, description: 'Payment deadline extended' })
  async extendStudentPaymentDate(
    @Param('simulationId') simulationId: string,
    @Param('enrollmentId') enrollmentId: string,
    @Query('days') days: number,
    @Body() body: { reason?: string },
  ) {
    if (!days || days <= 0) {
      throw new BadRequestException('Days must be greater than 0');
    }
    return this.simulationService.extendStudentPaymentDate(
      simulationId,
      enrollmentId,
      days,
      body.reason,
    );
  }

  // ============================================================================
  // ENROLLMENT DETAIL & ACCESS CONTROL
  // ============================================================================

  @Get(':id/enrollments/:enrollmentId')
  @Roles(UserRole.FACULTY, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get full student enrollment detail',
    description: 'Retrieve complete enrollment record including payment status, user info, and activity history',
  })
  @ApiParam({ name: 'id', description: 'Simulation ObjectId' })
  @ApiParam({ name: 'enrollmentId', description: 'Enrollment ObjectId' })
  @ApiResponse({ status: 200, description: 'Enrollment detail retrieved successfully' })
  async getEnrollmentDetail(
    @Param('id') simulationId: string,
    @Param('enrollmentId') enrollmentId: string,
  ) {
    return this.simulationService.getEnrollmentDetail(simulationId, enrollmentId);
  }

  @Post(':id/enrollments/:enrollmentId/block')
  @Roles(UserRole.FACULTY, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Block student access to simulation',
    description: 'Set enrollment status to DROPPED, preventing student access while leaving user account intact',
  })
  @ApiParam({ name: 'id', description: 'Simulation ObjectId' })
  @ApiParam({ name: 'enrollmentId', description: 'Enrollment ObjectId' })
  @ApiResponse({ status: 200, description: 'Student access blocked' })
  async blockEnrollment(
    @Param('id') simulationId: string,
    @Param('enrollmentId') enrollmentId: string,
    @Body() body?: { reason?: string },
  ) {
    return this.simulationService.blockEnrollment(simulationId, enrollmentId, body?.reason);
  }

  @Post(':id/enrollments/:enrollmentId/unblock')
  @Roles(UserRole.FACULTY, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Restore student access to simulation',
    description: 'Set enrollment status back to ACTIVE, restoring student access',
  })
  @ApiParam({ name: 'id', description: 'Simulation ObjectId' })
  @ApiParam({ name: 'enrollmentId', description: 'Enrollment ObjectId' })
  @ApiResponse({ status: 200, description: 'Student access restored' })
  async unblockEnrollment(
    @Param('id') simulationId: string,
    @Param('enrollmentId') enrollmentId: string,
  ) {
    return this.simulationService.unblockEnrollment(simulationId, enrollmentId);
  }

  @Post(':id/enrollments/:enrollmentId/reset-password')
  @Roles(UserRole.FACULTY, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset student password',
    description: 'Generate a temporary password and return it once. Faculty shares with student through their own channel.',
  })
  @ApiParam({ name: 'id', description: 'Simulation ObjectId' })
  @ApiParam({ name: 'enrollmentId', description: 'Enrollment ObjectId' })
  @ApiResponse({ status: 200, description: 'Password reset successful, temporary password returned' })
  async resetEnrollmentPassword(
    @Param('id') simulationId: string,
    @Param('enrollmentId') enrollmentId: string,
  ) {
    return this.simulationService.resetEnrollmentPassword(simulationId, enrollmentId);
  }

  // ============================================================================
  // ACCESS CONTROL — check if student can view this simulation
  // ============================================================================

  @Get(':simulationId/my-access')
  @ApiOperation({ summary: "Get the current user's access status for this sim" })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiResponse({ status: 200, description: 'Access status returned' })
  async getMyAccess(
    @Param('simulationId') simulationId: string,
    @Req() req: any,
  ) {
    // req.user comes from your JWT guard. Adjust the field name (sub, id, _id)
    // to whatever your guard puts on the request object.
    const userId = req.user?._id || req.user?.id || req.user?.sub;
    return this.simulationService.getMyAccessToSimulation(simulationId, userId);
  }

  // ============================================================================
  // DEPLOYMENT ENDPOINTS
  // ============================================================================

  // ============================================================================
  // PRACTICE COURSES (V3 Design E)
  // ============================================================================

  @Get(':simulationId/this-week')
  @Roles(UserRole.FACULTY, UserRole.ADMIN)
  @ApiOperation({
    summary: 'The weekly work: the open quarter, its close time and each firm\'s submission status',
  })
  async getThisWeek(@Param('simulationId') simulationId: string, @Req() req: any) {
    return this.simulationService.getThisWeek(req.user, simulationId);
  }

  @Post(':simulationId/practice')
  @Roles(UserRole.FACULTY, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Practise this course',
    description:
      'Creates a practice copy of the course: the same schedule, one firm for you and the three reference firms as competitors. No deadlines.',
  })
  async createPractice(@Param('simulationId') simulationId: string, @Req() req: any) {
    return this.simulationService.createPractice(req.user, simulationId);
  }

  @Post(':simulationId/practice/reset')
  @Roles(UserRole.FACULTY, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start a practice course over from Quarter 4' })
  async resetPractice(@Param('simulationId') simulationId: string, @Req() req: any) {
    return this.simulationService.resetPractice(req.user, simulationId);
  }

  @Post(':simulationId/deploy')
  @Roles(UserRole.FACULTY, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Deploy simulation for Faculty or Student',
    description: 'Two-stage deployment: (1) Admin deploys for faculty, (2) Faculty deploys for students. Requires payment to be made and firms allocated.',
  })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiResponse({ status: 200, description: 'Simulation deployed successfully' })
  @ApiForbiddenResponse({ description: 'Only faculty and admins can deploy simulations' })
  async deploySimulation(
    @Param('simulationId') simulationId: string,
    @Body() body?: { deploymentType?: 'faculty' | 'student' },
  ) {
    const deploymentType = body?.deploymentType || 'faculty';
    return this.simulationService.deploySimulation(simulationId, deploymentType);
  }

  // ============================================================================
  // FIRM ENDPOINTS
  // ============================================================================


  @Get(':simulationId/firms/:firmId')
  @ApiOperation({
    summary: 'Get firm details with current state and enrollments',
  })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiParam({ name: 'firmId', description: 'Firm ObjectId or firmNumber' })
  @ApiResponse({ status: 200, description: 'Firm details retrieved' })
  async getFirmDetails(
    @Param('simulationId') simulationId: string,
    @Param('firmId') firmId: string,
  ) {
    return this.simulationService.getFirmDetails(simulationId, firmId);
  }

  @Get(':simulationId/firms/:firmId/kpis')
  @ApiOperation({ summary: 'Get firm KPI history' })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiParam({ name: 'firmId', description: 'Firm ObjectId or firmNumber' })
  @ApiQuery({
    name: 'quarters',
    required: false,
    description: 'Number of quarters to return',
  })
  @ApiResponse({ status: 200, description: 'KPI history retrieved' })
  async getFirmKpiHistory(
    @Param('simulationId') simulationId: string,
    @Param('firmId') firmId: string,
    @Query('quarters') quarters?: number,
  ) {
    return this.simulationService.getFirmKpiHistory(
      simulationId,
      firmId,
      quarters,
    );
  }

  @Get(':simulationId/firms/:firmId/credit-history')
  @ApiOperation({ summary: 'Get credit facility history for a firm' })
  async getCreditHistory(
    @Param('simulationId') simulationId: string,
    @Param('firmId') firmId: string,
    @Query('quarters') quarters?: number,
  ): Promise<any> {
    return this.simulationService.getCreditHistory(
      simulationId,
      firmId,
      quarters,
    );
  }

  @Get(':simulationId/firms/:firmId/states')
  @ApiOperation({ summary: 'Get firm quarter state history' })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiParam({ name: 'firmId', description: 'Firm ObjectId or firmNumber' })
  @ApiResponse({ status: 200, description: 'State history retrieved' })
  async getFirmStateHistory(
    @Param('simulationId') simulationId: string,
    @Param('firmId') firmId: string,
  ) {
    return this.simulationService.getFirmStateHistory(simulationId, firmId);
  }

  // ============================================================================
  // ADVANCED MODULE ENDPOINTS
  // ============================================================================

  @Get(':simulationId/firms/:firmId/warranty-claims')
  @ApiOperation({
    summary: 'Get warranty claims history',
    description:
      'Returns warranty claim records (requires returnsGreenScore feature enabled).',
  })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiParam({ name: 'firmId', description: 'Firm ObjectId or firmNumber' })
  @ApiResponse({ status: 200, description: 'Warranty claims retrieved' })
  async getWarrantyClaims(
    @Param('simulationId') simulationId: string,
    @Param('firmId') firmId: string,
  ) {
    return this.simulationService.getWarrantyClaimsHistory(
      simulationId,
      firmId,
    );
  }

  @Get(':simulationId/firms/:firmId/green-score')
  @ApiOperation({
    summary: 'Get green score history',
    description:
      'Returns green score tracking (requires returnsGreenScore feature enabled).',
  })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiParam({ name: 'firmId', description: 'Firm ObjectId or firmNumber' })
  @ApiResponse({ status: 200, description: 'Green score history retrieved' })
  async getGreenScoreHistory(
    @Param('simulationId') simulationId: string,
    @Param('firmId') firmId: string,
  ) {
    return this.simulationService.getGreenScoreHistory(simulationId, firmId);
  }

  @Get(':simulationId/firms/:firmId/intelligence-reports')
  @ApiOperation({
    summary: 'Get intelligence reports purchased',
    description:
      'Returns intelligence reports (requires intelligenceCenter feature enabled).',
  })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiParam({ name: 'firmId', description: 'Firm ObjectId or firmNumber' })
  @ApiQuery({
    name: 'quarter',
    required: false,
    description: 'Filter by specific quarter',
  })
  @ApiResponse({ status: 200, description: 'Intelligence reports retrieved' })
  async getIntelligenceReports(
    @Param('simulationId') simulationId: string,
    @Param('firmId') firmId: string,
    @Query('quarter') quarter?: number,
  ) {
    return this.simulationService.getIntelligenceReports(
      simulationId,
      firmId,
      quarter,
    );
  }

  // ============================================================================
  // EVENTS
  // ============================================================================

  @Get(':simulationId/events')
  @ApiOperation({ summary: 'Get simulation events' })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiQuery({
    name: 'activeOnly',
    required: false,
    description: 'Return only active events',
  })
  @ApiResponse({ status: 200, description: 'Events retrieved' })
  async getEvents(
    @Param('simulationId') simulationId: string,
    @Query('activeOnly') activeOnly?: boolean,
  ) {
    return this.simulationService.getSimulationEvents(simulationId, activeOnly);
  }

  @Post(':simulationId/events')
  @Roles(UserRole.ADMIN, UserRole.FACULTY)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Trigger a simulation event' })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiResponse({ status: 201, description: 'Event triggered' })
  @ApiForbiddenResponse({
    description: 'Only admins and faculty can trigger events',
  })
  async triggerEvent(
    @Param('simulationId') simulationId: string,
    @Req() req: any,
    @Body() triggerEventDto: TriggerEventDto,
  ) {
    return this.simulationService.triggerEvent(
      simulationId,
      req.user._id,
      triggerEventDto,
    );
  }

  // ============================================================================
  // FEATURE TOGGLES
  // ============================================================================

  @Patch(':simulationId/features')
  @Roles(UserRole.ADMIN, UserRole.FACULTY)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update feature toggles',
    description:
      'Enable or disable advanced modules. Changes take effect on next quarter.',
  })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiResponse({ status: 200, description: 'Features updated' })
  @ApiForbiddenResponse({
    description: 'Only admins and faculty can update features',
  })
  async updateFeatures(
    @Param('simulationId') simulationId: string,
    @Body() updateFeaturesDto: UpdateFeaturesDto,
  ) {
    return this.simulationService.updateFeatureToggles(
      simulationId,
      updateFeaturesDto,
    );
  }

  // ============================================================================
  // UI CONTROLS - QUARTER DATA VISIBILITY
  // ============================================================================

  @Patch(':simulationId/quarter-data-visibility')
  @Roles(UserRole.ADMIN, UserRole.FACULTY)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set quarter data visibility for UI',
    description:
      'Controls whether quarter data should be displayed on the UI. Faculty can lock/unlock data visibility.',
  })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiResponse({
    status: 200,
    description: 'Quarter data visibility updated',
  })
  @ApiForbiddenResponse({
    description: 'Only admins and faculty can update UI controls',
  })
  async setShowQuarterData(
    @Param('simulationId') simulationId: string,
    @Body() dto: QuarterDataVisibilityDto,
  ) {
    return this.simulationService.setShowQuarterData(
      simulationId,
      dto.showQuarterData,
    );
  }

  @Get(':simulationId/quarter-data-visibility')
  @ApiOperation({ summary: 'Get quarter data visibility status' })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiResponse({
    status: 200,
    description: 'Quarter data visibility status retrieved',
  })
  async getShowQuarterData(@Param('simulationId') simulationId: string) {
    return this.simulationService.getQuarterDataVisibility(simulationId);
  }

  // ============================================================================
  // ACCESS CONTROL
  // ============================================================================

  @Get(':simulationId/access')
  @ApiOperation({ summary: 'Check user access to simulation' })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiResponse({ status: 200, description: 'Access info retrieved' })
  async checkAccess(
    @Param('simulationId') simulationId: string,
    @Req() req: any,
  ) {
    return this.simulationService.checkUserAccess(req.user._id, simulationId);
  }

  // Add this to simulation.controller.ts, in the QUARTER DATA & PROGRESSION section

  @Post(':simulationId/advance')
  @Roles(UserRole.ADMIN, UserRole.FACULTY)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Advance simulation to next quarter',
    description:
      'Processes all submitted decisions for current quarter and advances to next quarter. Only works if all firms have submitted.',
  })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiResponse({ status: 200, description: 'Quarter advanced successfully' })
  @ApiForbiddenResponse({
    description: 'Only admins and faculty can advance quarters',
  })
  async advanceQuarter(@Param('simulationId') simulationId: string) {
    return this.simulationService.advanceQuarter(simulationId);
  }

  @Post(':simulationId/extend-quarter')
  @Roles(UserRole.ADMIN, UserRole.FACULTY)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Extend a specific quarter deadline',
    description:
      'Faculty can extend an individual quarter by N days. All future quarter deadlines are automatically adjusted.',
  })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiQuery({ name: 'quarter', required: true, type: Number, description: 'Quarter number to extend' })
  @ApiQuery({ name: 'days', required: true, type: Number, description: 'Number of days to extend by (1-60)' })
  @ApiQuery({ name: 'reason', required: false, type: String, description: 'Reason for extension (audit trail)' })
  @ApiResponse({ status: 200, description: 'Quarter extended successfully' })
  @ApiForbiddenResponse({
    description: 'Only admins and faculty can extend quarters',
  })
  async extendQuarter(
    @Param('simulationId') simulationId: string,
    @Query('quarter') quarter: number,
    @Query('days') days: number,
    @Query('reason') reason?: string,
  ) {
    if (!quarter || !days) {
      throw new BadRequestException('quarter and days query parameters are required');
    }
    return this.simulationService.extendQuarter(simulationId, quarter, days, reason);
  }

  // ============================================================================
  // EVENT IMPACT TRACKING - Faculty Dashboard
  // ============================================================================

  @Get(':simulationId/event-impacts')
  @Roles(UserRole.FACULTY, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get all event impacts for simulation',
    description: 'Retrieve event impacts with optional filters for quarter, source, or triggered by',
  })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiQuery({ name: 'quarter', required: false, type: Number })
  @ApiQuery({ name: 'source', required: false, type: String, enum: ['RANDOM', 'FACULTY_TRIGGERED', 'SCENARIO'] })
  @ApiQuery({ name: 'triggeredBy', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Event impacts retrieved' })
  async getEventImpacts(
    @Param('simulationId') simulationId: string,
    @Query('quarter') quarter?: number,
    @Query('source') source?: string,
    @Query('triggeredBy') triggeredBy?: string,
  ) {
    return this.simulationService.getEventImpacts(simulationId, {
      quarter: quarter ? parseInt(quarter as any) : undefined,
      source,
      triggeredBy,
    });
  }

  @Get(':simulationId/faculty-event-summary')
  @Roles(UserRole.FACULTY, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get summary of faculty-triggered events',
    description: 'Dashboard view showing aggregated impact of faculty-triggered events by quarter and type',
  })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiResponse({ status: 200, description: 'Event summary retrieved' })
  async getFacultyEventSummary(@Param('simulationId') simulationId: string) {
    return this.simulationService.getFacultyEventSummary(simulationId);
  }

  @Get('events/:eventId/impacts')
  @Roles(UserRole.FACULTY, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get detailed impacts of a specific event',
    description: 'View how a single event impacted each firm in the simulation',
  })
  @ApiParam({ name: 'eventId', description: 'Event ObjectId' })
  @ApiResponse({ status: 200, description: 'Event impact details retrieved' })
  async getEventImpactDetails(@Param('eventId') eventId: string) {
    return this.simulationService.getEventImpactDetails(eventId);
  }

  // ============================================================================
  // DC STATUS AND CARRIER ANALYSIS
  // ============================================================================

  @Get(':simulationId/dc-status')
  @Roles(UserRole.FACULTY, UserRole.ADMIN, UserRole.STUDENT)
  @ApiOperation({
    summary: 'Get DC status for all firms',
    description: 'Retrieve detailed distribution center inventory, utilization, and operational expenses for all firms',
  })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiQuery({ name: 'quarter', required: false, type: Number, description: 'Specific quarter (defaults to current)' })
  @ApiResponse({ status: 200, description: 'DC status retrieved successfully' })
  async getDCStatus(
    @Param('simulationId') simulationId: string,
    @Query('quarter') quarter?: string,
  ) {
    return this.simulationService.getDCStatus(
      simulationId,
      quarter ? parseInt(quarter) : undefined,
    );
  }

  @Get(':simulationId/carrier-analysis')
  @Roles(UserRole.FACULTY, UserRole.ADMIN, UserRole.STUDENT)
  @ApiOperation({
    summary: 'Get carrier selection and analysis for all firms',
    description: 'Retrieve carrier mode selection, costs, discounts, and on-time performance metrics for all firms',
  })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiQuery({ name: 'quarter', required: false, type: Number, description: 'Specific quarter (defaults to current)' })
  @ApiResponse({ status: 200, description: 'Carrier analysis retrieved successfully' })
  async getCarrierAnalysis(
    @Param('simulationId') simulationId: string,
    @Query('quarter') quarter?: string,
  ) {
    return this.simulationService.getCarrierAnalysis(
      simulationId,
      quarter ? parseInt(quarter) : undefined,
    );
  }

  // ============================================================================
  // ANALYTICS DASHBOARD
  // ============================================================================

  @Get(':simulationId/firms/:firmId/analytics-dashboard')
  @Roles(UserRole.FACULTY, UserRole.ADMIN, UserRole.STUDENT)
  @ApiOperation({
    summary: 'Get analytics dashboard for a firm',
    description:
      'Retrieve comprehensive KPI analytics, financial metrics, customer insights, operations metrics, and trend data. Requires ANALYTICS technology purchase.',
  })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiParam({ name: 'firmId', description: 'Firm ObjectId or firmNumber' })
  @ApiQuery({
    name: 'quarter',
    required: false,
    type: Number,
    description: 'Specific quarter (defaults to current)',
  })
  @ApiResponse({ status: 200, description: 'Analytics dashboard retrieved successfully' })
  async getAnalyticsDashboard(
    @Param('simulationId') simulationId: string,
    @Param('firmId') firmId: string,
    @Query('quarter') quarter?: string,
  ) {
    return this.simulationService.getAnalyticsDashboard(
      simulationId,
      firmId,
      quarter ? parseInt(quarter) : undefined,
    );
  }

  // ============================================================================
  // BALANCED SCORECARD
  // ============================================================================

  @Get(':simulationId/balanced-scorecard')
  @Roles(UserRole.FACULTY, UserRole.ADMIN, UserRole.STUDENT)
  @ApiOperation({
    summary: 'Get balanced scorecard for all firms',
    description:
      'Retrieve comprehensive balanced scorecard (BSC) with four-perspective scoring: Financial, Customer, Process, and Learning & Growth. Includes scores, outcome, rankings, and trend thresholds.',
  })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiQuery({
    name: 'quarter',
    required: false,
    type: Number,
    description: 'Specific quarter (defaults to current)',
  })
  @ApiResponse({ status: 200, description: 'Balanced scorecard retrieved successfully' })
  async getBalancedScorecard(
    @Param('simulationId') simulationId: string,
    @Query('quarter') quarter?: string,
  ) {
    return this.simulationService.getBalancedScorecard(
      simulationId,
      quarter ? parseInt(quarter) : undefined,
    );
  }

  // ============================================================================
  // SOP DASHBOARD
  // ============================================================================

  @Get(':simulationId/firms/:firmId/sop-dashboard')
  @Roles(UserRole.FACULTY, UserRole.ADMIN, UserRole.STUDENT)
  @ApiOperation({
    summary: 'Get Statement of Plans (SOP) dashboard for a firm',
    description:
      'Retrieve comprehensive SOP data: demand outlook, forecast accuracy, supply plan, inventory position, key metrics, quality details, logistics, and operational alerts.',
  })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiParam({ name: 'firmId', description: 'Firm ObjectId or firmNumber' })
  @ApiQuery({
    name: 'quarter',
    required: false,
    type: Number,
    description: 'Specific quarter (defaults to current)',
  })
  @ApiResponse({ status: 200, description: 'SOP dashboard retrieved successfully' })
  async getSOPDashboard(
    @Param('simulationId') simulationId: string,
    @Param('firmId') firmId: string,
    @Query('quarter') quarter?: string,
  ) {
    return this.simulationService.getSOPDashboard(
      simulationId,
      firmId,
      quarter ? parseInt(quarter) : undefined,
    );
  }

  // ============================================================================
  // ANALYTICS MODE - DATA PACKAGES & ACCURACY TRACKING
  // ============================================================================

  @Get(':simulationId/workbench')
  @Roles(UserRole.ADMIN, UserRole.FACULTY, UserRole.STUDENT)
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Get Analytics Workbench module status',
    description:
      'Returns the six analytics modules with backend-derived unlock status and download URLs.',
  })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiResponse({ status: 200, description: 'Workbench retrieved' })
  async getWorkbench(
    @Param('simulationId') simulationId: string,
    @Req() req: any,
  ) {
    return this.simulationService.getWorkbench(simulationId, req.user._id);
  }

  @Get(':simulationId/analytics/:moduleId/data')
  @Roles(UserRole.ADMIN, UserRole.FACULTY, UserRole.STUDENT)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Download Analytics Workbench CSV data package' })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiParam({ name: 'moduleId', description: 'Module ID: ds, sa, ci, nd, pi, or me' })
  @ApiResponse({ status: 200, description: 'CSV file downloaded successfully' })
  async downloadWorkbenchData(
    @Param('simulationId') simulationId: string,
    @Param('moduleId') moduleId: string,
    @Req() req: any,
    @Res() res: any,
  ) {
    const file = await this.simulationService.getWorkbenchAsset(
      simulationId,
      req.user._id,
      moduleId,
      'data',
    );
    res.header('Content-Type', file.contentType);
    res.header('Content-Length', file.buffer.length);
    res.header('Content-Disposition', `attachment; filename="${file.fileName}"`);
    return res.send(file.buffer);
  }

  @Get(':simulationId/analytics/:moduleId/assignment')
  @Roles(UserRole.ADMIN, UserRole.FACULTY, UserRole.STUDENT)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Download Analytics Workbench assignment document' })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiParam({ name: 'moduleId', description: 'Module ID: ds, sa, ci, nd, pi, or me' })
  @ApiResponse({ status: 200, description: 'DOCX file downloaded successfully' })
  async downloadWorkbenchAssignment(
    @Param('simulationId') simulationId: string,
    @Param('moduleId') moduleId: string,
    @Req() req: any,
    @Res() res: any,
  ) {
    const file = await this.simulationService.getWorkbenchAsset(
      simulationId,
      req.user._id,
      moduleId,
      'assignment',
    );
    res.header('Content-Type', file.contentType);
    res.header('Content-Length', file.buffer.length);
    res.header('Content-Disposition', `attachment; filename="${file.fileName}"`);
    return res.send(file.buffer);
  }

  @Get(':simulationId/module-schedule')
  @Roles(UserRole.ADMIN, UserRole.FACULTY, UserRole.STUDENT)
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Get module schedule with per-module unlock state',
    description:
      "Returns the simulation's module schedule plus a derived isUnlocked boolean per module based on currentQuarter. Used by the student cockpit to render locked/unlocked module cards.",
  })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiResponse({ status: 200, description: 'Schedule retrieved' })
  async getModuleSchedule(@Param('simulationId') simulationId: string) {
    return this.simulationService.getModuleScheduleWithState(simulationId);
  }

  @Get(':simulationId/firms/:firmId/current-forecast')
  @Roles(UserRole.ADMIN, UserRole.FACULTY, UserRole.STUDENT)
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Get the current forecast used for a firm',
    description:
      'Returns the current-quarter forecast values and whether they are read-only baseline values while Demand Science is locked.',
  })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiParam({ name: 'firmId', description: 'Firm ObjectId or firmNumber' })
  @ApiResponse({ status: 200, description: 'Current forecast retrieved' })
  async getCurrentForecast(
    @Param('simulationId') simulationId: string,
    @Param('firmId') firmId: string,
  ) {
    return this.simulationService.getCurrentForecast(simulationId, firmId);
  }

  @Get(':simulationId/firms/:firmId/forecast-accuracy-trend')
  @Roles(UserRole.ADMIN, UserRole.FACULTY, UserRole.STUDENT)
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Get forecast accuracy trend by GUT vs MODEL',
    description:
      'Returns forecast accuracy metrics (MAPE, accuracy) split by forecast method (GUT vs MODEL) across quarters',
  })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiParam({ name: 'firmId', description: 'Firm ObjectId or firmNumber' })
  @ApiResponse({
    status: 200,
    description: 'Forecast accuracy trend retrieved successfully',
  })
  async getForecastAccuracyTrend(
    @Param('simulationId') simulationId: string,
    @Param('firmId') firmId: string,
    @Req() req: any,
  ) {
    return this.simulationService.getForecastAccuracyTrend(
      simulationId,
      firmId,
      req.user._id,
    );
  }

  // ============================================================================
  // TEST TEAM PROVISIONING
  // ============================================================================

  /**
   * Provision a complete test cohort for this simulation.
   *
   * Creates (or reuses) mailinator-domain student accounts and enrolls them
   * into firms in round-robin order. Intended strictly for faculty/admin
   * testing before real students are invited. Idempotent.
   *
   * Pool model: test users are GLOBAL — emails are test-1@mailinator.com,
   * test-2@mailinator.com, etc. The pool grows on demand and is shared
   * across all simulations.
   *
   * Body:
   *   - studentsPerFirm (number, optional, default 2): how many students to
   *     place in each firm. Must be >= 1 and <= 10.
   *
   * Returns:
   *   { simulationId, firmsAllocated, studentsCreated, studentsReused,
   *     studentsNewlyEnrolled, totalEnrolled, password, students: [...],
   *     enrollmentDetails: [...], message }
   */
  @Post(':simulationId/setup-test-team')
  @Roles(UserRole.ADMIN, UserRole.FACULTY)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '[TEST] Provision mailinator test students and enroll into firms',
    description: 'Creates test-N@mailinator.com accounts (global pool) and round-robin enrolls them. For faculty/admin testing only.',
  })
  @ApiParam({ name: 'simulationId', description: 'Simulation ObjectId' })
  @ApiResponse({ status: 201, description: 'Test team provisioned' })
  @ApiForbiddenResponse({ description: 'Only admins and faculty can run this' })
  async setupTestTeam(
    @Param('simulationId') simulationId: string,
    @Body() body?: { studentsPerFirm?: number },
  ) {
    const studentsPerFirm = Math.max(1, Math.min(10, body?.studentsPerFirm ?? 2));
    return this.simulationService.setupTestTeam(simulationId, studentsPerFirm);
  }
}

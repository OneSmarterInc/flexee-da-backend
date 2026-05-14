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
      'Retrieve comprehensive balanced scorecard (BSC) with four-perspective scoring: Financial, Customer, Process, and Learning & Growth. Includes scores, grades, rankings, and trend thresholds.',
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
}

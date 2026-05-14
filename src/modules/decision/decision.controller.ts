import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DecisionService } from './decision.service';
import {
  CreateDecisionDto,
  UpdateDecisionDto,
  DecisionResponseDto,
} from './dto/decision.dto';

@ApiTags('Decisions')
@Controller('decisions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
export class DecisionController {
  constructor(private readonly decisionService: DecisionService) {}

  // ============================================================================
  // GET /api/decisions/simulation/:simulationId/firm/:firmId/quarter/:quarter
  // Get complete quarter data for decision cockpit (matches GAS)
  // ============================================================================
  @Get('simulation/:simulationId/firm/:firmId/quarter/:quarter')
  @ApiOperation({
    summary: 'Get decision cockpit data for a specific quarter',
    description: 'Returns firm state, current decision, configurations, and constraints for the Decision Cockpit UI. Matches GAS readCockpit structure.',
  })
  @ApiResponse({ status: 200, description: 'Decision cockpit data retrieved' })
  async getQuarterDecisionData(
    @Param('simulationId') simulationId: string,
    @Param('firmId') firmId: string,
    @Param('quarter') quarter: string,
  ): Promise<any> {
    const quarterNum = parseInt(quarter, 10);
    return this.decisionService.getQuarterDecisionData(
      simulationId,
      firmId,
      quarterNum,
    );
  }

  // ============================================================================
  // GET /api/decisions/firm/:firmId/quarter/:quarter
  // Get or create decision for a specific quarter
  // ============================================================================
  @Get('firm/:firmId/quarter/:quarter')
  @ApiOperation({
    summary: 'Get or create decision for a quarter',
    description: 'Returns decision with defaults from previous quarter if not exists.',
  })
  @ApiResponse({ status: 200, description: 'Decision retrieved or created' })
  async getOrCreateForQuarter(
    @Param('firmId') firmId: string,
    @Param('quarter') quarter: string,
    @Query('simulationId') simulationId: string,
  ): Promise<DecisionResponseDto> {
    const quarterNum = parseInt(quarter, 10);
    return this.decisionService.getOrCreateForQuarter(
      simulationId,
      firmId,
      quarterNum,
    );
  }

  // ============================================================================
  // GET /api/decisions/firm/:firmId/state
  // Get current firm state for Decision Cockpit UI
  // ============================================================================
  @Get('firm/:firmId/state')
  @ApiOperation({
    summary: 'Get current firm state',
    description: 'Returns latest firm financial and operational state.',
  })
  @ApiResponse({ status: 200, description: 'Firm state retrieved' })
  async getFirmState(
    @Param('firmId') firmId: string,
  ): Promise<any> {
    return this.decisionService.getFirmState(firmId);
  }

  // ============================================================================
  // GET /api/decisions/:id
  // Get decision by ID
  // ============================================================================
  @Get(':id')
  @ApiOperation({
    summary: 'Get decision by ID',
    description: 'Returns complete decision details.',
  })
  @ApiResponse({ status: 200, description: 'Decision retrieved' })
  async findById(@Param('id') id: string): Promise<DecisionResponseDto> {
    return this.decisionService.findById(id);
  }

  // ============================================================================
  // POST /api/decisions
  // Create new decision (draft)
  // ============================================================================
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create new decision',
    description: 'Creates a new draft decision for a firm/quarter.',
  })
  @ApiResponse({ status: 201, description: 'Decision created' })
  async create(@Body() dto: CreateDecisionDto): Promise<DecisionResponseDto> {
    return this.decisionService.create(dto);
  }

  // ============================================================================
  // PUT /api/decisions/:id
  // Update decision (draft only)
  // ============================================================================
  @Put(':id')
  @ApiOperation({
    summary: 'Update decision',
    description: 'Updates a draft decision. Cannot update submitted decisions.',
  })
  @ApiResponse({ status: 200, description: 'Decision updated' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDecisionDto,
  ): Promise<DecisionResponseDto> {
    return this.decisionService.update(id, dto);
  }

  // ============================================================================
  // POST /api/decisions/:id/submit
  // Submit decision for processing (matches GAS submitDecisions)
  // ============================================================================
  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit decision for quarter processing',
    description: 'Submits decision and validates constraints. Matches GAS submitDecisions flow.',
  })
  @ApiResponse({ status: 200, description: 'Decision submitted' })
  async submit(
    @Param('id') id: string,
    @Query('userId') userId?: string,
    @Req() req?: any,
  ): Promise<DecisionResponseDto> {
    const submittedBy = userId || req?.user?._id;
    return this.decisionService.submit(id, submittedBy);
  }

  // ============================================================================
  // GET /api/decisions/simulation/:simulationId/submitted
  // Check if all decisions for a quarter are submitted
  // ============================================================================
  @Get('simulation/:simulationId/submitted')
  @ApiOperation({
    summary: 'Check submission status',
    description: 'Returns submission status for all firms in simulation.',
  })
  @ApiResponse({ status: 200, description: 'Submission status retrieved' })
  async getSubmissionStatus(
    @Param('simulationId') simulationId: string,
    @Query('quarter') quarter?: string,
  ): Promise<any> {
    const quarterNum = quarter ? parseInt(quarter, 10) : undefined;
    return this.decisionService.getSubmissionStatus(simulationId, quarterNum);
  }
}
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Simulation,
  SimulationDocument,
  UserRole,
} from '../../entities/index.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { assertCourseAccess } from '../simulation/course-access';
import { AiSwitchDto, AskQuestionDto } from './ask-claude.dto';
import { AskClaudeService, AskRefused } from './ask-claude.service';

/** What is on screen, kept small: at most 10 entries, keys up to 60 and values up to 200 characters, strings only. */
export function cleanDetails(details: unknown): Record<string, string> {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return {};
  return Object.fromEntries(
    Object.entries(details as Record<string, unknown>)
      .filter(([, v]) => typeof v === 'string')
      .slice(0, 10)
      .map(([k, v]) => [k.slice(0, 60), (v as string).slice(0, 200)]),
  );
}

/** Ask Claude on every faculty course page, for the course's faculty and admins. */
@ApiTags('Ask Claude')
@Controller('simulations/:id')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class AskClaudeController {
  constructor(
    private readonly ask: AskClaudeService,
    @InjectModel(Simulation.name)
    private readonly simulations: Model<SimulationDocument>,
  ) {}

  private async course(id: string, user: any) {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException('Simulation not found');
    const sim = await this.simulations.findById(id);
    if (!sim) throw new NotFoundException('Simulation not found');
    assertCourseAccess(user, sim);
    return sim;
  }

  /** What the panel needs before a question: the state, the switch and the questions left this month. */
  @Roles(UserRole.ADMIN, UserRole.FACULTY)
  @Get('ask')
  async status(@Param('id') id: string, @Req() req: any) {
    const sim = await this.course(id, req.user);
    return {
      state: await this.ask.state(sim),
      enabled: sim.aiEnabled !== false,
      questionsLeft: await this.ask.questionsLeft(
        sim._id as Types.ObjectId,
        sim,
      ),
      allowance: this.ask.allowance(sim),
    };
  }

  @Roles(UserRole.ADMIN, UserRole.FACULTY)
  @Post('ask')
  @HttpCode(200)
  async question(
    @Param('id') id: string,
    @Body() body: AskQuestionDto,
    @Req() req: any,
  ) {
    const sim = await this.course(id, req.user);
    try {
      return await this.ask.ask({
        userId: String(req.user._id),
        simulation: sim,
        context: { ...body.context, details: cleanDetails(body.context.details) },
        question: body.question,
        conversationId: body.conversationId,
      });
    } catch (error) {
      if (error instanceof AskRefused) {
        if (error.unreachable)
          throw new ServiceUnavailableException(error.message);
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  /** The course's one switch for all AI features. */
  @Roles(UserRole.ADMIN, UserRole.FACULTY)
  @Patch('ai')
  async setSwitch(
    @Param('id') id: string,
    @Body() body: AiSwitchDto,
    @Req() req: any,
  ) {
    const sim = await this.course(id, req.user);
    sim.aiEnabled = body.enabled;
    await sim.save();
    return this.status(id, req);
  }
}

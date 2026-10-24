import {
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Enrollment,
  EnrollmentDocument,
  EnrollmentStatus,
  Simulation,
  SimulationDocument,
  UserRole,
} from '../../entities/index.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { assertCourseAccess } from '../simulation/course-access';
import { NarrativesService } from './narratives.service';

/** Readings, team explanations and the debrief (V3 Design D). */
@ApiTags('Narratives')
@Controller('simulations/:id')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class NarrativesController {
  constructor(
    private readonly narratives: NarrativesService,
    @InjectModel(Simulation.name)
    private readonly simulations: Model<SimulationDocument>,
    @InjectModel(Enrollment.name)
    private readonly enrollments: Model<EnrollmentDocument>,
  ) {}

  private async course(id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException('Simulation not found');
    const sim = await this.simulations.findById(id);
    if (!sim) throw new NotFoundException('Simulation not found');
    return sim;
  }

  /** The firm a student is enrolled in on this course, or null. */
  private async studentFirm(sim: SimulationDocument, user: any) {
    const e = await this.enrollments.findOne({
      simulation: sim._id,
      user: user._id,
      status: EnrollmentStatus.ACTIVE,
      firm: { $ne: null },
    });
    return e?.firm ? String(e.firm) : null;
  }

  /** The quarter readings are for faculty only. */
  @Get('readings')
  @Roles(UserRole.ADMIN, UserRole.FACULTY)
  async readings(@Param('id') id: string, @Req() req: any) {
    const sim = await this.course(id);
    assertCourseAccess(req.user, sim);
    return {
      readings: await this.narratives.readings(sim._id as Types.ObjectId),
    };
  }

  /** Course faculty, or a student enrolled in that firm. */
  @Get('firms/:firmId/explanations')
  async explanations(
    @Param('id') id: string,
    @Param('firmId') firmId: string,
    @Req() req: any,
  ) {
    const sim = await this.course(id);
    if (req.user.role === UserRole.STUDENT) {
      const own = await this.studentFirm(sim, req.user);
      if (!own || own !== firmId)
        throw new ForbiddenException(
          'You can only read your own firm’s explanations.',
        );
      return {
        explanations: await this.narratives.explanations(
          sim._id as Types.ObjectId,
          firmId,
          false,
        ),
      };
    }
    assertCourseAccess(req.user, sim);
    return {
      explanations: await this.narratives.explanations(
        sim._id as Types.ObjectId,
        firmId,
        true,
      ),
    };
  }

  /** Course faculty see every firm; a student sees only their own. */
  @Get('debrief')
  async debrief(@Param('id') id: string, @Req() req: any) {
    const sim = await this.course(id);
    if (req.user.role === UserRole.STUDENT) {
      const own = await this.studentFirm(sim, req.user);
      if (!own)
        throw new ForbiddenException(
          'You do not have access to this simulation.',
        );
      return this.narratives.debrief(sim._id as Types.ObjectId, own, false);
    }
    assertCourseAccess(req.user, sim);
    return this.narratives.debrief(sim._id as Types.ObjectId, null, true);
  }

  /** The student's own enrollment on this course, with the firm they are in. */
  private async ownEnrollment(sim: SimulationDocument, user: any) {
    const e = await this.enrollments.findOne({
      simulation: sim._id,
      user: user._id,
      status: { $in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED] },
      firm: { $ne: null },
    });
    if (!e?.firm)
      throw new ForbiddenException('You are not on a team in this course.');
    return e;
  }

  /** "While you were away": the closed quarters this student has not seen. */
  @Get('catch-up')
  async catchUp(@Param('id') id: string, @Req() req: any) {
    const sim = await this.course(id);
    const e = await this.ownEnrollment(sim, req.user);
    return this.narratives.catchUp(
      sim._id as Types.ObjectId,
      String(e.firm),
      e.lastSeenQuarter ?? null,
    );
  }

  /** "Got it": the student has seen every closed quarter so far. */
  @Post('catch-up/seen')
  @HttpCode(200)
  async seen(@Param('id') id: string, @Req() req: any) {
    const sim = await this.course(id);
    const e = await this.ownEnrollment(sim, req.user);
    const latest = Math.max(0, (sim.currentQuarter ?? 1) - 1);
    e.lastSeenQuarter = Math.max(e.lastSeenQuarter ?? 0, latest);
    await e.save();
    return { lastSeenQuarter: e.lastSeenQuarter };
  }
}

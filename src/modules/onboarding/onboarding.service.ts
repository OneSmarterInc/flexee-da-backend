import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as XLSX from 'xlsx';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import {
  StudentOnboarding,
  StudentOnboardingDocument,
  InviteStatus,
  RegistrationLink,
  RegistrationLinkDocument,
  RegistrationLinkStatus,
  Simulation,
  SimulationDocument,
  User,
  UserDocument,
  UserRole,
  Enrollment,
  EnrollmentDocument,
  EnrollmentStatus,
  EnrollmentRole,
} from '../../entities/index.entity';
import {
  InviteStudentDto,
  BulkInviteDto,
  BulkInviteResponseDto,
  ExcelImportDto,
  ExcelImportResponseDto,
  AcceptInviteDto,
  AcceptInviteResponseDto,
} from './dto';
import { sendStudentInviteEmail } from '../../utils/email.util';

@Injectable()
export class OnboardingService {
  constructor(
    @InjectModel(StudentOnboarding.name)
    private studentOnboardingModel: Model<StudentOnboardingDocument>,
    @InjectModel(RegistrationLink.name)
    private registrationLinkModel: Model<RegistrationLinkDocument>,
    @InjectModel(Simulation.name)
    private simulationModel: Model<SimulationDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @InjectModel(Enrollment.name)
    private enrollmentModel: Model<EnrollmentDocument>,
  ) {}

  /**
   * Send single invite to a student
   */
  async inviteStudent(
    dto: InviteStudentDto,
    facultyUser: any,
  ): Promise<any> {
    // Validate simulation exists
    const simulation = await this.simulationModel.findById(dto.simulationId);
    if (!simulation) {
      throw new NotFoundException('Simulation not found');
    }

    // Normalize email
    const email = dto.email.toLowerCase();

    // Check if already invited
    const existing = await this.studentOnboardingModel.findOne({
      simulation: dto.simulationId,
      email,
    });

    if (existing) {
      if (existing.status === InviteStatus.ACCEPTED) {
        throw new ConflictException(
          'Student is already enrolled in this simulation',
        );
      }

      // If pending, return existing invite
      if (existing.status === InviteStatus.PENDING) {
        return {
          id: existing._id,
          email: existing.email,
          status: existing.status,
          inviteToken: existing.inviteToken,
          expiresAt: existing.expiresAt,
          message: 'Invite already sent to this student',
        };
      }

      // If expired or rejected, regenerate invite
      const inviteToken = this.generateInviteToken();
      const updatedInvite = await this.studentOnboardingModel.findByIdAndUpdate(
        existing._id,
        {
          inviteToken,
          status: InviteStatus.PENDING,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          inviteMessage: dto.inviteMessage,
        },
        { new: true },
      );

      if (!updatedInvite) {
        throw new NotFoundException('Failed to update invite');
      }

      // Send email
      await this.sendInviteEmail(
        email,
        inviteToken,
        simulation,
        dto.inviteMessage,
      );

      // Mark as sent
      await updatedInvite.updateOne({
        sentEmailNotification: true,
        emailSentAt: new Date(),
      });

      return {
        id: updatedInvite._id,
        email: updatedInvite.email,
        status: updatedInvite.status,
        inviteToken: updatedInvite.inviteToken,
        expiresAt: updatedInvite.expiresAt,
        message: 'New invite generated and sent',
      };
    }

    // Generate invite token
    const inviteToken = this.generateInviteToken();

    // Create invite record
    const invite = await this.studentOnboardingModel.create({
      simulation: dto.simulationId,
      email,
      inviteToken,
      status: InviteStatus.PENDING,
      invitedBy: facultyUser._id,
      inviteMessage: dto.inviteMessage,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });

    // Send email
    await this.sendInviteEmail(email, inviteToken, simulation, dto.inviteMessage);

    // Mark as sent
    await invite.updateOne({
      sentEmailNotification: true,
      emailSentAt: new Date(),
    });

    return {
      id: invite._id,
      email: invite.email,
      status: invite.status,
      inviteToken: invite.inviteToken,
      expiresAt: invite.expiresAt,
      message: 'Invite sent successfully',
    };
  }

  /**
   * Send bulk invites to multiple students
   */
  async bulkInviteStudents(
    dto: BulkInviteDto,
    facultyUser: any,
  ): Promise<BulkInviteResponseDto> {
    // Validate simulation exists
    const simulation = await this.simulationModel.findById(dto.simulationId);
    if (!simulation) {
      throw new NotFoundException('Simulation not found');
    }

    const successful: any[] = [];
    const failed: any[] = [];

    for (const email of dto.emails) {
      const normalizedEmail = email.toLowerCase();

      try {
        // Check if already invited/enrolled
        const existing = await this.studentOnboardingModel.findOne({
          simulation: dto.simulationId,
          email: normalizedEmail,
        });

        if (existing) {
          if (existing.status === InviteStatus.ACCEPTED) {
            failed.push({
              email: normalizedEmail,
              reason: 'Already enrolled in this simulation',
            });
            continue;
          }

          // If pending, skip and report
          if (existing.status === InviteStatus.PENDING) {
            failed.push({
              email: normalizedEmail,
              reason: 'Invite already sent (pending)',
            });
            continue;
          }

          // If expired or rejected, regenerate invite
          const inviteToken = this.generateInviteToken();
          const updatedInvite =
            await this.studentOnboardingModel.findByIdAndUpdate(
              existing._id,
              {
                inviteToken,
                status: InviteStatus.PENDING,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                inviteMessage: dto.inviteMessage,
              },
              { new: true },
            );

          if (!updatedInvite) {
            throw new Error('Failed to update invite');
          }

          // Send email
          await this.sendInviteEmail(
            normalizedEmail,
            inviteToken,
            simulation,
            dto.inviteMessage,
          );

          // Mark as sent
          await updatedInvite.updateOne({
            sentEmailNotification: true,
            emailSentAt: new Date(),
          });

          successful.push({
            id: updatedInvite._id,
            email: normalizedEmail,
            status: updatedInvite.status,
            inviteToken: updatedInvite.inviteToken,
            expiresAt: updatedInvite.expiresAt,
            message: 'New invite regenerated and sent',
          });
          continue;
        }

        // Generate invite token
        const inviteToken = this.generateInviteToken();

        // Create invite record
        const invite = await this.studentOnboardingModel.create({
          simulation: dto.simulationId,
          email: normalizedEmail,
          inviteToken,
          status: InviteStatus.PENDING,
          invitedBy: facultyUser._id,
          inviteMessage: dto.inviteMessage,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });

        // Send email
        await this.sendInviteEmail(
          normalizedEmail,
          inviteToken,
          simulation,
          dto.inviteMessage,
        );

        // Mark as sent
        await invite.updateOne({
          sentEmailNotification: true,
          emailSentAt: new Date(),
        });

        successful.push({
          id: invite._id,
          email: normalizedEmail,
          status: invite.status,
          inviteToken: invite.inviteToken,
          expiresAt: invite.expiresAt,
          message: 'Invite sent successfully',
        });
      } catch (error: any) {
        failed.push({
          email: normalizedEmail,
          reason: error.message || 'Failed to send invite',
        });
      }
    }

    return {
      successful,
      failed,
      summary: {
        total: dto.emails.length,
        successCount: successful.length,
        failureCount: failed.length,
      },
    };
  }

  /**
   * Process Excel file for bulk student invites
   */
  async importFromExcel(
    file: any,
    dto: ExcelImportDto,
    facultyUser: any,
  ): Promise<ExcelImportResponseDto> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Validate simulation exists
    const simulation = await this.simulationModel.findById(dto.simulationId);
    if (!simulation) {
      throw new NotFoundException('Simulation not found');
    }

    // Parse Excel file
    const workbook = XLSX.read(file.buffer);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (!data || data.length === 0) {
      throw new BadRequestException('Excel file is empty');
    }

    const bulkImportId = randomUUID();
    const successful: any[] = [];
    const failed: any[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i] as any;
      const rowNumber = i + 2; // +2 for 1-based indexing and header row

      try {
        // Extract email from various possible column names
        let email = row.email || row.Email || row.EMAIL || row.studentEmail;

        if (!email) {
          throw new Error('Email column not found in Excel row');
        }

        email = email.toString().toLowerCase().trim();

        // Validate email format
        if (!this.isValidEmail(email)) {
          throw new Error('Invalid email format');
        }

        // Check if already invited/enrolled
        const existing = await this.studentOnboardingModel.findOne({
          simulation: dto.simulationId,
          email,
        });

        if (existing) {
          if (existing.status === InviteStatus.ACCEPTED) {
            failed.push({
              rowNumber,
              email,
              reason: 'Already enrolled in this simulation',
            });
            continue;
          }

          // If pending, skip and report
          if (existing.status === InviteStatus.PENDING) {
            failed.push({
              rowNumber,
              email,
              reason: 'Invite already pending',
            });
            continue;
          }

          // If expired or rejected, regenerate invite
          const inviteToken = this.generateInviteToken();
          const updatedInvite =
            await this.studentOnboardingModel.findByIdAndUpdate(
              existing._id,
              {
                inviteToken,
                status: InviteStatus.PENDING,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                inviteMessage: dto.inviteMessage,
                bulkImportId,
                rowNumber,
              },
              { new: true },
            );

          if (!updatedInvite) {
            throw new Error('Failed to update invite');
          }

          // Send email
          await this.sendInviteEmail(
            email,
            inviteToken,
            simulation,
            dto.inviteMessage,
          );

          // Mark as sent
          await updatedInvite.updateOne({
            sentEmailNotification: true,
            emailSentAt: new Date(),
          });

          successful.push({
            rowNumber,
            email,
            status: updatedInvite.status,
          });
          continue;
        }

        // Generate invite token
        const inviteToken = this.generateInviteToken();

        // Create invite record
        const invite = await this.studentOnboardingModel.create({
          simulation: dto.simulationId,
          email,
          inviteToken,
          status: InviteStatus.PENDING,
          invitedBy: facultyUser._id,
          inviteMessage: dto.inviteMessage,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          bulkImportId,
          rowNumber,
        });

        // Send email
        await this.sendInviteEmail(
          email,
          inviteToken,
          simulation,
          dto.inviteMessage,
        );

        // Mark as sent
        await invite.updateOne({
          sentEmailNotification: true,
          emailSentAt: new Date(),
        });

        successful.push({
          rowNumber,
          email,
          status: invite.status,
        });
      } catch (error: any) {
        failed.push({
          rowNumber,
          email: (row as any)?.email || (row as any)?.Email || 'unknown',
          reason: error.message,
        });
      }
    }

    return {
      bulkImportId,
      totalRowsProcessed: data.length,
      successful,
      failed,
      summary: {
        total: data.length,
        successCount: successful.length,
        failureCount: failed.length,
      },
    };
  }

  /**
   * Accept invite and create user/student enrollment
   */
  async acceptInvite(
    dto: AcceptInviteDto,
  ): Promise<AcceptInviteResponseDto> {
    // Find valid invite
    const invite = await this.studentOnboardingModel.findOne({
      inviteToken: dto.inviteToken,
      status: InviteStatus.PENDING,
      expiresAt: { $gt: new Date() },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found, expired, or already used');
    }

    // Check if user already exists
    let user = await this.userModel.findOne({ email: invite.email });

    if (!user) {
      // Create new user (student)
      if (!dto.password) {
        throw new BadRequestException(
          'Password is required for new student accounts',
        );
      }

      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash(dto.password, 10);

      // Use names from the DTO if present; fall back to empty strings.
      // The schema now allows empty values so this won't throw.
      const firstName = (dto.firstName ?? '').trim();
      const lastName = (dto.lastName ?? '').trim();

      // Build a sensible displayName: prefer the full name, fall back to email.
      // Avoids "Hi  ," in subsequent UI greetings.
      const fullName = `${firstName} ${lastName}`.trim();
      const displayName = fullName || invite.email;

      user = await this.userModel.create({
        email: invite.email,
        firstName,
        lastName,
        displayName,
        role: UserRole.STUDENT,
        passwordHash,
        isActive: true,
      });
    }

    // Link user to invite
    await invite.updateOne({
      user: user._id,
      status: InviteStatus.ACCEPTED,
      acceptedAt: new Date(),
    });

    // Create enrollment for simulation (WITHOUT firm assignment - that comes later)
    // First, check if enrollment already exists
    let enrollment = await this.enrollmentModel.findOne({
      simulation: invite.simulation,
      user: user._id,
    });

    if (!enrollment) {
      // Create enrollment without firm initially
      // firm is undefined — populated later when faculty assigns the student to a team
      enrollment = await this.enrollmentModel.create({
        simulation: new Types.ObjectId(String(invite.simulation)),
        user: user._id,
        // firm: omitted — populated later when faculty assigns the student to a team
        // firmNumber: omitted for the same reason
        status: EnrollmentStatus.PENDING,
        role: EnrollmentRole.TEAM_MEMBER,
        canSubmitDecisions: false, // Cannot submit until firm is assigned
        canViewReports: true,
        canViewCompetitorData: false,
      });
    }

    // Get simulation details
    const simulation = await this.simulationModel.findById(invite.simulation);
    if (!simulation) {
      throw new NotFoundException('Simulation not found');
    }

    return {
      success: true,
      message: 'Successfully joined simulation. Awaiting firm assignment from faculty.',
      simulation: {
        id: (simulation._id as Types.ObjectId).toString(),
        name: simulation.name,
      },
      user: {
        id: (user._id as Types.ObjectId).toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }

  /**
   * Get invite details by token
   */
  async getInviteDetails(inviteToken: string): Promise<any> {
    const invite = await this.studentOnboardingModel.findOne({
      inviteToken,
    });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    const simulation = await this.simulationModel.findById(invite.simulation);
    if (!simulation) {
      throw new NotFoundException('Simulation not found');
    }

    // Check whether the email already has an account
    const existingUser = await this.userModel.findOne({ email: invite.email });
    const userExists = !!existingUser;

    return {
      email: invite.email,
      status: invite.status,
      simulation: {
        id: (simulation._id as Types.ObjectId).toString(),
        name: simulation.name,
      },
      expiresAt: invite.expiresAt,
      isExpired: new Date() > invite.expiresAt,
      userExists,
    };
  }

  /**
   * Get all pending invites for a simulation
   */
  async getSimulationInvites(simulationId: string, facultyUser: any): Promise<any[]> {
    const simulation = await this.simulationModel.findById(simulationId);
    if (!simulation) {
      throw new NotFoundException('Simulation not found');
    }

    const invites = await this.studentOnboardingModel
      .find({
        simulation: simulationId,
      })
      .sort({ createdAt: -1 });

    return invites.map((invite: any) => ({
      id: invite._id,
      email: invite.email,
      inviteToken: invite.inviteToken,         // ← needed by faculty "Copy link"
      status: invite.status,
      invitedBy: invite.invitedBy,
      expiresAt: invite.expiresAt,
      acceptedAt: invite.acceptedAt,
      user: invite.user,
      createdAt: invite.createdAt || new Date(),
      // Useful extras the frontend already knows how to render
      bulkImportId: invite.bulkImportId,
      rowNumber: invite.rowNumber,
      sentEmailNotification: invite.sentEmailNotification,
      emailSentAt: invite.emailSentAt,
    }));
  }

  /**
   * Resend invite email
   */
  async resendInvite(inviteId: string, facultyUser: any): Promise<any> {
    const invite = await this.studentOnboardingModel.findById(inviteId);

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    if (invite.status !== InviteStatus.PENDING) {
      throw new BadRequestException(
        'Cannot resend invite for ' + invite.status + ' invite',
      );
    }

    if (new Date() > invite.expiresAt) {
      // Regenerate token and extend expiry
      invite.inviteToken = this.generateInviteToken();
      invite.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    const simulation = await this.simulationModel.findById(invite.simulation);
    await this.sendInviteEmail(
      invite.email,
      invite.inviteToken,
      simulation,
      invite.inviteMessage,
    );

    await invite.updateOne({
      sentEmailNotification: true,
      emailSentAt: new Date(),
    });

    return {
      success: true,
      message: 'Invite resent successfully',
    };
  }

  /**
   * Generate a sample Excel template for bulk import
   */
  generateExcelTemplate(): Buffer {
    // Create sample data with instructions
    const sampleData = [
      {
        Email: 'student1@university.edu',
        'First Name': 'John',
        'Last Name': 'Doe',
        Notes: 'Optional notes',
      },
      {
        Email: 'student2@university.edu',
        'First Name': 'Jane',
        'Last Name': 'Smith',
        Notes: 'Optional notes',
      },
      {
        Email: 'student3@university.edu',
        'First Name': 'Bob',
        'Last Name': 'Johnson',
        Notes: 'Optional notes',
      },
    ];

    // Create workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');

    // Set column widths for better visibility
    worksheet['!cols'] = [
      { wch: 30 }, // Email column width
      { wch: 15 }, // First Name column width
      { wch: 15 }, // Last Name column width
      { wch: 30 }, // Notes column width
    ];

    // Write to buffer
    return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
  }

  // ============== PRIVATE HELPER METHODS ==============

  private generateInviteToken(): string {
    return randomUUID();
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private async sendInviteEmail(
    email: string,
    inviteToken: string,
    simulation: any,
    customMessage?: string,
  ): Promise<void> {
    // Build invite link
    const inviteLink = `${process.env.FRONTEND_URL}/onboarding/accept?token=${inviteToken}`;

    try {
      await sendStudentInviteEmail(
        email,
        simulation.name,
        inviteLink,
        customMessage,
      );
    } catch (error) {
      console.error('Failed to send invite email:', error);
      // Don't throw - invite record still created even if email fails
    }
  }

  /**
   * Generate a registration link for a simulation
   */
  async generateRegistrationLink(
    simulationId: string,
    facultyUser: any,
    description?: string,
    maxUses?: number,
  ): Promise<any> {
    // Validate simulation exists
    const simulation = await this.simulationModel.findById(simulationId);
    if (!simulation) {
      throw new NotFoundException('Simulation not found');
    }

    // Check if registration link already exists
    const existing = await this.registrationLinkModel.findOne({
      simulation: new Types.ObjectId(simulationId),
      status: RegistrationLinkStatus.ACTIVE,
    });

    if (existing) {
      return {
        id: existing._id,
        simulationId: existing.simulation,
        token: existing.token,
        status: existing.status,
        createdAt: existing.createdAt,
        expiresAt: existing.expiresAt,
        usedCount: existing.usedCount,
        maxUses: existing.maxUses,
        description: existing.description,
        registrationUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/register?token=${existing.token}`,
        message: 'Active registration link already exists for this simulation',
      };
    }

    // Generate new registration link
    const token = randomUUID();
    const newLink = await this.registrationLinkModel.create({
      simulation: new Types.ObjectId(simulationId),
      token,
      status: RegistrationLinkStatus.ACTIVE,
      createdBy: facultyUser._id,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      usedCount: 0,
      maxUses,
      description,
    });

    return {
      id: newLink._id,
      simulationId: newLink.simulation,
      token: newLink.token,
      status: newLink.status,
      createdAt: newLink.createdAt,
      expiresAt: newLink.expiresAt,
      usedCount: newLink.usedCount,
      maxUses: newLink.maxUses,
      description: newLink.description,
      registrationUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/register?token=${token}`,
    };
  }

  /**
   * Get registration link for a simulation
   */
  async getRegistrationLink(
    simulationId: string,
    facultyUser: any,
  ): Promise<any> {
    const simulation = await this.simulationModel.findById(simulationId);
    if (!simulation) {
      throw new NotFoundException('Simulation not found');
    }

    const link = await this.registrationLinkModel.findOne({
      simulation: new Types.ObjectId(simulationId),
    });

    if (!link) {
      return null;
    }

    return {
      id: link._id,
      simulationId: link.simulation,
      token: link.token,
      status: link.status,
      createdAt: link.createdAt,
      expiresAt: link.expiresAt,
      usedCount: link.usedCount,
      maxUses: link.maxUses,
      description: link.description,
      registrationUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/register?token=${link.token}`,
    };
  }

  /**
   * Register a student via registration link
   */
  async registerViaLink(
    token: string,
    email: string,
    firstName: string,
    lastName: string,
    password: string,
  ): Promise<any> {
    // ── Validate registration link ───────────────────────────────────────────
    const regLink = await this.registrationLinkModel.findOne({ token });
    if (!regLink) {
      throw new NotFoundException('Invalid registration link');
    }

    if (regLink.status !== RegistrationLinkStatus.ACTIVE) {
      throw new BadRequestException(
        `Registration link is ${regLink.status.toLowerCase()}`,
      );
    }

    if (new Date() > regLink.expiresAt) {
      throw new BadRequestException('Registration link has expired');
    }

    if (regLink.maxUses && regLink.usedCount >= regLink.maxUses) {
      throw new BadRequestException('Registration link usage limit reached');
    }

    // ── Validate simulation ──────────────────────────────────────────────────
    const simulation = await this.simulationModel.findById(regLink.simulation);
    if (!simulation) {
      throw new NotFoundException('Simulation not found');
    }

    const normalizedEmail = email.toLowerCase();

    // ── Branch on whether user exists ────────────────────────────────────────
    const existingUser = await this.userModel.findOne({ email: normalizedEmail }).select('+passwordHash');

    let userId: Types.ObjectId;
    let userPayload: any;
    let wasExistingUser = false;

    if (existingUser) {
      // User already has an account. Verify the password they typed against
      // their stored hash before letting them in. This is the auth check that
      // protects against someone using a registration link to attach a sim
      // to an account they don't own.
      const passwordMatches = await bcrypt.compare(password, existingUser.passwordHash);
      if (!passwordMatches) {
        // 401 — they typed an email that exists but the password is wrong.
        // Frontend should detect this and prompt them to log in and let
        // their faculty know, OR use the correct password.
        throw new UnauthorizedException(
          'This email already has a FLEXEE account. Please enter the password you set when you first registered, or log in and contact your instructor.',
        );
      }

      // Password matched — they own this account. Check if they're already
      // enrolled in this simulation.
      const existingEnrollment = await this.enrollmentModel.findOne({
        simulation: regLink.simulation,
        user: existingUser._id,
      });

      if (existingEnrollment) {
        // Idempotent: already in. Don't increment usedCount in this case,
        // since no new seat is being consumed.
        return {
          user: {
            id: existingUser._id,
            email: existingUser.email,
            firstName: existingUser.firstName,
            lastName: existingUser.lastName,
          },
          enrollment: {
            id: existingEnrollment._id,
            simulationId: existingEnrollment.simulation,
            status: existingEnrollment.status,
          },
          simulation: {
            id: simulation._id,
            name: simulation.name,
          },
          alreadyEnrolled: true,
          message: 'You are already enrolled in this simulation. Please log in.',
        };
      }

      userId = existingUser._id as Types.ObjectId;
      userPayload = {
        id: existingUser._id,
        email: existingUser.email,
        firstName: existingUser.firstName,
        lastName: existingUser.lastName,
      };
      wasExistingUser = true;
    } else {
      // No account yet — create one. This is the original new-student path.
      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = await this.userModel.create({
        email: normalizedEmail,
        firstName,
        lastName,
        displayName: `${firstName} ${lastName}`,
        passwordHash: hashedPassword,
        role: UserRole.STUDENT,
        isActive: true,
      });

      userId = newUser._id as Types.ObjectId;
      userPayload = {
        id: newUser._id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
      };
    }

    // ── Create enrollment (same for both new and existing users) ────────────
    const enrollment = await this.enrollmentModel.create({
      simulation: regLink.simulation,
      user: userId,
      status: EnrollmentStatus.PENDING,
      role: EnrollmentRole.TEAM_MEMBER,
    });

    // ── Increment usage count (only for new enrollments, not re-runs) ───────
    regLink.usedCount += 1;
    if (regLink.maxUses && regLink.usedCount >= regLink.maxUses) {
      regLink.status = RegistrationLinkStatus.DISABLED;
    }
    await regLink.save();

    return {
      user: userPayload,
      enrollment: {
        id: enrollment._id,
        simulationId: enrollment.simulation,
        status: enrollment.status,
      },
      simulation: {
        id: simulation._id,
        name: simulation.name,
      },
      // wasExistingUser lets the frontend show a slightly different toast
      // (e.g. "Added to simulation" instead of "Account created")
      wasExistingUser,
      message: wasExistingUser
        ? 'Existing account enrolled in this simulation successfully'
        : 'Student registered successfully',
    };
  }

  /**
   * Get details of a registration link (before registering)
   */
  async getRegistrationLinkDetails(token: string): Promise<any> {
    const regLink = await this.registrationLinkModel.findOne({ token }).populate('simulation');
    if (!regLink) {
      throw new NotFoundException('Invalid registration link');
    }

    if (regLink.status !== RegistrationLinkStatus.ACTIVE) {
      throw new BadRequestException(`Registration link is ${regLink.status.toLowerCase()}`);
    }

    if (new Date() > regLink.expiresAt) {
      throw new BadRequestException('Registration link has expired');
    }

    const simulation: any = regLink.simulation;

    return {
      simulation: {
        id: simulation._id,
        name: simulation.name,
        description: simulation.description,
      },
      registrationLink: {
        status: regLink.status,
        expiresAt: regLink.expiresAt,
        remainingUses: regLink.maxUses ? regLink.maxUses - regLink.usedCount : 'unlimited',
      },
    };
  }
}

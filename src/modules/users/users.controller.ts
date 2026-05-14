import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Req,
  Body,
  UseGuards,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { User, UserRole } from '@/entities/index.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Get all active users (Admin only)
   */
  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all active users (Admin only)' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  async findAll(): Promise<User[]> {
    return this.usersService.findAll();
  }

  /**
   * Get all faculty users
   */
  @Get('faculty')
  @ApiOperation({ summary: 'Get all faculty users' })
  @ApiResponse({ status: 200, description: 'Faculty users retrieved successfully' })
  async findFacultyUsers(): Promise<User[]> {
    return this.usersService.findFacultyUsers();
  }

  /**
   * Get all student users
   */
  @Get('students')
  @ApiOperation({ summary: 'Get all student users' })
  @ApiResponse({ status: 200, description: 'Student users retrieved successfully' })
  async findStudentUsers(): Promise<User[]> {
    return this.usersService.findStudentUsers();
  }

  /**
   * Get all admin users (Admin only)
   */
  @Get('admins')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all admin users (Admin only)' })
  @ApiResponse({ status: 200, description: 'Admin users retrieved successfully' })
  async findAdminUsers(): Promise<User[]> {
    return this.usersService.findAdminUsers();
  }

  /**
   * Get user statistics (Admin only)
   */
  @Get('stats/overview')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get user statistics (Admin only)' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getUserStats(): Promise<{
    totalUsers: number;
    admins: number;
    faculty: number;
    students: number;
    activeUsers: number;
  }> {
    return this.usersService.getUserStats();
  }

  /**
   * Get users by role with pagination (Admin only)
   */
  @Get('role/:role')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get users by role with pagination (Admin only)' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  async findByRole(
    @Param('role') role: string,
    @Query('skip') skip: string = '0',
    @Query('limit') limit: string = '10',
  ): Promise<{ users: User[]; total: number }> {
    const validRoles = Object.values(UserRole);
    if (!validRoles.includes(role as UserRole)) {
      throw new BadRequestException(
        `Invalid role. Must be one of: ${validRoles.join(', ')}`,
      );
    }
    return this.usersService.findByRole(
      role as UserRole,
      parseInt(skip),
      parseInt(limit),
    );
  }

  /**
   * Search users by name, email, or student ID
   */
  @Get('search/:query')
  @ApiOperation({ summary: 'Search users by name, email, or student ID' })
  @ApiResponse({ status: 200, description: 'Search results retrieved' })
  @ApiResponse({ status: 400, description: 'Query must be at least 2 characters' })
  async searchUsers(@Param('query') query: string): Promise<User[]> {
    return this.usersService.searchUsers(query);
  }

  /**
   * Get users by organization
   */
  @Get('organization/:organization')
  @ApiOperation({ summary: 'Get users by organization' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  async findByOrganization(
    @Param('organization') organization: string,
  ): Promise<User[]> {
    return this.usersService.findByOrganization(organization);
  }

  /**
   * Find user by student ID
   */
  @Get('by-student-id/:studentId')
  @ApiOperation({ summary: 'Find user by student ID' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Student ID is required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findByStudentId(@Param('studentId') studentId: string): Promise<User | null> {
    return this.usersService.findByStudentId(studentId);
  }

  /**
   * Get user by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid user ID' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOneById(@Param('id') id: string): Promise<User | null> {
    return this.usersService.findOneById(id);
  }

  /**
   * Update user profile
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update user profile' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid user ID' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateProfile(
    @Param('id') id: string,
    @Body() updateData: Partial<User>,
    @Req() req: any,
  ): Promise<User> {
    // Users can only update their own profile unless admin
    if (req.user._id.toString() !== id && req.user.role !== UserRole.ADMIN) {
      throw new BadRequestException(
        'You can only update your own profile',
      );
    }
    return this.usersService.updateProfile(id, updateData);
  }

  /**
   * Deactivate user (Admin only)
   */
  @Patch(':id/deactivate')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate user (Admin only)' })
  @ApiResponse({ status: 200, description: 'User deactivated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid user ID' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deactivateUser(@Param('id') id: string): Promise<User> {
    return this.usersService.deactivateUser(id);
  }

  /**
   * Activate user (Admin only)
   */
  @Patch(':id/activate')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate user (Admin only)' })
  @ApiResponse({ status: 200, description: 'User activated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid user ID' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async activateUser(@Param('id') id: string): Promise<User> {
    return this.usersService.activateUser(id);
  }
}
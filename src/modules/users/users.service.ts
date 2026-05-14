import { User, UserDocument, UserRole } from '../../entities/index.entity';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  /**
   * Get all users
   */
  async findAll(): Promise<User[]> {
    return this.userModel.find({ isActive: true }).exec();
  }

  /**
   * Find user by MongoDB ID
   */
  async findOneById(id: string): Promise<User | null> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid user ID');
    }
    return this.userModel.findById(id).exec();
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    if (!email) {
      throw new BadRequestException('Email is required');
    }
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  /**
   * Get all faculty users
   */
  async findFacultyUsers(): Promise<User[]> {
    return this.userModel
      .find({ role: UserRole.FACULTY, isActive: true })
      .sort({ lastName: 1, firstName: 1 })
      .exec();
  }

  /**
   * Get all student users
   */
  async findStudentUsers(): Promise<User[]> {
    return this.userModel
      .find({ role: UserRole.STUDENT, isActive: true })
      .sort({ lastName: 1, firstName: 1 })
      .exec();
  }

  /**
   * Get all admin users
   */
  async findAdminUsers(): Promise<User[]> {
    return this.userModel
      .find({ role: UserRole.ADMIN, isActive: true })
      .sort({ lastName: 1, firstName: 1 })
      .exec();
  }

  /**
   * Find users by organization
   */
  async findByOrganization(organization: string): Promise<User[]> {
    if (!organization) {
      throw new BadRequestException('Organization is required');
    }
    return this.userModel
      .find({ organization, isActive: true })
      .sort({ lastName: 1, firstName: 1 })
      .exec();
  }

  /**
   * Find user by student ID
   */
  async findByStudentId(studentId: string): Promise<User | null> {
    if (!studentId) {
      throw new BadRequestException('Student ID is required');
    }
    return this.userModel.findOne({ studentId, isActive: true }).exec();
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    updateData: Partial<User>,
  ): Promise<User> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    // Prevent role changes through profile update
    const { role, ...safeUpdateData } = updateData;

    const updatedUser = await this.userModel.findByIdAndUpdate(
      userId,
      safeUpdateData,
      { new: true },
    );

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return updatedUser;
  }

  /**
   * Deactivate user (soft delete)
   */
  async deactivateUser(userId: string): Promise<User> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const updatedUser = await this.userModel.findByIdAndUpdate(
      userId,
      { isActive: false },
      { new: true },
    );

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return updatedUser;
  }

  /**
   * Activate user
   */
  async activateUser(userId: string): Promise<User> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const updatedUser = await this.userModel.findByIdAndUpdate(
      userId,
      { isActive: true },
      { new: true },
    );

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return updatedUser;
  }

  /**
   * Update user last login timestamp
   */
  async updateLastLogin(userId: string): Promise<User> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const updatedUser = await this.userModel.findByIdAndUpdate(
      userId,
      { lastLoginAt: new Date() },
      { new: true },
    );

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return updatedUser;
  }

  /**
   * Search users by name or email
   */
  async searchUsers(query: string): Promise<User[]> {
    if (!query || query.length < 2) {
      throw new BadRequestException('Search query must be at least 2 characters');
    }

    const searchRegex = new RegExp(query, 'i');

    return this.userModel
      .find({
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { displayName: searchRegex },
          { email: searchRegex },
          { studentId: searchRegex },
        ],
        isActive: true,
      })
      .sort({ lastName: 1, firstName: 1 })
      .exec();
  }

  /**
   * Get users by role with pagination
   */
  async findByRole(
    role: UserRole,
    skip: number = 0,
    limit: number = 10,
  ): Promise<{ users: User[]; total: number }> {
    const users = await this.userModel
      .find({ role, isActive: true })
      .sort({ lastName: 1, firstName: 1 })
      .skip(skip)
      .limit(limit)
      .exec();

    const total = await this.userModel.countDocuments({
      role,
      isActive: true,
    });

    return { users, total };
  }

  /**
   * Get total count of users by role
   */
  async getUserStats(): Promise<{
    totalUsers: number;
    admins: number;
    faculty: number;
    students: number;
    activeUsers: number;
  }> {
    const totalUsers = await this.userModel.countDocuments();
    const admins = await this.userModel.countDocuments({ role: UserRole.ADMIN });
    const faculty = await this.userModel.countDocuments({
      role: UserRole.FACULTY,
    });
    const students = await this.userModel.countDocuments({
      role: UserRole.STUDENT,
    });
    const activeUsers = await this.userModel.countDocuments({ isActive: true });

    return {
      totalUsers,
      admins,
      faculty,
      students,
      activeUsers,
    };
  }
}
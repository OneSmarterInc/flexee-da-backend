import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { User, UserDocument, UserRole } from '@/entities/index.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private usersService: UsersService,
  ) {}

  /**
   * Register a new user
   */
  async register(registerDto: RegisterDto) {
    const { email, password, firstName, lastName } = registerDto;

    // Check if user already exists
    const existingUser = await this.userModel.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new BadRequestException('Email already registered');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user (students by default)
    const newUser = new this.userModel({
      email: email.toLowerCase(),
      firstName,
      lastName,
      displayName: `${firstName} ${lastName}`,
      passwordHash: hashedPassword,
      role: UserRole.STUDENT,
      isActive: true,
    });

    const savedUser = await newUser.save();

    // Generate tokens
    const tokens = this.generateTokens(savedUser);

    return {
      message: 'User registered successfully',
      user: this.sanitizeUser(savedUser),
      ...tokens,
    };
  }

  /**
   * Login user
   */
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user by email (case-insensitive) - explicitly select passwordHash
    const user = await this.userModel
      .findOne({ email: email.toLowerCase() })
      .select('+passwordHash');

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account has been deactivated');
    }

    // Check password
    const passwordMatch = await bcrypt.compare(password, user.passwordHash || '');
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Update last login timestamp
    user.lastLoginAt = new Date();
    await user.save();

    // Generate tokens
    const tokens = this.generateTokens(user);

    return {
      message: 'Login successful',
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  /**
   * Logout user
   */
  async logout(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    // Note: With JWT, logout is typically handled on client-side
    // This endpoint can be used to track logout or invalidate tokens server-side if needed
    return { message: 'Logout successful' };
  }

  /**
   * Change password
   */
  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const { oldPassword, newPassword, confirmPassword } = changePasswordDto;

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      throw new BadRequestException('New passwords do not match');
    }

    // Validate password strength
    if (newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    // Find user - explicitly select passwordHash
    const user = await this.userModel
      .findById(userId)
      .select('+passwordHash');

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Verify old password
    const passwordMatch = await bcrypt.compare(oldPassword, user.passwordHash || '');
    if (!passwordMatch) {
      throw new BadRequestException('Old password is incorrect');
    }

    // Check if new password is same as old
    const samePassword = await bcrypt.compare(newPassword, user.passwordHash || '');
    if (samePassword) {
      throw new BadRequestException('New password must be different from old password');
    }

    // Update password
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    return { message: 'Password changed successfully' };
  }

  /**
   * Request password reset OTP
   */
  async requestPasswordReset(requestPasswordResetDto: RequestPasswordResetDto) {
    const { email } = requestPasswordResetDto;

    const user = await this.userModel.findOne({ email: email.toLowerCase() });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Generate OTP (6 digits)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP in a temporary cache (ideally use Redis for production)
    // For now, we'll store it in memory or use a separate OTP collection
    // TODO: Implement OTP storage in Redis or separate collection
    // TODO: Send OTP via email using email service

    return { 
      message: 'OTP sent to your email',
      // For development only, remove in production
      otp: process.env.NODE_ENV === 'development' ? otp : undefined,
    };
  }

  /**
   * Verify OTP
   */
  async verifyOTP(verifyOtpDto: VerifyOtpDto) {
    const { email, otp } = verifyOtpDto;

    const user = await this.userModel.findOne({ email: email.toLowerCase() });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // TODO: Verify OTP from cache/storage
    // This requires implementing OTP storage system

    return { message: 'OTP verified successfully' };
  }

  /**
   * Reset password
   */
  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { email, newPassword, confirmPassword, otp } = resetPasswordDto;

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    // Validate password strength
    if (newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    // Find user - explicitly select passwordHash
    const user = await this.userModel
      .findOne({ email: email.toLowerCase() })
      .select('+passwordHash');

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // TODO: Verify OTP before resetting password
    // if (otp) {
    //   const isValidOtp = await this.otpService.verify(email, otp);
    //   if (!isValidOtp) {
    //     throw new BadRequestException('Invalid or expired OTP');
    //   }
    // }

    // Update password
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    return { message: 'Password reset successfully' };
  }

  /**
   * Validate user (for local strategy)
   */
  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userModel
      .findOne({ email: email.toLowerCase() })
      .select('+passwordHash');

    if (!user || !user.isActive) {
      return null;
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash || '');
    if (passwordMatch) {
      return user;
    }
    return null;
  }

  /**
   * Validate JWT payload
   */
  async validateJwtPayload(payload: any) {
    if (!Types.ObjectId.isValid(payload.sub)) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const user = await this.userModel.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or has been deactivated');
    }
    return user;
  }

  /**
   * Generate JWT and Refresh tokens
   */
  private generateTokens(user: UserDocument): { access_token: string; refresh_token: string } {
    const payload = {
      sub: (user._id as Types.ObjectId).toString(),
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    const access_token = this.jwtService.sign(payload, { expiresIn: '24h' });
    const refresh_token = this.jwtService.sign(payload, { expiresIn: '7d' });

    return { access_token, refresh_token };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);
      
      // Validate user still exists and is active
      const user = await this.validateJwtPayload(payload);

      const newAccessToken = this.jwtService.sign({
        sub: payload.sub,
        email: payload.email,
        role: payload.role,
        firstName: payload.firstName,
        lastName: payload.lastName,
      }, { expiresIn: '24h' });

      return { access_token: newAccessToken };
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * Get current user profile
   */
  async getCurrentUser(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    return this.sanitizeUser(user);
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, updateData: Partial<User>) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    // Prevent sensitive field updates
    const { role, passwordHash, email, ...safeData } = updateData;

    const updatedUser = await this.userModel.findByIdAndUpdate(
      userId,
      safeData,
      { new: true },
    );

    if (!updatedUser) {
      throw new BadRequestException('User not found');
    }

    return this.sanitizeUser(updatedUser);
  }

  /**
   * Sanitize user (remove sensitive fields)
   */
  private sanitizeUser(user: UserDocument) {
    const userObj = user.toObject();
    delete userObj.passwordHash;
    return userObj;
  }
}
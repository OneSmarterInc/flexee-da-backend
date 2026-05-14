import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument, UserRole } from '../entities/index.entity';

export interface SeedUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  studentId?: string;
  organization?: string;
  role: UserRole;
}

@Injectable()
export class UserSeeder {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async seed(): Promise<void> {
    console.log('🌱 Starting user seeding...');
    
    const seedUsers: SeedUser[] = [
      // Admin users
      {
        email: 'admin@flexee.com',
        password: 'Admin@123456',
        firstName: 'Admin',
        lastName: 'User',
        displayName: 'Admin User',
        role: UserRole.ADMIN,
        organization: 'FLEXEE DA',
      },
      {
        email: 'admin2@flexee.com',
        password: 'Admin@123456',
        firstName: 'Admin',
        lastName: 'User 2',
        displayName: 'Admin User 2',
        role: UserRole.ADMIN,
        organization: 'FLEXEE DA',
      },

      // Faculty users
      {
        email: 'faculty1@flexee.com',
        password: 'Faculty@123456',
        firstName: 'John',
        lastName: 'Smith',
        displayName: 'Dr. John Smith',
        role: UserRole.FACULTY,
        organization: 'MIT',
      },
      {
        email: 'faculty2@flexee.com',
        password: 'Faculty@123456',
        firstName: 'Sarah',
        lastName: 'Johnson',
        displayName: 'Dr. Sarah Johnson',
        role: UserRole.FACULTY,
        organization: 'Stanford',
      },
      {
        email: 'faculty3@flexee.com',
        password: 'Faculty@123456',
        firstName: 'Michael',
        lastName: 'Brown',
        displayName: 'Prof. Michael Brown',
        role: UserRole.FACULTY,
        organization: 'Harvard',
      },

      // Student users
      {
        email: 'student1@flexee.com',
        password: 'Student@123456',
        firstName: 'Alice',
        lastName: 'Johnson',
        studentId: 'STU001',
        role: UserRole.STUDENT,
        organization: 'MIT',
      },
      {
        email: 'student2@flexee.com',
        password: 'Student@123456',
        firstName: 'Bob',
        lastName: 'Smith',
        studentId: 'STU002',
        role: UserRole.STUDENT,
        organization: 'MIT',
      },
      {
        email: 'student3@flexee.com',
        password: 'Student@123456',
        firstName: 'Charlie',
        lastName: 'Davis',
        studentId: 'STU003',
        role: UserRole.STUDENT,
        organization: 'Stanford',
      },
      {
        email: 'student4@flexee.com',
        password: 'Student@123456',
        firstName: 'Diana',
        lastName: 'Williams',
        studentId: 'STU004',
        role: UserRole.STUDENT,
        organization: 'Stanford',
      },
      {
        email: 'student5@flexee.com',
        password: 'Student@123456',
        firstName: 'Eve',
        lastName: 'Martinez',
        studentId: 'STU005',
        role: UserRole.STUDENT,
        organization: 'Harvard',
      },
      {
        email: 'student6@flexee.com',
        password: 'Student@123456',
        firstName: 'Frank',
        lastName: 'Wilson',
        studentId: 'STU006',
        role: UserRole.STUDENT,
        organization: 'Harvard',
      },
    ];

    let createdCount = 0;
    let skippedCount = 0;

    for (const seedUser of seedUsers) {
      try {
        // Check if user already exists
        const existingUser = await this.userModel.findOne({ 
          email: seedUser.email.toLowerCase() 
        });
        
        if (existingUser) {
          console.log(`⏭️  User ${seedUser.email} already exists, skipping...`);
          skippedCount++;
          continue;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(seedUser.password, 10);

        // Create user object with all required fields
        const userData = {
          email: seedUser.email.toLowerCase(),
          firstName: seedUser.firstName,
          lastName: seedUser.lastName,
          displayName: seedUser.displayName || `${seedUser.firstName} ${seedUser.lastName}`,
          passwordHash: hashedPassword,
          role: seedUser.role,
          studentId: seedUser.studentId || undefined,
          organization: seedUser.organization || undefined,
          isActive: true,
        };

        // Debug log
        console.log(`📝 Creating user:`, {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: userData.role,
        });

        // Create and save user
        const user = new this.userModel(userData);
        await user.save();
        
        console.log(`✅ Created ${seedUser.role}: ${seedUser.email}`);
        createdCount++;
      } catch (error) {
        console.error(`❌ Failed to create user ${seedUser.email}:`);
        console.error('Error details:', {
          message: error.message,
          errors: error.errors,
        });
        throw error;
      }
    }

    console.log(`\n✨ User seeding completed!`);
    console.log(`📊 Summary: ${createdCount} created, ${skippedCount} skipped`);
  }

  async clear(): Promise<void> {
    try {
      console.log('🗑️  Clearing all users...');
      const result = await this.userModel.deleteMany({});
      console.log(`✅ Cleared ${result.deletedCount} users`);
    } catch (error) {
      console.error('❌ Failed to clear users:', error.message);
      throw error;
    }
  }
}

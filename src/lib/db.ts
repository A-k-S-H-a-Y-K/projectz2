import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import type { SignOptions } from 'jsonwebtoken';

const prisma = new PrismaClient();

export const db = prisma;

export const hashPassword = async (password: string): Promise<string> => {
  try {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  } catch (error) {
    console.error('Error hashing password:', error);
    throw new Error('Failed to hash password');
  }
};

export const comparePassword = async (
  password: string,
  hash: string
): Promise<boolean> => {
  try {
    return bcrypt.compare(password, hash);
  } catch (error) {
    console.error('Error comparing passwords:', error);
    throw new Error('Failed to compare passwords');
  }
};

export const generateToken = async (payload: { userId: number; email: string }): Promise<string> => {
  const jwtSecret = process.env.JWT_SECRET;
  const jwtExpiresIn = process.env.JWT_EXPIRES_IN;

  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  try {
    const jwt = await import('jsonwebtoken');
    const options: SignOptions = {
      expiresIn: jwtExpiresIn ? parseInt(jwtExpiresIn, 10) : 7 * 24 * 60 * 60, // Default to 7 days in seconds
    };
    
    return jwt.default.sign(
      payload,
      Buffer.from(jwtSecret, 'utf-8'),
      options
    );
  } catch (error) {
    console.error('Error generating JWT token:', error);
    throw new Error('Failed to generate authentication token');
  }
}; 
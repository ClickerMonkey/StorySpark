import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { storage } from './storage';

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    profileImageUrl?: string;
    openaiApiKey?: string;
    openaiBaseUrl?: string;
    replicateApiKey?: string;
    preferredImageProvider?: string;
    preferredReplicateModel?: string;
    replicateModelTemplates?: any[];
    freeMode: boolean;
  };
}

export async function verifyGoogleToken(token: string) {
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error('Invalid token payload');
    }

    return {
      googleId: payload.sub,
      email: payload.email!,
      name: payload.name!,
      profileImageUrl: payload.picture,
    };
  } catch (error) {
    console.error('Error verifying Google token:', error);
    throw new Error('Invalid Google token');
  }
}

export function generateJWT(userId: string): string {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '7d' });
}

export function verifyJWT(token: string): { userId: string } {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
  } catch (error) {
    throw new Error('Invalid JWT token');
  }
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization header required' });
    }

    const token = authHeader.split(' ')[1];
    const { userId } = verifyJWT(token);
    
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      profileImageUrl: user.profileImageUrl || undefined,
      openaiApiKey: user.openaiApiKey || undefined,
      openaiBaseUrl: user.openaiBaseUrl || undefined,
      replicateApiKey: user.replicateApiKey || undefined,
      preferredImageProvider: user.preferredImageProvider || undefined,
      preferredReplicateModel: user.preferredReplicateModel || undefined,
      replicateModelTemplates: user.replicateModelTemplates || [],
      freeMode: user.freeMode || false,
    };
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export async function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { userId } = verifyJWT(token);
      
      const user = await storage.getUser(userId);
      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          profileImageUrl: user.profileImageUrl || undefined,
          openaiApiKey: user.openaiApiKey || undefined,
          openaiBaseUrl: user.openaiBaseUrl || undefined,
          replicateApiKey: user.replicateApiKey || undefined,
          preferredImageProvider: user.preferredImageProvider || undefined,
          preferredReplicateModel: user.preferredReplicateModel || undefined,
          replicateModelTemplates: user.replicateModelTemplates || [],
          freeMode: user.freeMode || false,
        };
      }
    }
    next();
  } catch (error) {
    // Ignore auth errors for optional auth
    next();
  }
}
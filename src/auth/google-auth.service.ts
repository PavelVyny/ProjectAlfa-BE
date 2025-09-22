import { Injectable } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';

@Injectable()
export class GoogleAuthService {
  private client: OAuth2Client;

  constructor() {
    this.client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }

  async verifyGoogleToken(token: string): Promise<{
    googleId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
    emailVerified: boolean;
  }> {
    try {
      const ticket = await this.client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();

      if (!payload) {
        throw new Error('Invalid Google token');
      }

      return {
        googleId: payload.sub,
        email: payload.email!,
        firstName: payload.given_name || undefined,
        lastName: payload.family_name || undefined,
        avatar: payload.picture || undefined,
        emailVerified: payload.email_verified || false,
      };
    } catch (error) {
      console.error('Error verifying Google token:', error);
      throw new Error('Invalid Google token');
    }
  }
}

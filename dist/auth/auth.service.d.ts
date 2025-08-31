import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseService } from '../firebase/firebase.service';
import { RegisterDto, LoginDto, AuthResponseDto } from './dto/auth.dto';
export declare class AuthService {
    private prisma;
    private jwtService;
    private firebaseService;
    constructor(prisma: PrismaService, jwtService: JwtService, firebaseService: FirebaseService);
    register(registerDto: RegisterDto): Promise<AuthResponseDto>;
    login(loginDto: LoginDto): Promise<AuthResponseDto>;
    validateUser(userId: string): Promise<{
        email: string;
        password: string;
        firstName: string | null;
        lastName: string | null;
        id: string;
        firebaseUid: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    } | null>;
}

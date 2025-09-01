import { OnModuleInit } from '@nestjs/common';
export declare class FirebaseService implements OnModuleInit {
    private firebaseApp;
    onModuleInit(): Promise<void>;
    createUser(email: string, password: string, displayName?: string): Promise<string>;
    getUser(uid: string): Promise<import("firebase-admin/lib/auth/user-record").UserRecord>;
    deleteUser(uid: string): Promise<void>;
    userExists(email: string): Promise<boolean>;
    getUserByEmail(email: string): Promise<import("firebase-admin/lib/auth/user-record").UserRecord>;
}

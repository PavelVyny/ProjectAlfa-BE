interface AuthenticatedUser {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
}
interface AuthenticatedRequest extends Request {
    user: AuthenticatedUser;
}
export declare class ProtectedController {
    getProfile(req: AuthenticatedRequest): {
        message: string;
        user: {
            id: string;
            email: string;
            firstName: string | undefined;
            lastName: string | undefined;
        };
    };
}
export {};

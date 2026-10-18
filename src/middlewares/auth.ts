import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthPayload {
    userId: string;
    email: string;
}

// Extendemos la interfaz de Request de Express para incluir al usuario autenticado
declare global {
    namespace Express {
        interface Request {
            user?: AuthPayload;
        }
    }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
            status: 'fail',
            message: 'Acceso no autorizado: Token no proporcionado',
        });
        return;
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        res.status(401).json({
            status: 'fail',
            message: 'Acceso no autorizado: Token no proporcionado',
        });
        return;
    }

    const secret = process.env.JWT_SECRET || 'jwt_secret_fallback';

    try {
        const decoded = jwt.verify(token, secret) as unknown as AuthPayload;
        req.user = decoded; // Inyecta la identidad verificada en la petición
        next();
    } catch (error) {
        res.status(401).json({
            status: 'fail',
            message: 'Token inválido o expirado',
        });
        return;
    }
};
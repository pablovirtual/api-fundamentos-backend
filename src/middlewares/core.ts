import type { Request, Response, NextFunction } from 'express';
import { ZodError, type ZodSchema } from 'zod';


// Middleware genérico para validar cualquier esquema Zod en el body
export const validateBody = (schema: ZodSchema) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            req.body = await schema.parseAsync(req.body);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                res.status(400).json({
                    status: 'fail',
                    errors: error.issues.map((issue) => ({
                        field: issue.path.join('.'),
                        message: issue.message,
                    })),
                });
                return;
            }
            next(error);
        }
    };
};

// Rate limiter en memoria por IP (Máximo N peticiones en una ventana de tiempo)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export const rateLimiter = (maxRequests: number, windowMs: number) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        const currentTime = Date.now();
        const record = requestCounts.get(ip);

        if (!record || currentTime > record.resetTime) {
            requestCounts.set(ip, { count: 1, resetTime: currentTime + windowMs });
            return next();
        }

        if (record.count >= maxRequests) {
            res.status(429).json({
                status: 'error',
                message: 'Límite de peticiones alcanzado. Intenta de nuevo más tarde.',
            });
            return;
        }

        record.count += 1;
        next();
    };
};

// Middleware de autenticación simulada por Bearer Token
export const requireApiKey = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== 'Bearer token-secreto-fullstack') {
        res.status(401).json({
            status: 'fail',
            message: 'No autorizado: Cabecera Authorization ausente o inválida',
        });
        return;
    }
    next();
};

// NUEVO: Middleware para validar y castear req.query
export const validateQuery = (schema: ZodSchema) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            const parsed = schema.parse(req.query);
            Object.defineProperty(req, 'query', {
                value: parsed,
                writable: true,
                enumerable: true,
                configurable: true,
            });
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                res.status(400).json({
                    status: 'fail',
                    errors: error.issues.map((err) => ({
                        field: err.path.join('.'),
                        message: err.message,
                    })),
                });
                return;
            }
            next(error);
        }
    };
};
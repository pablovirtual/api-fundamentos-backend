// src/app.ts
import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type { Prisma } from '@prisma/client';
import { prisma } from './lib/prisma.js';
import { RegisterSchema, LoginSchema } from './schemas/auth.schema.js';
import { ItemSchema, UpdateItemSchema } from './schemas/item.schema.js';
import { ItemQuerySchema, type ItemQueryInput } from './schemas/query.schema.js';
import { validateBody, validateQuery, rateLimiter } from './middlewares/core.js';
import { requireAuth } from './middlewares/auth.js';
import swaggerUi from 'swagger-ui-express';
import { swaggerDocument } from './config/swagger.js';

export const app = express();
app.use(express.json());

// Solo aplicamos rate limiter fuera de pruebas para no frenar la suite
if (process.env.NODE_ENV !== 'test') {
    app.use(rateLimiter(60, 60 * 1000));
}

const JWT_SECRET = process.env.JWT_SECRET || 'jwt_secret_fallback';

// --- AUTH ---
app.post(
    '/api/v1/auth/register',
    validateBody(RegisterSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { name, email, password } = req.body;
            const hashedPassword = await bcrypt.hash(password, 10);
            const user = await prisma.user.create({
                data: { name, email, password: hashedPassword },
                select: { id: true, name: true, email: true, createdAt: true },
            });
            res.status(201).json({ status: 'success', data: user });
        } catch (error) {
            next(error);
        }
    }
);

app.post(
    '/api/v1/auth/login',
    validateBody(LoginSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { email, password } = req.body;
            const user = await prisma.user.findUnique({ where: { email } });
            if (!user) {
                res.status(401).json({ status: 'fail', message: 'Credenciales inválidas' });
                return;
            }
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                res.status(401).json({ status: 'fail', message: 'Credenciales inválidas' });
                return;
            }
            const token = jwt.sign(
                { userId: user.id, email: user.email },
                JWT_SECRET,
                { expiresIn: '2h' }
            );
            res.status(200).json({
                status: 'success',
                token,
                data: { id: user.id, name: user.name, email: user.email },
            });
        } catch (error) {
            next(error);
        }
    }
);

// --- ITEMS ---
app.get(
    '/api/v1/items',
    validateQuery(ItemQuerySchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const query = req.query as unknown as ItemQueryInput;
            const { page, limit, category, search, minPrice, maxPrice, sortBy, sortOrder } = query;

            const where: Prisma.ItemWhereInput = {};
            if (category) where.category = category;
            if (search) where.title = { contains: search, mode: 'insensitive' };
            if (minPrice !== undefined || maxPrice !== undefined) {
                where.price = {};
                if (minPrice !== undefined) where.price.gte = minPrice;
                if (maxPrice !== undefined) where.price.lte = maxPrice;
            }

            const skip = (page - 1) * limit;

            const [items, totalItems] = await prisma.$transaction([
                prisma.item.findMany({
                    where,
                    include: { user: { select: { id: true, name: true, email: true } } },
                    skip,
                    take: limit,
                    orderBy: { [sortBy]: sortOrder },
                }),
                prisma.item.count({ where }),
            ]);

            const totalPages = Math.ceil(totalItems / limit);

            res.status(200).json({
                status: 'success',
                results: items.length,
                pagination: {
                    totalItems,
                    totalPages,
                    currentPage: page,
                    limit,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1,
                },
                data: items,
            });
        } catch (error) {
            next(error);
        }
    }
);

app.post(
    '/api/v1/items',
    requireAuth,
    validateBody(ItemSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { title, price, category } = req.body;
            const newItem = await prisma.item.create({
                data: { title, price, category, userId: req.user!.userId },
            });
            res.status(201).json({ status: 'success', data: newItem });
        } catch (error) {
            next(error);
        }
    }
);

app.put(
    '/api/v1/items/:id',
    requireAuth,
    validateBody(UpdateItemSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = req.params.id as string;
            const currentUserId = req.user!.userId;
            const item = await prisma.item.findUnique({ where: { id } });
            if (!item) {
                res.status(404).json({ status: 'fail', message: 'Elemento no encontrado' });
                return;
            }
            if (item.userId !== currentUserId) {
                res.status(403).json({ status: 'fail', message: 'Prohibido: No eres el dueño de este recurso' });
                return;
            }
            const updatedItem = await prisma.item.update({
                where: { id },
                data: req.body,
            });
            res.status(200).json({ status: 'success', data: updatedItem });
        } catch (error) {
            next(error);
        }
    }
);

app.delete(
    '/api/v1/items/:id',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = req.params.id as string;
            const currentUserId = req.user!.userId;
            const item = await prisma.item.findUnique({ where: { id } });
            if (!item) {
                res.status(404).json({ status: 'fail', message: 'Elemento no encontrado' });
                return;
            }
            if (item.userId !== currentUserId) {
                res.status(403).json({ status: 'fail', message: 'Prohibido: No eres el dueño de este recurso' });
                return;
            }
            await prisma.item.delete({ where: { id } });
            res.status(204).send();
        } catch (error) {
            next(error);
        }
    }
);
// Documentación Interactiva Swagger UI
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// --- ERROR HANDLER ---
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (err.code === 'P2002') {
        res.status(409).json({
            status: 'fail',
            message: `Ya existe un registro con ese valor en el campo: ${err.meta?.target}`,
        });
        return;
    }
    res.status(500).json({ status: 'error', message: 'Error interno en el servidor' });
});
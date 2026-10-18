import { z } from 'zod';

export const ItemQuerySchema = z.object({
    page: z
        .string()
        .optional()
        .default('1')
        .transform((val) => Math.max(1, parseInt(val, 10) || 1)),
    limit: z
        .string()
        .optional()
        .default('10')
        .transform((val) => Math.min(50, Math.max(1, parseInt(val, 10) || 10))), // Mínimo 1, máximo 50
    category: z.enum(['TECH', 'OFFICE', 'HOME']).optional(),
    search: z.string().trim().optional(),
    minPrice: z
        .string()
        .optional()
        .transform((val) => (val ? parseFloat(val) : undefined)),
    maxPrice: z
        .string()
        .optional()
        .transform((val) => (val ? parseFloat(val) : undefined)),
    sortBy: z.enum(['createdAt', 'price', 'title']).optional().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type ItemQueryInput = z.infer<typeof ItemQuerySchema>;
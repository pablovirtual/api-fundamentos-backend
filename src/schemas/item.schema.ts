import { z } from 'zod';

export const ItemSchema = z.object({
    title: z.string().min(3, 'El título debe tener al menos 3 caracteres'),
    price: z.number().positive('El precio debe ser un número positivo'),
    category: z.enum(['TECH', 'OFFICE', 'HOME']),
});

export const UpdateItemSchema = ItemSchema.partial();

export type ItemInput = z.infer<typeof ItemSchema>;
export type UpdateItemInput = z.infer<typeof UpdateItemSchema>;
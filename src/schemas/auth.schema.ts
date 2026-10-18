import { z } from 'zod';

export const RegisterSchema = z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    email: z.string().email('Debe ser un correo electrónico válido'),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

export const LoginSchema = z.object({
    email: z.string().email('Debe ser un correo electrónico válido'),
    password: z.string().min(1, 'La contraseña es requerida'),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

describe('Suite de Pruebas de Integración - /api/v1/items', () => {
  const timestamp = Date.now();
  const ownerEmail = `owner-${timestamp}@test.com`;
  const otherUserEmail = `other-${timestamp}@test.com`;
  const password = 'Password123!';

  let ownerToken: string;
  let otherToken: string;
  let ownerUserId: string;
  let otherUserId: string;
  let createdItemId: string;

  beforeAll(async () => {
    // 1. Registrar usuario propietario
    const resOwner = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Item Owner',
        email: ownerEmail,
        password,
      });
    expect(resOwner.status).toBe(201);
    ownerUserId = resOwner.body.data.id;

    // Login usuario propietario para obtener token
    const resLoginOwner = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: ownerEmail,
        password,
      });
    expect(resLoginOwner.status).toBe(200);
    ownerToken = resLoginOwner.body.token;

    // 2. Registrar segundo usuario (para pruebas de 403 Forbidden)
    const resOther = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Other User',
        email: otherUserEmail,
        password,
      });
    expect(resOther.status).toBe(201);
    otherUserId = resOther.body.data.id;

    // Login segundo usuario
    const resLoginOther = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: otherUserEmail,
        password,
      });
    expect(resLoginOther.status).toBe(200);
    otherToken = resLoginOther.body.token;
  });

  afterAll(async () => {
    // Limpieza de datos creados durante las pruebas
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [ownerEmail, otherUserEmail],
        },
      },
    });
    await prisma.$disconnect();
  });

  // ==========================================
  // GET /api/v1/items
  // ==========================================
  describe('GET /api/v1/items', () => {
    it('debe listar ítems con paginación y responder 200 OK', async () => {
      const response = await request(app).get('/api/v1/items');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body).toHaveProperty('results');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('currentPage', 1);
      expect(response.body.pagination).toHaveProperty('limit', 10);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('debe respetar los parámetros de consulta (query params)', async () => {
      const response = await request(app).get('/api/v1/items?limit=5&page=1');

      expect(response.status).toBe(200);
      expect(response.body.pagination.limit).toBe(5);
      expect(response.body.pagination.currentPage).toBe(1);
    });
  });

  // ==========================================
  // POST /api/v1/items
  // ==========================================
  describe('POST /api/v1/items', () => {
    it('debe responder 401 Unauthorized si no se incluye token de autenticación', async () => {
      const response = await request(app)
        .post('/api/v1/items')
        .send({
          title: 'Laptop Pro',
          price: 1500,
          category: 'TECH',
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('status', 'fail');
      expect(response.body.message).toMatch(/no autorizado|token no proporcionado/i);
    });

    it('debe responder 401 Unauthorized si el token es inválido', async () => {
      const response = await request(app)
        .post('/api/v1/items')
        .set('Authorization', 'Bearer token_invalido_123')
        .send({
          title: 'Laptop Pro',
          price: 1500,
          category: 'TECH',
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('status', 'fail');
    });

    it('debe responder 400 Bad Request si el cuerpo de la petición no cumple con el esquema Zod', async () => {
      const response = await request(app)
        .post('/api/v1/items')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'A', // Muy corto (mínimo 3 caracteres)
          price: -50, // Debe ser positivo
          category: 'INVALID_CATEGORY',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('status', 'fail');
      expect(Array.isArray(response.body.errors)).toBe(true);
      expect(response.body.errors.length).toBeGreaterThanOrEqual(1);
    });

    it('debe responder 201 Created y crear el ítem cuando los datos son válidos', async () => {
      const response = await request(app)
        .post('/api/v1/items')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Teclado Mecánico RGB',
          price: 120.5,
          category: 'TECH',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.title).toBe('Teclado Mecánico RGB');
      expect(response.body.data.price).toBe(120.5);
      expect(response.body.data.category).toBe('TECH');
      expect(response.body.data.userId).toBe(ownerUserId);

      createdItemId = response.body.data.id;
    });
  });

  // ==========================================
  // PUT /api/v1/items/:id
  // ==========================================
  describe('PUT /api/v1/items/:id', () => {
    it('debe responder 401 Unauthorized si no se incluye token', async () => {
      const response = await request(app)
        .put(`/api/v1/items/${createdItemId}`)
        .send({ price: 140 });

      expect(response.status).toBe(401);
    });

    it('debe responder 403 Forbidden si otro usuario intenta modificar el ítem', async () => {
      const response = await request(app)
        .put(`/api/v1/items/${createdItemId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ price: 999 });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('status', 'fail');
      expect(response.body.message).toMatch(/no eres el dueño/i);
    });

    it('debe responder 404 Not Found si el ítem no existe', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .put(`/api/v1/items/${nonExistentId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ price: 200 });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('status', 'fail');
    });

    it('debe responder 200 OK y actualizar el ítem cuando es el dueño', async () => {
      const response = await request(app)
        .put(`/api/v1/items/${createdItemId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Teclado Mecánico Inalámbrico',
          price: 135.0,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body.data.title).toBe('Teclado Mecánico Inalámbrico');
      expect(response.body.data.price).toBe(135.0);
    });
  });

  // ==========================================
  // DELETE /api/v1/items/:id
  // ==========================================
  describe('DELETE /api/v1/items/:id', () => {
    it('debe responder 401 Unauthorized si no se incluye token', async () => {
      const response = await request(app)
        .delete(`/api/v1/items/${createdItemId}`);

      expect(response.status).toBe(401);
    });

    it('debe responder 403 Forbidden si otro usuario intenta eliminar el ítem', async () => {
      const response = await request(app)
        .delete(`/api/v1/items/${createdItemId}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('status', 'fail');
      expect(response.body.message).toMatch(/no eres el dueño/i);
    });

    it('debe responder 404 Not Found si el ítem a eliminar no existe', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .delete(`/api/v1/items/${nonExistentId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('status', 'fail');
    });

    it('debe responder 204 No Content y eliminar el ítem cuando es el dueño', async () => {
      const response = await request(app)
        .delete(`/api/v1/items/${createdItemId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(204);

      // Verificar que el ítem realmente fue eliminado de la base de datos
      const checkDeleted = await prisma.item.findUnique({
        where: { id: createdItemId },
      });
      expect(checkDeleted).toBeNull();
    });
  });
});

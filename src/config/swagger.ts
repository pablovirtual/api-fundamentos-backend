export const swaggerDocument = {
    openapi: '3.0.0',
    info: {
        title: 'API REST - Fundamentos Backend',
        version: '1.0.0',
        description:
            'Documentación interactiva de la API con autenticación JWT, PostgreSQL y Prisma.',
    },
    servers: [
        {
            url: 'https://api-fundamentos-backend.onrender.com',
            description: 'Servidor de Producción (Render)',
        },
        {
            url: 'http://localhost:3000',
            description: 'Servidor Local de Desarrollo',
        },
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
            },
        },
        schemas: {
            User: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    name: { type: 'string', example: 'Pedro Rodriguez' },
                    email: { type: 'string', format: 'email', example: 'pedro.dev@test.com' },
                    createdAt: { type: 'string', format: 'date-time' },
                },
            },
            Item: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    title: { type: 'string', example: 'Teclado Custom Mecánico' },
                    price: { type: 'number', example: 2800 },
                    category: {
                        type: 'string',
                        enum: ['TECH', 'OFFICE', 'HOME'],
                        example: 'TECH',
                    },
                    userId: { type: 'string', format: 'uuid' },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                    user: { $ref: '#/components/schemas/User' },
                },
            },
            PaginationMeta: {
                type: 'object',
                properties: {
                    totalItems: { type: 'integer', example: 10 },
                    totalPages: { type: 'integer', example: 2 },
                    currentPage: { type: 'integer', example: 1 },
                    limit: { type: 'integer', example: 5 },
                    hasNextPage: { type: 'boolean', example: true },
                    hasPrevPage: { type: 'boolean', example: false },
                },
            },
        },
    },
    paths: {
        '/api/v1/auth/register': {
            post: {
                tags: ['Autenticación'],
                summary: 'Registrar un nuevo usuario',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['name', 'email', 'password'],
                                properties: {
                                    name: { type: 'string', example: 'Pedro Rodriguez' },
                                    email: { type: 'string', example: 'pedro.dev@test.com' },
                                    password: { type: 'string', example: 'Password123!' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: {
                        description: 'Usuario creado exitosamente',
                    },
                    409: {
                        description: 'Email ya registrado',
                    },
                },
            },
        },
        '/api/v1/auth/login': {
            post: {
                tags: ['Autenticación'],
                summary: 'Iniciar sesión y obtener token JWT',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['email', 'password'],
                                properties: {
                                    email: { type: 'string', example: 'pedro.dev@test.com' },
                                    password: { type: 'string', example: 'Password123!' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Login exitoso, devuelve JWT',
                    },
                    401: {
                        description: 'Credenciales inválidas',
                    },
                },
            },
        },
        '/api/v1/items': {
            get: {
                tags: ['Items'],
                summary: 'Listar items con paginación y filtros dinámicos',
                parameters: [
                    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
                    { name: 'category', in: 'query', schema: { type: 'string', enum: ['TECH', 'OFFICE', 'HOME'] } },
                    { name: 'search', in: 'query', schema: { type: 'string' } },
                    { name: 'minPrice', in: 'query', schema: { type: 'number' } },
                    { name: 'maxPrice', in: 'query', schema: { type: 'number' } },
                    { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['createdAt', 'price', 'title'], default: 'createdAt' } },
                    { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
                ],
                responses: {
                    200: {
                        description: 'Lista paginada de items',
                    },
                },
            },
            post: {
                tags: ['Items'],
                summary: 'Crear un nuevo item (Requiere autenticación)',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['title', 'price', 'category'],
                                properties: {
                                    title: { type: 'string', example: 'Monitor Curvo 27"' },
                                    price: { type: 'number', example: 4500 },
                                    category: { type: 'string', enum: ['TECH', 'OFFICE', 'HOME'], example: 'TECH' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: { description: 'Item creado' },
                    401: { description: 'No autorizado / Token ausente o inválido' },
                },
            },
        },
        '/api/v1/items/{id}': {
            put: {
                tags: ['Items'],
                summary: 'Modificar un item existente (Solo el dueño)',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    title: { type: 'string' },
                                    price: { type: 'number' },
                                    category: { type: 'string', enum: ['TECH', 'OFFICE', 'HOME'] },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Item actualizado exitosamente' },
                    403: { description: 'Prohibido: No eres el dueño del recurso' },
                    404: { description: 'Item no encontrado' },
                },
            },
            delete: {
                tags: ['Items'],
                summary: 'Eliminar un item existente (Solo el dueño)',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                ],
                responses: {
                    204: { description: 'Item eliminado sin contenido de retorno' },
                    403: { description: 'Prohibido: No eres el dueño del recurso' },
                    404: { description: 'Item no encontrado' },
                },
            },
        },
    },
};
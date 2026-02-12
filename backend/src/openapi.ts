/**
 * OpenAPI 3.0 specification for Team Scrapbook API.
 * Served at /api-docs (Swagger UI) and /api-docs.json (raw spec).
 */
export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Team Scrapbook API",
    description:
      "API REST do projeto Team Scrapbook — feed, usuários, autenticação e recursos temáticos TF2.",
    version: "0.0.1",
  },
  servers: [
    { url: "http://localhost:3000", description: "Desenvolvimento" },
  ],
  tags: [
    { name: "Health", description: "Saúde do serviço" },
    { name: "Auth", description: "Registro e login" },
    { name: "Users", description: "Usuário autenticado" },
    { name: "Feed", description: "Transmissão de campo (feed)" },
    { name: "Scraps", description: "Recados" },
    { name: "Communities", description: "Comunidades" },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        description: "Retorna o status do serviço e timestamp.",
        responses: {
          "200": {
            description: "Serviço em execução",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["status", "service", "timestamp"],
                  properties: {
                    status: { type: "string", example: "ok" },
                    service: { type: "string", example: "team-scrapbook-api" },
                    timestamp: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Registrar usuário",
        description: "Cria um novo usuário. Retorna o usuário e um token JWT.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "nickname", "password"],
                properties: {
                  name: { type: "string", description: "Nome do usuário" },
                  nickname: {
                    type: "string",
                    minLength: 2,
                    description: "Nickname único",
                  },
                  password: {
                    type: "string",
                    minLength: 6,
                    description: "Senha (mínimo 6 caracteres)",
                  },
                  team: {
                    type: "string",
                    enum: ["RED", "BLU"],
                    description: "Time (opcional)",
                  },
                  mainClass: {
                    type: "string",
                    enum: [
                      "Scout",
                      "Soldier",
                      "Pyro",
                      "Demoman",
                      "Heavy",
                      "Engineer",
                      "Medic",
                      "Sniper",
                      "Spy",
                    ],
                    description: "Classe principal TF2 (opcional)",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Usuário criado",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    user: { $ref: "#/components/schemas/User" },
                    token: { type: "string", description: "JWT para Authorization" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Dados inválidos ou nickname já em uso",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorMessage" },
              },
            },
          },
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login",
        description: "Autentica por nickname e senha. Retorna o usuário e um token JWT.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["nickname", "password"],
                properties: {
                  nickname: { type: "string" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Login realizado",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    user: { $ref: "#/components/schemas/User" },
                    token: { type: "string" },
                  },
                },
              },
            },
          },
          "401": {
            description: "Nickname ou senha inválidos",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorMessage" },
              },
            },
          },
          "400": {
            description: "Body inválido",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorMessage" },
              },
            },
          },
        },
      },
    },
    "/feed": {
      get: {
        tags: ["Feed"],
        summary: "Listar feed",
        description: "Retorna os itens do feed em ordem decrescente de data.",
        responses: {
          "200": {
            description: "Lista de itens do feed",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/FeedItem" },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Feed"],
        summary: "Publicar no feed",
        description: "Cria um novo post no feed. Requer autenticação.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["content"],
                properties: {
                  content: { type: "string", description: "Conteúdo do post" },
                  type: {
                    type: "string",
                    enum: ["post", "achievement", "community", "scrap"],
                    description: "Tipo do item (opcional, padrão: post)",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Post criado",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/FeedItem" },
              },
            },
          },
          "401": {
            description: "Não autorizado",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorMessage" },
              },
            },
          },
          "400": {
            description: "Body inválido",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorMessage" },
              },
            },
          },
        },
      },
    },
    "/scraps": {
      get: {
        tags: ["Scraps"],
        summary: "Listar recados",
        description: "Recados recebidos pelo usuário autenticado.",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Lista de recados",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/ScrapMessage" },
                },
              },
            },
          },
          "401": { description: "Não autorizado", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorMessage" } } } },
        },
      },
      post: {
        tags: ["Scraps"],
        summary: "Enviar recado",
        description: "Envia um recado para outro usuário.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["toUserId", "content"],
                properties: {
                  toUserId: { type: "string" },
                  content: { type: "string" },
                  reaction: { type: "string", enum: ["headshot", "heal", "burn", "backstab"] },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Recado criado", content: { "application/json": { schema: { $ref: "#/components/schemas/ScrapMessage" } } } },
          "401": { description: "Não autorizado", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorMessage" } } } },
          "400": { description: "Dados inválidos", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorMessage" } } } },
        },
      },
    },
    "/communities": {
      get: {
        tags: ["Communities"],
        summary: "Listar comunidades",
        description: "Lista todas as comunidades.",
        responses: {
          "200": {
            description: "Lista de comunidades",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Community" },
                },
              },
            },
          },
        },
      },
    },
    "/users/me": {
      get: {
        tags: ["Users"],
        summary: "Usuário atual",
        description: "Retorna o usuário autenticado. Requer token JWT no header Authorization.",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Dados do usuário",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/User" },
              },
            },
          },
          "401": {
            description: "Token ausente, inválido ou expirado",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorMessage" },
              },
            },
          },
        },
      },
    },
    "/users/friends": {
      get: {
        tags: ["Users"],
        summary: "Squad (lista de usuários)",
        description: "Lista outros usuários (excluindo o atual). Requer autenticação.",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Lista de usuários",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/User" },
                },
              },
            },
          },
          "401": { description: "Não autorizado", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorMessage" } } } },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Token retornado em /auth/register ou /auth/login",
      },
    },
    schemas: {
      User: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          nickname: { type: "string" },
          team: { type: "string", enum: ["RED", "BLU"] },
          mainClass: {
            type: "string",
            enum: [
              "Scout",
              "Soldier",
              "Pyro",
              "Demoman",
              "Heavy",
              "Engineer",
              "Medic",
              "Sniper",
              "Spy",
            ],
          },
          level: { type: "integer" },
          avatar: { type: "string" },
          achievements: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                title: { type: "string" },
                icon: { type: "string" },
                description: { type: "string" },
              },
            },
          },
          reputation: { type: "array", items: { type: "string" } },
          online: { type: "boolean" },
        },
      },
      ErrorMessage: {
        type: "object",
        properties: {
          message: { type: "string", description: "Mensagem de erro" },
        },
      },
      FeedItem: {
        type: "object",
        properties: {
          id: { type: "string" },
          user: { $ref: "#/components/schemas/User" },
          content: { type: "string" },
          timestamp: { type: "string", format: "date-time" },
          type: {
            type: "string",
            enum: ["post", "achievement", "community", "scrap"],
          },
        },
      },
      ScrapMessage: {
        type: "object",
        properties: {
          id: { type: "string" },
          from: { $ref: "#/components/schemas/User" },
          content: { type: "string" },
          timestamp: { type: "string", format: "date-time" },
          reaction: { type: "string", enum: ["headshot", "heal", "burn", "backstab"] },
        },
      },
      Community: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          members: { type: "integer" },
          dominantClass: { type: "string" },
          team: { type: "string", enum: ["RED", "BLU"] },
        },
      },
    },
  },
} as const;

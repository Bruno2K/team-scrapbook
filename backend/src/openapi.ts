/**
 * OpenAPI 3.0 specification for Team Scrapbook API.
 * Served at /api-docs (Swagger UI) and /api-docs.json (raw spec).
 *
 * Structural completeness is METHOD+PATH (+ documented auth). Nested response
 * views are proportional, not field-complete. Runtime remains authoritative.
 */
const bearer = [{ bearerAuth: [] }];

const errorMessage = {
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/ErrorMessage" },
    },
  },
};

const unauthorized = {
  "401": { description: "Bearer token ausente, inválido ou expirado", ...errorMessage },
};

const forbidden = {
  "403": { description: "Operação recusada pela política de autorização", ...errorMessage },
};

const badRequest = {
  "400": { description: "Pedido inválido", ...errorMessage },
};

const notFound = {
  "404": { description: "Recurso não encontrado", ...errorMessage },
};

const jsonBody = (schema: Record<string, unknown>, required = true) => ({
  required,
  content: { "application/json": { schema } },
});

const jsonOk = (description: string, schema?: Record<string, unknown>) => ({
  description,
  ...(schema
    ? { content: { "application/json": { schema } } }
    : { content: { "application/json": { schema: { type: "object" } } } }),
});

const pathId = (name: string, description: string) => ({
  in: "path" as const,
  name,
  required: true,
  schema: { type: "string" },
  description,
});

const optionalAuthNote =
  "Bearer JWT is optional. When present and valid, the response may include viewer-specific fields. Absence of Authorization is allowed.";

const tf2Class = [
  "Scout",
  "Soldier",
  "Pyro",
  "Demoman",
  "Heavy",
  "Engineer",
  "Medic",
  "Sniper",
  "Spy",
];

const attachmentSchema = {
  type: "object",
  additionalProperties: false,
  required: ["url", "type"],
  properties: {
    url: { type: "string", format: "uri" },
    type: { type: "string", enum: ["image", "video", "audio", "document"] },
    filename: { type: "string", maxLength: 255 },
  },
};

const reactionEnum = ["headshot", "heal", "burn", "backstab"];

function bearerGet(tag: string, summary: string, description: string, extraResponses: Record<string, unknown> = {}) {
  return {
    tags: [tag],
    summary,
    description,
    security: bearer,
    responses: {
      "200": jsonOk(summary),
      ...unauthorized,
      ...extraResponses,
    },
  };
}

function bearerMutate(
  tag: string,
  summary: string,
  description: string,
  options: {
    requestBody?: ReturnType<typeof jsonBody>;
    parameters?: unknown[];
    responses?: Record<string, unknown>;
    successStatus?: string;
  } = {}
) {
  const successStatus = options.successStatus ?? "200";
  return {
    tags: [tag],
    summary,
    description,
    security: bearer,
    ...(options.parameters ? { parameters: options.parameters } : {}),
    ...(options.requestBody ? { requestBody: options.requestBody } : {}),
    responses: {
      [successStatus]: jsonOk(summary),
      ...unauthorized,
      ...badRequest,
      ...forbidden,
      ...notFound,
      ...(options.responses ?? {}),
    },
  };
}

function optionalGet(tag: string, summary: string, description = optionalAuthNote) {
  return {
    tags: [tag],
    summary,
    description,
    security: [{}, { bearerAuth: [] }],
    responses: {
      "200": jsonOk(summary),
      ...notFound,
    },
  };
}

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Team Scrapbook API",
    description:
      "API REST do projeto Team Scrapbook. Runtime behavior is authoritative; this document covers the public HTTP METHOD+PATH surface. Swagger UI (/api-docs) and GET /api-docs.json are documentation surfaces excluded from product-route drift.",
    version: "0.0.1",
  },
  servers: [{ url: "http://localhost:3000", description: "Desenvolvimento" }],
  tags: [
    { name: "Health", description: "Saúde e métricas do processo" },
    { name: "Auth", description: "Registro e login" },
    { name: "Users", description: "Perfil, relações e Steam" },
    { name: "Notifications", description: "Notificações do usuário autenticado" },
    { name: "Feed", description: "Transmissão de campo (feed)" },
    { name: "Comments", description: "Comentários e reações" },
    { name: "Scraps", description: "Recados" },
    { name: "Communities", description: "Comunidades" },
    { name: "Uploads", description: "Upload para R2" },
    { name: "Chat", description: "Conversas HTTP" },
    { name: "AI", description: "Ações automatizadas" },
  ],
  paths: {
    "/metrics": {
      get: {
        tags: ["Health"],
        summary: "Process-local operational metrics",
        description:
          "Prometheus text exposition of this process only. Labels are bounded route templates and status classes. Request IDs and user identifiers are never used as labels.",
        responses: {
          "200": {
            description: "Prometheus text format",
            content: { "text/plain": { schema: { type: "string" } } },
          },
        },
      },
    },
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Process liveness",
        description:
          "Cheap process liveness only. Does not query PostgreSQL or external providers. Load balancers that need traffic readiness must use /health/ready.",
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
    "/health/ready": {
      get: {
        tags: ["Health"],
        summary: "Database readiness check",
        description:
          "Verifies that this API process can execute a bounded PostgreSQL SELECT 1. This is readiness, not liveness, and does not check Steam, Gemini, R2, or Socket.io.",
        responses: {
          "200": {
            description: "PostgreSQL is reachable",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["status", "service", "timestamp", "checks", "release"],
                  properties: {
                    status: { type: "string", example: "ready" },
                    service: { type: "string", example: "team-scrapbook-api" },
                    timestamp: { type: "string", format: "date-time" },
                    checks: {
                      type: "object",
                      properties: { database: { type: "string", example: "ready" } },
                    },
                    release: {
                      type: "object",
                      properties: {
                        gitSha: { type: "string", nullable: true },
                        deploymentId: { type: "string", nullable: true },
                      },
                    },
                  },
                },
              },
            },
          },
          "503": { description: "PostgreSQL is unavailable" },
        },
      },
    },
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Registrar usuário",
        description: "Cria um novo usuário. Retorna o usuário e um token JWT.",
        requestBody: jsonBody({
          type: "object",
          additionalProperties: false,
          required: ["name", "nickname", "password"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
            nickname: { type: "string", minLength: 2, maxLength: 100 },
            password: { type: "string", minLength: 6, maxLength: 200 },
            team: { type: "string", enum: ["RED", "BLU"] },
            mainClass: { type: "string", enum: tf2Class },
          },
        }),
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
          ...badRequest,
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login",
        description: "Autentica por nickname e senha. Retorna o usuário e um token JWT.",
        requestBody: jsonBody({
          type: "object",
          additionalProperties: false,
          required: ["nickname", "password"],
          properties: {
            nickname: { type: "string", minLength: 1, maxLength: 100 },
            password: { type: "string", minLength: 1, maxLength: 200 },
          },
        }),
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
          ...unauthorized,
          ...badRequest,
        },
      },
    },
    "/feed": {
      get: optionalGet("Feed", "Listar feed", `${optionalAuthNote} Itens em ordem decrescente de data.`),
      post: {
        tags: ["Feed"],
        summary: "Publicar no feed",
        description:
          "Cria um post. Conteúdo ou anexos são obrigatórios. type aceito pelo runtime: post | achievement (omissão trata como post).",
        security: bearer,
        requestBody: jsonBody({
          type: "object",
          additionalProperties: false,
          properties: {
            content: { type: "string", maxLength: 4000, default: "" },
            type: { type: "string", enum: ["post", "achievement"] },
            allowComments: { type: "boolean" },
            allowReactions: { type: "boolean" },
            attachments: { type: "array", maxItems: 5, items: attachmentSchema },
          },
        }),
        responses: {
          "201": { description: "Post criado", content: { "application/json": { schema: { $ref: "#/components/schemas/FeedItem" } } } },
          ...unauthorized,
          ...badRequest,
        },
      },
    },
    "/feed/{id}": {
      get: {
        ...optionalGet("Feed", "Obter post", `${optionalAuthNote} Inclui o post e comentários.`),
        parameters: [pathId("id", "ID do feed item ou scrap apresentado no feed")],
      },
      delete: bearerMutate("Feed", "Excluir post", "Exclui um post do autor autenticado.", {
        parameters: [pathId("id", "ID do feed item")],
      }),
    },
    "/feed/{id}/comments": {
      get: {
        ...optionalGet("Feed", "Listar comentários do post"),
        parameters: [pathId("id", "ID do feed item ou scrap")],
      },
      post: bearerMutate("Feed", "Comentar", "Cria um comentário no post.", {
        parameters: [pathId("id", "ID do feed item ou scrap")],
        successStatus: "201",
        requestBody: jsonBody({
          type: "object",
          additionalProperties: false,
          required: ["content"],
          properties: {
            content: { type: "string", minLength: 1, maxLength: 2000 },
            parentId: { type: "string", nullable: true },
          },
        }),
      }),
    },
    "/feed/{id}/reactions": {
      post: bearerMutate("Feed", "Reagir ao post", "Define a reação do usuário autenticado.", {
        parameters: [pathId("id", "ID do feed item ou scrap")],
        requestBody: jsonBody({
          type: "object",
          properties: { reaction: { type: "string", enum: reactionEnum } },
        }),
      }),
      delete: bearerMutate("Feed", "Remover reação do post", "Remove a reação do usuário autenticado.", {
        parameters: [pathId("id", "ID do feed item ou scrap")],
      }),
    },
    "/comments/{commentId}": {
      delete: bearerMutate("Comments", "Excluir comentário", "Exclui um comentário próprio ou com permissão.", {
        parameters: [pathId("commentId", "ID do comentário")],
      }),
    },
    "/comments/{commentId}/reactions": {
      post: bearerMutate("Comments", "Reagir ao comentário", "Define a reação do usuário autenticado.", {
        parameters: [pathId("commentId", "ID do comentário")],
        requestBody: jsonBody({
          type: "object",
          properties: { reaction: { type: "string", enum: reactionEnum } },
        }),
      }),
      delete: bearerMutate("Comments", "Remover reação do comentário", "Remove a reação do usuário autenticado.", {
        parameters: [pathId("commentId", "ID do comentário")],
      }),
    },
    "/scraps": {
      get: {
        tags: ["Scraps"],
        summary: "Listar recados",
        description:
          "Lista recados do usuário autenticado. Query filter=received|sent|all. Omissão de filter usa received. O default de runtime não foi alterado.",
        security: bearer,
        parameters: [
          {
            in: "query",
            name: "filter",
            required: false,
            schema: { type: "string", enum: ["received", "sent", "all"] },
            description: "received is the default when omitted or invalid.",
          },
        ],
        responses: {
          "200": {
            description: "Lista de recados",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/ScrapMessage" } } } },
          },
          ...unauthorized,
        },
      },
      post: {
        tags: ["Scraps"],
        summary: "Enviar recado",
        description: "Envia um recado. Conteúdo ou anexos são obrigatórios.",
        security: bearer,
        requestBody: jsonBody({
          type: "object",
          additionalProperties: false,
          required: ["toUserId"],
          properties: {
            toUserId: { type: "string", minLength: 1 },
            content: { type: "string", maxLength: 4000, default: "" },
            reaction: { type: "string", enum: reactionEnum },
            attachments: { type: "array", maxItems: 5, items: attachmentSchema },
          },
        }),
        responses: {
          "201": {
            description: "Recado criado",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ScrapMessage" } } },
          },
          ...unauthorized,
          ...badRequest,
          ...forbidden,
        },
      },
    },
    "/communities": {
      get: optionalGet("Communities", "Listar comunidades"),
      post: bearerMutate("Communities", "Criar comunidade", "Cria uma comunidade.", {
        successStatus: "201",
        requestBody: jsonBody({
          type: "object",
          required: ["name", "description"],
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            isPrivate: { type: "boolean" },
            dominantClass: { type: "string" },
            team: { type: "string", enum: ["RED", "BLU"] },
          },
        }),
      }),
    },
    "/communities/recommendations": {
      get: optionalGet("Communities", "Comunidades recomendadas"),
    },
    "/communities/hype": {
      get: optionalGet("Communities", "Comunidades em evidência"),
    },
    "/communities/invites/me": {
      get: bearerGet("Communities", "Convites pendentes do usuário", "Lista convites pendentes do autenticado."),
    },
    "/communities/{id}": {
      get: {
        ...optionalGet("Communities", "Obter comunidade"),
        parameters: [pathId("id", "ID da comunidade")],
      },
      patch: bearerMutate("Communities", "Atualizar comunidade", "Atualiza campos da comunidade. Requer permissão de gestão.", {
        parameters: [pathId("id", "ID da comunidade")],
        requestBody: jsonBody(
          {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              isPrivate: { type: "boolean" },
              dominantClass: { type: "string", nullable: true },
              team: { type: "string", nullable: true, enum: ["RED", "BLU"] },
            },
          },
          false
        ),
      }),
      delete: bearerMutate("Communities", "Excluir comunidade", "Exclui a comunidade. Requer permissão de gestão.", {
        parameters: [pathId("id", "ID da comunidade")],
      }),
    },
    "/communities/{id}/members": {
      get: {
        ...optionalGet("Communities", "Listar membros"),
        parameters: [pathId("id", "ID da comunidade")],
      },
    },
    "/communities/{id}/posts": {
      get: {
        ...optionalGet("Communities", "Listar posts da comunidade"),
        parameters: [pathId("id", "ID da comunidade")],
      },
      post: bearerMutate("Communities", "Publicar na comunidade", "Membros podem publicar. Conteúdo ou anexos são obrigatórios.", {
        parameters: [pathId("id", "ID da comunidade")],
        successStatus: "201",
        requestBody: jsonBody({
          type: "object",
          properties: {
            content: { type: "string" },
            allowComments: { type: "boolean" },
            allowReactions: { type: "boolean" },
            attachments: { type: "array", items: attachmentSchema },
          },
        }),
      }),
    },
    "/communities/{id}/invites": {
      get: {
        ...bearerGet("Communities", "Listar convites da comunidade", "Requer permissão de gestão."),
        parameters: [pathId("id", "ID da comunidade")],
      },
      post: bearerMutate("Communities", "Convidar membro", "Cria um convite.", {
        parameters: [pathId("id", "ID da comunidade")],
        requestBody: jsonBody({
          type: "object",
          properties: { inviteeId: { type: "string" } },
        }),
      }),
    },
    "/communities/{id}/join-request": {
      get: {
        ...bearerGet("Communities", "Solicitação de entrada pendente", "Retorna pending true|false para o autenticado."),
        parameters: [pathId("id", "ID da comunidade")],
      },
      post: bearerMutate("Communities", "Solicitar entrada", "Cria solicitação em comunidade privada.", {
        parameters: [pathId("id", "ID da comunidade")],
        successStatus: "201",
      }),
    },
    "/communities/{id}/join-requests": {
      get: {
        ...bearerGet("Communities", "Listar solicitações de entrada", "Requer permissão de gestão."),
        parameters: [pathId("id", "ID da comunidade")],
      },
    },
    "/communities/{id}/join": {
      post: bearerMutate("Communities", "Entrar na comunidade", "Entra em comunidade pública, ou aceita via regras existentes.", {
        parameters: [pathId("id", "ID da comunidade")],
      }),
    },
    "/communities/{id}/leave": {
      delete: bearerMutate("Communities", "Sair da comunidade", "Remove a associação do autenticado.", {
        parameters: [pathId("id", "ID da comunidade")],
      }),
    },
    "/communities/{id}/invites/{inviteId}": {
      patch: bearerMutate("Communities", "Responder convite", "action: accept | decline.", {
        parameters: [pathId("id", "ID da comunidade"), pathId("inviteId", "ID do convite")],
        requestBody: jsonBody({
          type: "object",
          required: ["action"],
          properties: { action: { type: "string", enum: ["accept", "decline"] } },
        }),
      }),
    },
    "/communities/{id}/join-requests/{requestId}": {
      patch: bearerMutate("Communities", "Decidir solicitação de entrada", "action: approve | reject.", {
        parameters: [pathId("id", "ID da comunidade"), pathId("requestId", "ID da solicitação")],
        requestBody: jsonBody({
          type: "object",
          required: ["action"],
          properties: { action: { type: "string", enum: ["approve", "reject"] } },
        }),
      }),
    },
    "/communities/{id}/members/{userId}": {
      delete: bearerMutate("Communities", "Remover membro", "Remove um membro. Requer permissão de gestão.", {
        parameters: [pathId("id", "ID da comunidade"), pathId("userId", "ID do usuário")],
      }),
    },
    "/communities/{id}/members/{userId}/role": {
      patch: bearerMutate("Communities", "Alterar papel do membro", "role: MEMBER | MODERATOR | ADMIN.", {
        parameters: [pathId("id", "ID da comunidade"), pathId("userId", "ID do usuário")],
        requestBody: jsonBody({
          type: "object",
          required: ["role"],
          properties: { role: { type: "string", enum: ["MEMBER", "MODERATOR", "ADMIN"] } },
        }),
      }),
    },
    "/chat/conversations": {
      get: bearerGet("Chat", "Listar conversas", "Lista conversas do autenticado."),
      post: bearerMutate("Chat", "Criar ou obter conversa", "Cria (ou reutiliza) conversa 1:1. Apenas amigos.", {
        successStatus: "201",
        requestBody: jsonBody({
          type: "object",
          additionalProperties: false,
          required: ["otherUserId"],
          properties: { otherUserId: { type: "string", minLength: 1, maxLength: 128 } },
        }),
      }),
    },
    "/chat/conversations/{conversationId}/messages": {
      get: {
        ...bearerGet("Chat", "Listar mensagens", "Paginação por limit e before."),
        parameters: [
          pathId("conversationId", "ID da conversa"),
          {
            in: "query",
            name: "limit",
            required: false,
            schema: { type: "integer", default: 50, maximum: 100 },
          },
          { in: "query", name: "before", required: false, schema: { type: "string" } },
        ],
      },
    },
    "/chat/messages": {
      post: {
        tags: ["Chat"],
        summary: "Enviar mensagem",
        description:
          "Persiste a mensagem e a atividade da conversa atomicamente. Repetições HTTP podem reutilizar a mesma Idempotency-Key; a entrega em tempo real e a notificação são pós-commit e best effort.",
        security: bearer,
        parameters: [
          {
            in: "header",
            name: "Idempotency-Key",
            required: false,
            schema: { type: "string", minLength: 1, maxLength: 128, pattern: "^[!-~]+$" },
            description:
              "Chave opcional, escopada ao remetente e retida sem expiração. A mesma chave e payload retornam a mensagem original; payload diferente retorna 409.",
          },
        ],
        requestBody: jsonBody({
          type: "object",
          required: ["conversationId"],
          additionalProperties: false,
          properties: {
            conversationId: { type: "string", minLength: 1, maxLength: 128 },
            content: { type: "string", nullable: true, maxLength: 4000 },
            type: { type: "string", enum: ["TEXT", "AUDIO", "VIDEO", "DOCUMENT"] },
            attachments: { type: "array", maxItems: 5, items: attachmentSchema },
          },
        }),
        responses: {
          "201": { description: "Nova mensagem criada" },
          "200": { description: "Repetição idempotente; mensagem original retornada" },
          ...badRequest,
          ...forbidden,
          "409": { description: "Idempotency-Key reutilizada com outro payload" },
          ...unauthorized,
        },
      },
    },
    "/upload/presign": {
      post: bearerMutate("Uploads", "URL pré-assinada", "Prepara upload para R2.", {
        requestBody: jsonBody({
          type: "object",
          additionalProperties: false,
          required: ["filename", "contentType", "kind"],
          properties: {
            filename: { type: "string", minLength: 1, maxLength: 255 },
            contentType: { type: "string", minLength: 1, maxLength: 255 },
            kind: { type: "string", enum: ["feed", "scrap", "avatar", "chat"] },
          },
        }),
        responses: {
          "503": { description: "R2 não configurado", ...errorMessage },
        },
      }),
    },
    "/upload/file": {
      post: {
        tags: ["Uploads"],
        summary: "Upload via proxy",
        description: "Body raw do arquivo. Query kind e header X-Upload-Filename. Evita CORS do browser com R2.",
        security: bearer,
        parameters: [
          {
            in: "query",
            name: "kind",
            required: false,
            schema: { type: "string", enum: ["feed", "scrap", "avatar", "chat"] },
          },
          {
            in: "header",
            name: "X-Upload-Filename",
            required: false,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: { "application/octet-stream": { schema: { type: "string", format: "binary" } } },
        },
        responses: {
          "200": jsonOk("Upload concluído"),
          ...unauthorized,
          ...badRequest,
          "503": { description: "R2 não configurado", ...errorMessage },
        },
      },
    },
    "/ai-actions/generate": {
      post: {
        tags: ["AI"],
        summary: "Gerar ações automatizadas",
        description:
          "Product route mounted at /ai-actions/generate. A human authenticated session currently receives 403; the route is not removed. Missing bearer token returns 401.",
        security: bearer,
        responses: {
          ...unauthorized,
          "403": {
            description: "Ações automatizadas não estão disponíveis para sessões de usuário.",
            ...errorMessage,
          },
        },
      },
    },
    "/users/me": {
      get: bearerGet("Users", "Usuário atual", "Retorna o usuário autenticado."),
      patch: bearerMutate("Users", "Atualizar perfil", "Atualiza campos permitidos do próprio perfil.", {
        requestBody: jsonBody(
          {
            type: "object",
            properties: {
              avatar: { type: "string", nullable: true },
              name: { type: "string" },
              nickname: { type: "string" },
              birthDate: { type: "string", nullable: true },
              gender: { type: "string", nullable: true },
              favoriteMap: { type: "string", nullable: true },
              playstyle: { type: "string", nullable: true },
              quote: { type: "string", nullable: true },
              country: { type: "string", nullable: true },
              bio: { type: "string", nullable: true },
            },
          },
          false
        ),
      }),
    },
    "/users/me/feed": {
      get: bearerGet("Users", "Feed do perfil autenticado", "Posts do próprio usuário."),
    },
    "/users/me/pinned-achievements": {
      patch: bearerMutate("Users", "Fixar conquistas", "Define achievementIds pinados.", {
        requestBody: jsonBody({
          type: "object",
          required: ["achievementIds"],
          properties: { achievementIds: { type: "array", items: { type: "string" } } },
        }),
      }),
    },
    "/users/me/pinned-posts": {
      patch: bearerMutate("Users", "Fixar posts", "Define até 3 pinnedPostIds próprios.", {
        requestBody: jsonBody({
          type: "object",
          required: ["pinnedPostIds"],
          properties: { pinnedPostIds: { type: "array", items: { type: "string" } } },
        }),
      }),
    },
    "/users/friends": {
      get: bearerGet(
        "Users",
        "Amigos do usuário autenticado",
        "Retorna os amigos do usuário autenticado — não uma lista geral de outros usuários."
      ),
      post: bearerMutate("Users", "Adicionar amigo / enviar pedido", "Cria pedido de amizade.", {
        requestBody: jsonBody({
          type: "object",
          properties: { userId: { type: "string" } },
        }),
      }),
    },
    "/users/me/friend-requests": {
      get: bearerGet("Users", "Pedidos de amizade recebidos", "Lista pedidos pendentes recebidos."),
    },
    "/users/me/friend-requests/{requestId}/accept": {
      post: bearerMutate("Users", "Aceitar pedido de amizade", "Aceita um pedido recebido.", {
        parameters: [pathId("requestId", "ID do pedido")],
      }),
    },
    "/users/me/friend-requests/{requestId}/decline": {
      post: bearerMutate("Users", "Recusar pedido de amizade", "Recusa um pedido recebido.", {
        parameters: [pathId("requestId", "ID do pedido")],
      }),
    },
    "/users/blocked": {
      get: bearerGet("Users", "Usuários bloqueados", "Lista bloqueios do autenticado."),
    },
    "/users/available": {
      get: {
        ...bearerGet("Users", "Usuários disponíveis para adicionar", "Busca opcional por query search."),
        parameters: [{ in: "query", name: "search", required: false, schema: { type: "string" } }],
      },
    },
    "/users/recommendations": {
      get: bearerGet("Users", "Recomendações de amizade", "Sugestões de usuários."),
    },
    "/users/friends/{userId}": {
      delete: bearerMutate("Users", "Remover amigo", "Remove a amizade.", {
        parameters: [pathId("userId", "ID do amigo")],
      }),
    },
    "/users/{userId}/block": {
      post: bearerMutate("Users", "Bloquear usuário", "Bloqueia o usuário.", {
        parameters: [pathId("userId", "ID do usuário")],
      }),
      delete: bearerMutate("Users", "Desbloquear usuário", "Remove o bloqueio.", {
        parameters: [pathId("userId", "ID do usuário")],
      }),
    },
    "/users/me/steam-link": {
      post: bearerMutate("Users", "Vincular Steam por ID", "Body steamId64 ou vanityUrl.", {
        requestBody: jsonBody({
          type: "object",
          properties: {
            steamId64: { type: "string" },
            vanityUrl: { type: "string" },
          },
        }),
        responses: {
          "503": { description: "Integração Steam não configurada", ...errorMessage },
        },
      }),
    },
    "/users/me/steam/auth-url": {
      post: bearerMutate("Users", "URL OpenID Steam", "Devolve URL do provedor. O access token não vai na query do SPA.", {
        responses: {
          "503": { description: "Integração Steam indisponível", ...errorMessage },
        },
      }),
    },
    "/users/me/steam/callback": {
      get: {
        tags: ["Users"],
        summary: "Callback OpenID Steam",
        description:
          "Not a bearer JSON endpoint. Accepts purpose-bound link_token query parameter issued for steam-link, completes Steam OpenID, then redirects the browser to the SPA settings page with steam_link=ok|error and optional message. Do not send Authorization; query tokens are not session JWTs.",
        parameters: [
          {
            in: "query",
            name: "link_token",
            required: false,
            schema: { type: "string" },
            description:
              "Purpose-bound steam-link token. Missing or invalid tokens still 302-redirect to the SPA with steam_link=error; this is not a JSON 400/401 endpoint.",
          },
        ],
        responses: {
          "302": {
            description:
              "Redirect to {CORS_ORIGIN}/settings?steam_link=ok or steam_link=error&message=... Missing token, invalid/expired token, Steam verification failure, or Steam ID already linked all redirect rather than returning JSON.",
            headers: {
              Location: {
                schema: { type: "string", format: "uri" },
              },
            },
          },
        },
      },
    },
    "/users/me/steam/unlink": {
      post: bearerMutate("Users", "Desvincular Steam", "Remove Steam ID e dados sincronizados."),
    },
    "/users/me/steam/sync": {
      post: bearerMutate("Users", "Sincronizar Steam", "Sincroniza jogos e conquistas.", {
        responses: {
          "503": { description: "Integração Steam indisponível", ...errorMessage },
        },
      }),
    },
    "/users/me/notifications": {
      get: {
        ...bearerGet("Notifications", "Listar notificações", "Notificações do autenticado. Query de paginação existente no runtime."),
        parameters: [
          { in: "query", name: "unreadOnly", required: false, schema: { type: "string", enum: ["true"] } },
          { in: "query", name: "cursor", required: false, schema: { type: "string" } },
          { in: "query", name: "limit", required: false, schema: { type: "integer" } },
        ],
      },
    },
    "/users/me/notifications/read-all": {
      patch: bearerMutate("Notifications", "Marcar todas como lidas", "Marca todas as notificações do autenticado."),
    },
    "/users/me/notifications/{id}/read": {
      patch: bearerMutate("Notifications", "Marcar notificação como lida", "Marca uma notificação.", {
        parameters: [pathId("id", "ID da notificação")],
      }),
    },
    "/users/{userId}/feed": {
      get: {
        ...optionalGet("Users", "Feed público do usuário"),
        parameters: [pathId("userId", "ID do usuário")],
      },
    },
    "/users/{userId}/friends": {
      get: {
        ...optionalGet("Users", "Amigos públicos do usuário"),
        parameters: [pathId("userId", "ID do usuário")],
      },
    },
    "/users/{userId}/communities": {
      get: {
        ...optionalGet("Users", "Comunidades públicas do usuário"),
        parameters: [pathId("userId", "ID do usuário")],
      },
    },
    "/users/{userId}/media": {
      get: {
        ...optionalGet("Users", "Mídia pública do usuário"),
        parameters: [pathId("userId", "ID do usuário")],
      },
    },
    "/users/{userId}": {
      get: {
        ...optionalGet("Users", "Perfil público do usuário"),
        parameters: [pathId("userId", "ID do usuário")],
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description:
          "Token retornado em /auth/register ou /auth/login. Envie somente no header Authorization; tokens de sessão em query string não são aceitos. Optional-auth GET routes omit this requirement.",
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
          mainClass: { type: "string", enum: tf2Class },
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
          type: { type: "string" },
        },
      },
      ScrapMessage: {
        type: "object",
        properties: {
          id: { type: "string" },
          from: { $ref: "#/components/schemas/User" },
          content: { type: "string" },
          timestamp: { type: "string", format: "date-time" },
          reaction: { type: "string", enum: reactionEnum },
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
};

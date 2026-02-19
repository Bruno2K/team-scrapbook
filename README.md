# 🎮 Team Scrapbook

<div align="center">

![Team Scrapbook](https://img.shields.io/badge/Status-Em%20Desenvolvimento-yellow)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)
![React](https://img.shields.io/badge/React-18.3-61dafb)
![Node.js](https://img.shields.io/badge/Node.js-Express-green)

**Uma rede social temática inspirada em Team Fortress 2, onde jogadores compartilham conquistas, formam comunidades e interagem em tempo real.**

[Funcionalidades](#-funcionalidades) • [Tecnologias](#-tecnologias) • [Instalação](#-instalação) • [Deploy](#-deploy) • [API](#-api-e-documentação)

</div>

---

## 📖 Sobre o Projeto

**Team Scrapbook** é uma aplicação web full-stack que simula uma rede social para a comunidade de Team Fortress 2. O projeto demonstra habilidades avançadas em desenvolvimento web moderno, incluindo comunicação em tempo real, integração com APIs externas (Steam), gerenciamento de estado complexo e arquitetura escalável.

### 🎯 Objetivos do Projeto

- Demonstrar proficiência em desenvolvimento full-stack moderno
- Implementar funcionalidades complexas como chat em tempo real e integração com serviços externos
- Aplicar boas práticas de arquitetura de software e padrões de design
- Criar uma experiência de usuário rica e responsiva

---

## ✨ Funcionalidades

### 🔐 Autenticação e Perfil
- **Sistema de autenticação JWT** com hash de senha (bcrypt)
- **Perfis personalizáveis** com informações do jogador (time, classe principal, nível)
- **Integração Steam** via OpenID e Steam Web API
  - Vinculação de conta Steam
  - Sincronização automática de jogos e conquistas
  - Exibição de estatísticas de gameplay
- **Gerenciamento de avatar** e informações pessoais

### 📱 Feed Social
- **Feed dinâmico** com posts, conquistas e eventos de comunidades
- **Sistema de reações** temáticas (headshot, heal, burn, backstab)
- **Comentários aninhados** com respostas em threads
- **Upload de mídia** (imagens, GIFs via Giphy API)
- **Filtros e busca** por conteúdo

### 💬 Chat em Tempo Real
- **Comunicação instantânea** via WebSocket (Socket.io)
- **Indicadores de digitação** em tempo real
- **Suporte a múltiplos tipos de mensagem** (texto, áudio, vídeo, documentos)
- **Anexos de mídia** nas conversas
- **Notificações push** para novas mensagens
- **Chat com IA** usando Google Gemini para respostas automáticas de usuários gerenciados por IA

### 📝 Sistema de Scraps (Recados)
- **Envio de recados** entre usuários
- **Reações personalizadas** nos scraps
- **Comentários** em scraps
- **Histórico completo** de interações

### 👥 Sistema Social
- **Sistema de amizades** com solicitações e aprovações
- **Bloqueio de usuários**
- **Sistema de notificações** em tempo real
  - Notificações de scraps
  - Solicitações de amizade
  - Convites para comunidades
  - Mensagens de chat
- **Status online/offline** em tempo real

### 🏰 Comunidades
- **Criação e gerenciamento** de comunidades públicas/privadas
- **Sistema de roles** (Membro, Moderador, Admin)
- **Convites e solicitações** de entrada
- **Feed específico** por comunidade
- **Estatísticas** de membros e atividades

### 🤖 Recursos com IA
- **Geração automática de conteúdo** usando Google Gemini API
- **Usuários gerenciados por IA** que interagem automaticamente
- **Respostas inteligentes** no chat

### 📊 Outros Recursos
- **Tema claro/escuro** com persistência
- **Interface responsiva** e acessível
- **Validação de formulários** com Zod e React Hook Form
- **Gerenciamento de estado** com TanStack Query (React Query)
- **Tratamento de erros** robusto com Error Boundaries

---

## 🛠 Tecnologias

### Frontend
- **React 18.3** - Biblioteca UI moderna
- **TypeScript 5.8** - Tipagem estática
- **Vite 5.4** - Build tool e dev server ultra-rápido
- **React Router 6** - Roteamento SPA
- **TanStack Query 5** - Gerenciamento de estado servidor e cache
- **React Hook Form 7** - Formulários performáticos
- **Zod 3** - Validação de schemas TypeScript-first
- **Socket.io Client 4** - Cliente WebSocket para comunicação em tempo real

### UI/UX
- **shadcn/ui** - Componentes acessíveis baseados em Radix UI
- **Radix UI** - Primitivos acessíveis e sem estilo
- **Tailwind CSS 3** - Framework CSS utility-first
- **Lucide React** - Ícones modernos
- **Recharts** - Visualizações de dados
- **Sonner** - Sistema de notificações toast elegante
- **next-themes** - Gerenciamento de tema claro/escuro

### Backend
- **Node.js** - Runtime JavaScript
- **Express 4** - Framework web minimalista
- **TypeScript** - Tipagem estática no backend
- **Prisma 6** - ORM moderno e type-safe
- **Socket.io 4** - Servidor WebSocket para comunicação em tempo real
- **JWT** - Autenticação baseada em tokens
- **bcryptjs** - Hash de senhas seguro

### Banco de Dados
- **SQLite** (desenvolvimento) / **PostgreSQL** (produção)
- **Prisma Migrations** - Versionamento de schema

### APIs e Integrações
- **Steam Web API** - Integração com Steam (jogos, conquistas, perfis)
- **Steam OpenID** - Autenticação via Steam
- **Google Gemini API** - Geração de conteúdo com IA
- **Giphy API** - Busca e integração de GIFs
- **AWS S3 / Cloudflare R2** - Armazenamento de arquivos

### Ferramentas de Desenvolvimento
- **Vitest** - Framework de testes
- **ESLint** - Linter para qualidade de código
- **OpenAPI 3.0 / Swagger** - Documentação automática da API
- **Git** - Controle de versão

### DevOps e Deploy
- **Vercel** - Deploy do frontend
- **Railway / Render** - Deploy do backend
- **PostgreSQL** - Banco de dados em produção

---

## 🏗 Arquitetura

```
team-scrapbook/
├── src/                    # Frontend React
│   ├── api/               # Clientes API e hooks
│   ├── components/        # Componentes React reutilizáveis
│   │   ├── ui/           # Componentes base (shadcn/ui)
│   │   ├── chat/         # Componentes de chat
│   │   ├── feed/         # Componentes do feed
│   │   ├── profile/      # Componentes de perfil
│   │   └── ...
│   ├── contexts/         # Contextos React (Chat, etc)
│   ├── hooks/            # Custom hooks
│   ├── lib/              # Utilitários e helpers
│   ├── pages/            # Páginas/rotas da aplicação
│   └── App.tsx           # Componente raiz
│
├── backend/               # Backend Express
│   ├── src/
│   │   ├── controllers/  # Lógica de negócio (MVC)
│   │   ├── routes/       # Definição de rotas
│   │   ├── services/     # Serviços e lógica de negócio
│   │   ├── middleware/  # Middlewares (auth, etc)
│   │   ├── views/        # Serialização de dados
│   │   ├── db/           # Configuração Prisma
│   │   ├── socket.ts     # Configuração Socket.io
│   │   ├── openapi.ts    # Especificação OpenAPI
│   │   └── index.ts      # Entry point
│   └── prisma/
│       ├── schema.prisma # Schema do banco
│       └── migrations/   # Migrações do banco
│
└── vercel.json           # Configuração de deploy
```

### Padrões e Práticas

- **Arquitetura MVC** no backend
- **Separation of Concerns** - Separação clara de responsabilidades
- **Type Safety** - TypeScript em todo o projeto
- **API RESTful** - Endpoints seguindo convenções REST
- **WebSocket** - Comunicação bidirecional em tempo real
- **Error Handling** - Tratamento robusto de erros
- **Validation** - Validação de dados com Zod
- **Documentation** - API documentada com OpenAPI/Swagger

---

## 🚀 Instalação

### Pré-requisitos

- **Node.js** 18+ e npm
- **Git**

### Passo a Passo

1. **Clone o repositório**
   ```bash
   git clone https://github.com/seu-usuario/team-scrapbook.git
   cd team-scrapbook
   ```

2. **Instale as dependências**
   ```bash
   npm install
   cd backend && npm install && cd ..
   ```

3. **Configure as variáveis de ambiente**

   Crie um arquivo `.env` na raiz:
   ```env
   VITE_API_URL=http://localhost:3000
   ```

   Crie um arquivo `backend/.env`:
   ```env
   DATABASE_URL="file:./dev.db"
   PORT=3000
   CORS_ORIGIN="http://localhost:8080"
   JWT_SECRET=seu-secret-super-seguro-aqui
   ```

   **Opcional** (para funcionalidades completas):
   ```env
   # Steam
   STEAM_WEB_API_KEY=sua-chave-steam
   BACKEND_URL=http://localhost:3000
   
   # Google Gemini (para IA)
   GEMINI_API_KEY=sua-chave-gemini
   GEMINI_MODEL=gemini-2.0-flash
   
   # Upload de arquivos (AWS S3 ou Cloudflare R2)
   R2_ACCOUNT_ID=...
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...
   R2_BUCKET=scrapbook
   R2_PUBLIC_BASE_URL=https://cdn.example.com
   
   # Giphy (para busca de GIFs)
   VITE_GIPHY_API_KEY=sua-chave-giphy
   ```

4. **Configure o banco de dados**
   ```bash
   cd backend
   npx prisma generate
   npx prisma migrate dev
   npx prisma db seed  # Opcional: dados iniciais
   cd ..
   ```

5. **Inicie o servidor de desenvolvimento**

   **Terminal 1 - Backend:**
   ```bash
   npm run dev:api
   ```

   **Terminal 2 - Frontend:**
   ```bash
   npm run dev
   ```

6. **Acesse a aplicação**
   - Frontend: http://localhost:8080
   - Backend API: http://localhost:3000
   - Swagger UI: http://localhost:3000/api-docs

---

## 📚 API e Documentação

### Swagger/OpenAPI

A API está totalmente documentada usando OpenAPI 3.0. Quando o backend estiver rodando, acesse:

- **Swagger UI**: http://localhost:3000/api-docs
- **Especificação JSON**: http://localhost:3000/api-docs.json

### Principais Endpoints

#### Autenticação
- `POST /auth/register` - Registrar novo usuário
- `POST /auth/login` - Login e obter token JWT

#### Usuários
- `GET /users/me` - Obter perfil do usuário autenticado
- `PUT /users/me` - Atualizar perfil
- `POST /users/me/steam/link` - Vincular conta Steam
- `GET /users/me/steam/auth` - Autenticação Steam (redirect)
- `POST /users/me/steam/sync` - Sincronizar dados Steam

#### Feed
- `GET /feed` - Listar posts do feed
- `POST /feed` - Criar novo post
- `GET /feed/:id` - Obter post específico
- `POST /feed/:id/comments` - Comentar em post
- `POST /feed/:id/reactions` - Reagir a post

#### Scraps
- `GET /scraps` - Listar scraps recebidos
- `POST /scraps` - Enviar scrap
- `GET /scraps/:id` - Obter scrap específico

#### Comunidades
- `GET /communities` - Listar comunidades
- `POST /communities` - Criar comunidade
- `GET /communities/:id` - Obter comunidade específica
- `POST /communities/:id/join` - Entrar em comunidade
- `POST /communities/:id/invite` - Convidar usuário

#### Chat
- `GET /chat/conversations` - Listar conversas
- `GET /chat/conversations/:id/messages` - Obter mensagens
- `POST /chat/conversations/:id/messages` - Enviar mensagem
- **WebSocket**: Conexão via Socket.io para mensagens em tempo real

---

## 🚢 Deploy

### Frontend (Vercel)

1. Conecte seu repositório no [Vercel](https://vercel.com)
2. Configure a variável de ambiente `VITE_API_URL` apontando para seu backend
3. Deploy automático a cada push

Veja o guia completo em [`DEPLOY-PT.md`](./DEPLOY-PT.md)

### Backend (Railway/Render)

O backend requer uma plataforma que suporte WebSockets persistentes. Recomendamos:

- **Railway** (recomendado) - Suporte nativo a WebSockets
- **Render** - Alternativa com suporte a WebSockets

**Importante**: Para produção, atualize o `backend/prisma/schema.prisma` para usar PostgreSQL:

```prisma
datasource db {
  provider = "postgresql"  // Mude de "sqlite"
  url      = env("DATABASE_URL")
}
```

Veja instruções detalhadas em [`DEPLOY.md`](./DEPLOY.md) (inglês) ou [`DEPLOY-PT.md`](./DEPLOY-PT.md) (português).

---

## 🧪 Testes

```bash
# Executar testes
npm test

# Modo watch
npm run test:watch
```

---

## 📝 Scripts Disponíveis

### Frontend
- `npm run dev` - Inicia servidor de desenvolvimento
- `npm run build` - Build para produção
- `npm run preview` - Preview do build de produção
- `npm run lint` - Executa ESLint

### Backend
- `npm run dev:api` - Inicia backend em modo desenvolvimento
- `cd backend && npm run build` - Compila TypeScript
- `cd backend && npm start` - Inicia backend em produção

### Banco de Dados
- `cd backend && npx prisma studio` - Abre Prisma Studio (GUI do banco)
- `cd backend && npx prisma migrate dev` - Cria nova migração
- `cd backend && npx prisma generate` - Gera Prisma Client

---

## 🎨 Demonstração

### Funcionalidades em Destaque

- ✅ **Chat em tempo real** com Socket.io
- ✅ **Integração Steam** completa (OpenID + Web API)
- ✅ **Sistema de notificações** em tempo real
- ✅ **Upload de mídia** com preview
- ✅ **Interface responsiva** e acessível
- ✅ **Tema claro/escuro**
- ✅ **Validação robusta** de formulários
- ✅ **API documentada** com Swagger

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para:

1. Fazer fork do projeto
2. Criar uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abrir um Pull Request

---

## 📄 Licença

Este projeto é um projeto de portfólio e está disponível para fins educacionais e de demonstração.

---

## 👤 Autor

**Seu Nome**

- GitHub: [@seu-usuario](https://github.com/Bruno2K)
- LinkedIn: [Seu Perfil](https://www.linkedin.com/in/bruno-patrick-a70a5115a/)
- Email: 

---

## 🙏 Agradecimentos

- Comunidade Team Fortress 2 pela inspiração
- Todos os mantenedores das bibliotecas open-source utilizadas
- shadcn pela excelente coleção de componentes

---

<div align="center">

⭐ Se este projeto foi útil, considere dar uma estrela!

</div>

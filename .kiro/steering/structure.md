# Project Structure

## Root Directory Layout

```
skypanelv2/
├── api/                    # Express.js backend application
├── src/                    # React frontend application
├── migrations/             # Database schema migrations
├── scripts/                # Utility scripts for operations
├── public/                 # Static assets (favicon, logos)
├── repo-docs/              # Feature documentation and guides
├── dist/                   # Built frontend assets (generated)
└── node_modules/           # Dependencies (generated)
```

## Backend Structure (`api/`)

```
api/
├── app.ts                  # Main Express application setup
├── server.ts               # Server startup and process management
├── index.ts                # Vercel serverless entry point
├── config/                 # Configuration management
├── lib/                    # Database and utility libraries
├── middleware/             # Express middleware (auth, rate limiting)
├── routes/                 # API route handlers
└── services/               # Business logic and external integrations
```

### Key Backend Patterns
- **Routes**: RESTful API endpoints organized by feature (`/api/vps`, `/api/billing`)
- **Services**: Business logic abstraction for external APIs and complex operations
- **Middleware**: Reusable request processing (authentication, rate limiting, CORS)
- **Database**: Centralized query interface with transaction support

## Frontend Structure (`src/`)

```
src/
├── App.tsx                 # Main application component and routing
├── main.tsx                # React application entry point
├── index.css               # Global styles and Tailwind imports
├── components/             # Reusable UI components
├── contexts/               # React context providers (auth, theme)
├── hooks/                  # Custom React hooks
├── lib/                    # Utilities and API client
├── pages/                  # Route components and page layouts
├── services/               # Frontend API service wrappers
├── theme/                  # Theme configuration and styling
└── types/                  # TypeScript type definitions
```

### Frontend Organization
- **Pages**: Route-level components in `pages/` (Dashboard, VPS, Billing, Admin)
- **Components**: Shared UI components following shadcn/ui patterns
- **Contexts**: Global state management (AuthContext, ThemeContext, ImpersonationContext)
- **Services**: API communication wrappers with error handling
- **Hooks**: Custom React hooks for data fetching and state management

## Database & Scripts

### Migrations (`migrations/`)
- **Sequential SQL files**: `001_initial_schema.sql`, `002_add_feature.sql`
- **Applied via scripts**: Use `node scripts/run-migration.js` for deployment
- **Version tracking**: Database tracks applied migrations automatically

### Utility Scripts (`scripts/`)
- **Database operations**: Migration runners, connection testing, data seeding
- **Admin utilities**: User promotion, password updates, admin creation
- **Billing tools**: Hourly billing tests, container billing processing
- **Communication**: SMTP testing, notification debugging
- **Development**: SSH key generation, database reset utilities

## Configuration Files

### Build & Development
- **`package.json`**: Dependencies, scripts, and project metadata
- **`vite.config.ts`**: Frontend build configuration with proxy setup
- **`tsconfig.json`**: TypeScript configuration for both frontend and backend
- **`tailwind.config.js`**: Styling configuration with custom theme
- **`components.json`**: shadcn/ui component library configuration

### Environment & Deployment
- **`.env.example`**: Template for environment variables
- **`vercel.json`**: Vercel deployment configuration
- **`ecosystem.config.cjs`**: PM2 process management configuration
- **`nodemon.json`**: Development server configuration

## Key Architectural Principles

### Separation of Concerns
- **Frontend**: Pure React SPA with no server-side rendering
- **Backend**: Stateless API server with JWT authentication
- **Database**: PostgreSQL with explicit migrations and transaction support

### Code Organization
- **Feature-based routing**: Both frontend pages and backend routes organized by business domain
- **Service layer abstraction**: External API calls isolated in service classes
- **Shared types**: TypeScript interfaces shared between frontend and backend
- **Environment-driven configuration**: All deployment-specific settings via environment variables

### Development Workflow
- **Concurrent development**: Frontend and backend run simultaneously via `npm run dev`
- **Hot reloading**: Vite for frontend, Nodemon for backend changes
- **Type safety**: Full TypeScript coverage with shared type definitions
- **Testing**: Vitest for unit tests, Supertest for API integration tests
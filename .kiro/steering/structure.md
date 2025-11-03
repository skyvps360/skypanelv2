# Project Structure & Organization

## Root Directory Layout

```
├── api/                    # Express.js backend application
├── src/                    # React frontend application
├── migrations/             # Database schema migrations
├── scripts/                # Utility and maintenance scripts
├── public/                 # Static assets (favicon, logos)
├── repo-docs/              # Feature documentation and API references
├── .kiro/                  # Kiro IDE configuration and steering
├── .github/                # GitHub workflows and templates
└── node_modules/           # Dependencies (managed by npm)
```

## Backend Structure (`api/`)

```
api/
├── app.ts                  # Express app configuration and middleware setup
├── server.ts               # Server entry point with SSH bridge and billing scheduler
├── index.ts                # Vercel serverless entry point
├── config/                 # Configuration management and validation
├── lib/                    # Database helpers and utilities
├── middleware/             # Express middleware (auth, rate limiting, etc.)
├── routes/                 # API route handlers organized by feature
├── services/               # Business logic and external integrations
└── __tests__/              # Backend test files
```

### Key Backend Patterns
- **Routes**: Feature-based organization (`auth.js`, `vps.js`, `billing.js`)
- **Services**: Business logic abstraction (`BillingService`, `NotificationService`)
- **Middleware**: Reusable request processing (`rateLimiting.ts`, `auth.ts`)
- **Config**: Environment-driven configuration with validation

## Frontend Structure (`src/`)

```
src/
├── App.tsx                 # Main app component with routing
├── main.tsx                # React app entry point
├── index.css               # Global styles and Tailwind imports
├── components/             # Reusable UI components
│   ├── ui/                 # Base UI primitives (shadcn/ui style)
│   ├── admin/              # Admin-specific components
│   └── [feature]/          # Feature-specific components
├── contexts/               # React contexts (Auth, Theme, Impersonation)
├── hooks/                  # Custom React hooks
├── lib/                    # Frontend utilities and API client
├── pages/                  # Route components
├── services/               # Frontend service layer
├── theme/                  # Theme configuration and utilities
└── types/                  # TypeScript type definitions
```

### Frontend Organization Principles
- **Pages**: One component per route in `pages/`
- **Components**: Organized by feature or as reusable UI primitives
- **Contexts**: Global state management for auth, theme, impersonation
- **Services**: API interaction layer with error handling
- **Types**: Shared TypeScript interfaces and types

## Database & Scripts

### Migrations (`migrations/`)
- Sequential SQL files with descriptive names
- Applied via `scripts/run-migration.js`
- Version-controlled schema changes

### Utility Scripts (`scripts/`)
- **Database**: Migration runners, reset utilities, connection tests
- **Admin**: User management, password updates, role promotion
- **Testing**: SMTP tests, billing workflow validation
- **Security**: SSH secret generation, encryption utilities

## Configuration Files

### Build & Development
- `package.json` - Dependencies and npm scripts
- `vite.config.ts` - Frontend build configuration with proxy setup
- `tsconfig.json` - TypeScript configuration with path mapping
- `tailwind.config.js` - Tailwind CSS customization
- `eslint.config.js` - Code quality and style rules

### Environment & Deployment
- `.env` - Environment variables (not committed)
- `.env.example` - Environment template
- `vercel.json` - Vercel deployment configuration
- `ecosystem.config.cjs` - PM2 process management
- `nodemon.json` - Development server configuration

## Naming Conventions

### Files & Directories
- **Components**: PascalCase (`UserProfile.tsx`)
- **Pages**: PascalCase (`Dashboard.tsx`)
- **Utilities**: camelCase (`apiClient.ts`)
- **Services**: camelCase with Service suffix (`billingService.ts`)
- **Types**: camelCase (`userTypes.ts`)

### API Routes
- RESTful conventions: `/api/vps`, `/api/vps/:id`
- Feature-based grouping: `/api/admin/*`, `/api/billing/*`
- Consistent HTTP methods: GET, POST, PUT, DELETE

### Database
- Snake_case for tables and columns
- Descriptive migration names with timestamps
- Foreign key naming: `user_id`, `vps_id`

## Import Patterns

### Frontend
```typescript
// Absolute imports using @ alias
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { api } from "@/lib/api"
```

### Backend
```typescript
// Relative imports with .js extension (ESM)
import { query } from '../lib/database.js'
import { BillingService } from '../services/billingService.js'
```

## Code Organization Best Practices

1. **Separation of Concerns**: Business logic in services, UI logic in components
2. **Feature Grouping**: Related functionality organized together
3. **Consistent Patterns**: Similar file structures across features
4. **Type Safety**: Shared types between frontend and backend
5. **Error Handling**: Centralized error handling in API client and services
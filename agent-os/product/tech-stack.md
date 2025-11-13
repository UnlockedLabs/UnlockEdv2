# Tech Stack

## Backend

### Core Framework & Language

- **Go** - Primary backend language
- **GORM** - ORM for database interactions
- **REST API** - API architecture pattern

### Database

- **PostgreSQL** - Primary relational database
- **Database Migrations** - Located in `/backend/migrations/`

### Authentication & Authorization

- **Ory Kratos** - Identity and user management
- **Ory Hydra** - OAuth2 and OpenID Connect provider
- **Session-based Authentication** - With CSRF token protection
- **Role-based Access Control** - Multi-layer permissions (Resident, Department Admin, Facility Admin, Super Admin)

### Message Queue & Async Processing

- **NATS Jetstream** - Message queue for async task processing between services

## Frontend

### Core Framework & Language

- **React** - UI framework
- **TypeScript** - Type-safe JavaScript
- **Vite** - Build tool and dev server

### Styling & UI Components

- **TailwindCSS** - Utility-first CSS framework
- **DaisyUI** - Tailwind component library

### Routing & State Management

- **React Router** - Client-side routing with data loaders
- **SWR** - API state management and caching

### Code Quality

- **ESLint** - Linting
- **Prettier** - Code formatting (enforced in pre-commit hooks)

## Infrastructure & DevOps

### Containerization

- **Docker** - Container runtime
- **Docker Compose** - Multi-container orchestration for local development

### Development Tooling

- **Make** - Build automation and development commands
- **Git Hooks** - Pre-commit validation (Prettier for frontend, gofmt for backend)

### Storage

- **S3** - Cloud storage for content delivery
- **Local Storage** - Offline content serving

## External Platform Integrations

### Provider Middleware Service

- **Separate Integration Service** - Standalone service handling external platform connections

### Supported Educational Platforms

- **Canvas LMS** - Learning management system integration
- **Brightspace** - D2L learning platform integration
- **Kolibri** - Offline educational platform (requires ECR access)
- **Kiwix** - Offline Wikipedia and educational content

## Architecture Patterns

### Design Patterns

- **Multi-Tenancy** - Facility-based data isolation
- **Offline-First** - Content accessible without internet connectivity
- **RESTful APIs** - JSON responses with session authentication
- **Activity Tracking** - Comprehensive logging of content interactions

### Service Architecture

- **Backend API** (`/backend/cmd/main.go`) - Core business logic
- **Provider Middleware** (`/provider-middleware`) - External platform integration layer
- **Frontend SPA** - Single-page application

## Development Environment

### Local Development

- **127.0.0.1:8080** - Required for cookie compatibility (not localhost)
- **Hot Reloading** - Enabled for both frontend and backend during development

### Testing

- **Go Testing** - Backend unit and integration tests
- **Integration Tests** - Located in `/tests/integration/`

## Security

- **CSRF Protection** - Required for state-changing operations
- **Session Tokens** - Cookie-based authentication
- **Facility-Based Data Isolation** - Enforced at database and application layers
- **Role-Based Access Control** - Multiple permission layers

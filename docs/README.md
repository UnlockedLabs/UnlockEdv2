# UnlockEdv2 Developer Documentation

Welcome to the UnlockEdv2 developer documentation. This comprehensive educational platform is designed specifically for correctional facilities and provides multi-tenant program management, LMS integration, and content delivery.

## 📚 Documentation Index

### Getting Started
- [Quick Start](#quick-start)
- [Development Setup](#development-setup)
- [Architecture Overview](#architecture-overview)

### Core Documentation
- [API Reference](./api/) - Complete REST API documentation
- [Database Schema](./database/) - Database models, relationships, and migrations
- [Authentication System](./authentication/) - Auth flows, roles, and permissions
- [Frontend Architecture](./frontend/) - React components and state management
- [Integration Patterns](./integration/) - External system integrations
- [Deployment Guide](./deployment/) - Production deployment and configuration
- [Troubleshooting](./troubleshooting/) - Common issues and solutions

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Go 1.23+
- Node.js 18+
- Yarn
- Make (recommended)

### One-Command Setup
```bash
# Clone and setup the entire development environment
git clone <repository-url>
cd UnlockEdv2
cp .env.example .env
make init     # Install dependencies, setup hooks, start containers
make migrate  # Run database migrations
make seed     # Optional: populate with test data
```

### Development Server
```bash
make dev  # Start all services with hot reloading
```

Access the application at `http://127.0.0.1:3000` (must use 127.0.0.1, not localhost)

**Default Login:** `SuperAdmin` / `ChangeMe!`

## 🏗️ Architecture Overview

### System Components
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Database      │
│   React/TS      │◄──►│   Go/Gin        │◄──►│   PostgreSQL    │
│   Port 3000     │    │   Port 8080     │    │   Port 5432     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Nginx Proxy   │    │ Provider        │    │   NATS Queue    │
│   Port 80/443   │    │ Middleware      │    │   Port 4222     │
└─────────────────┘    │   Port 8081     │    └─────────────────┘
                       └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │ Ory Kratos/     │
                       │ Hydra Auth      │
                       │ Port 4433/4444  │
                       └─────────────────┘
```

### Technology Stack
- **Backend**: Go 1.23, Gin HTTP framework, GORM ORM
- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
- **Database**: PostgreSQL 16 with comprehensive migrations
- **Authentication**: Ory Kratos (identity) + Ory Hydra (OAuth2/OIDC)
- **Message Queue**: NATS with JetStream for background jobs
- **Deployment**: Docker, Docker Compose, Kubernetes (Helm charts)

## 🎯 Development Setup

### Environment Configuration
```bash
# Copy and customize environment variables
cp .env.example .env

# Key variables to configure:
POSTGRES_DB=unlocked_development
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
DATABASE_URL=postgres://postgres:postgres@db:5432/unlocked_development

# Ory configuration
KRATOS_PUBLIC_URL=http://127.0.0.1:4433
KRATOS_ADMIN_URL=http://kratos:4434
HYDRA_ADMIN_URL=http://hydra:4445

# Application URLs
APP_URL=http://127.0.0.1
FRONTEND_URL=http://127.0.0.1:3000
```

### Make Commands
```bash
# Development
make dev          # Start development servers with hot reload
make dev-be       # Backend only
make dev-fe       # Frontend only

# Database
make migrate      # Run database migrations
make migrate-fresh # Fresh migration (drops all data)
make seed         # Populate with demo data

# Dependencies  
make install-dep NAME=package-name  # Install frontend package

# Testing
make test         # Run backend tests
make test-integration # Run integration tests

# Production
make build        # Build production images
make prod         # Run production stack
```

### Development Workflow
1. **Start Development**: `make dev` 
2. **Database Changes**: Create migration → `make migrate`
3. **Code Changes**: Hot reload handles frontend/backend updates
4. **Testing**: Write tests → `make test`
5. **Git Workflow**: Pre-commit hooks run linting/formatting

## 🔐 Security & Authentication

### Role-Based Access Control (RBAC)
```go
type UserRole string

const (
    SystemAdmin     UserRole = "system_admin"      // Full system access
    DepartmentAdmin UserRole = "department_admin"  // Multi-facility access  
    FacilityAdmin   UserRole = "facility_admin"    // Single facility admin
    Student         UserRole = "student"           // Learner access only
)
```

### Multi-tenancy
- **Facility Isolation**: All data scoped to user's facility
- **Admin Override**: System/Department admins can access multiple facilities
- **Context Switching**: Admins can switch facility views via session

### Feature Flags
```go
type FeatureAccess string

const (
    OpenContentAccess    FeatureAccess = "open_content"
    ProviderAccess       FeatureAccess = "provider_platforms"
    ProgramManagement    FeatureAccess = "program_management"
)
```

## 🗃️ Database Overview

### Core Entities
- **Users & Facilities**: Multi-tenant user management
- **Programs & Classes**: Educational program structure  
- **Enrollments & Attendance**: Student participation tracking
- **Courses & Activities**: LMS integration and progress tracking
- **Content & Libraries**: Open educational resources
- **Analytics & Audit**: Comprehensive tracking and history

### Key Relationships
```sql
-- Primary relationships
users.facility_id → facilities.id
program_classes.program_id → programs.id  
program_class_enrollments.user_id → users.id
courses.provider_platform_id → provider_platforms.id

-- Many-to-many relationships
facilities_programs (facilities ↔ programs)
user_enrollments (users ↔ courses)
```

### Migration System
- **55+ Migrations**: Incremental schema evolution
- **Rollback Support**: Safe database changes
- **Seeding**: Demo data for development

## 🎨 Frontend Architecture

### Component Structure
```
src/
├── Pages/           # Route components (30+ pages)
│   ├── Auth/        # Authentication pages
│   ├── Student/     # Student interface  
│   └── Admin/       # Administrative interface
├── Components/      # Reusable UI components (80+)
│   ├── forms/       # Form components
│   ├── modals/      # Modal dialogs
│   ├── inputs/      # Input controls
│   └── cards/       # Data display cards
├── Context/         # React context providers
├── Hooks/           # Custom React hooks
└── Layouts/         # Page layout components
```

### State Management
- **SWR**: Data fetching and caching
- **React Context**: Global state (auth, theme, notifications)
- **React Hook Form**: Form state management
- **Local State**: Component-specific state with hooks

### Key Libraries
- **UI**: Tailwind CSS + DaisyUI components
- **Forms**: React Hook Form with validation
- **Data**: SWR for API integration
- **Calendar**: React Big Calendar for scheduling
- **Charts**: Recharts for analytics

## 🔌 Integration Points

### LMS Platform Support
- **Canvas**: OSS and Cloud variants with OAuth2/OIDC
- **Kolibri**: Offline-first educational content platform
- **Brightspace**: D2L platform with comprehensive API sync

### Content Management
- **YouTube**: Video content with local caching (yt-dlp)
- **Kiwix**: Offline Wikipedia and educational archives (ZIM files)
- **Open Content**: Curated educational resources

### External Services
- **Ory Kratos**: Identity and user management
- **Ory Hydra**: OAuth2/OIDC authorization server
- **NATS**: Message queue for background job processing
- **AWS S3**: Optional cloud storage for media files

## 🔄 Background Jobs

### Scheduled Tasks
- **Provider Sync**: Daily LMS data synchronization
- **Content Processing**: Video downloads and library updates
- **Analytics**: Daily program history aggregation
- **Maintenance**: Database cleanup and optimization

### Job Categories
```go
const (
    // Provider platform data sync
    SyncUsersJob       = "sync_users"
    SyncCoursesJob     = "sync_courses"
    SyncActivitiesJob  = "sync_activities"
    
    // Open content processing
    SyncLibrariesJob   = "sync_libraries" 
    SyncVideosJob      = "sync_videos"
    
    // Program management
    DailyProgHistoryJob = "daily_program_history"
)
```

## 🧪 Testing Strategy

### Backend Testing
```bash
# Run all tests
make test

# Integration tests
make test-integration

# Test with coverage
go test -cover ./...
```

### Frontend Testing
```bash
# Run frontend tests  
cd frontend && yarn test

# Component testing with React Testing Library
# Form validation testing
# User interaction testing
```

### Test Environment
- **Docker Compose**: Isolated test database
- **Test Fixtures**: Consistent test data
- **Transaction Rollback**: Clean test state

## 📝 Code Style & Standards

### Backend (Go)
- **gofmt**: Automatic formatting
- **golint**: Static analysis
- **GORM**: Database ORM patterns
- **Gin**: HTTP framework conventions

### Frontend (TypeScript)
- **Prettier**: Code formatting
- **ESLint**: Static analysis  
- **TypeScript**: Strict type checking
- **Component Patterns**: Functional components with hooks

### Git Workflow
- **Pre-commit Hooks**: Automatic formatting and linting
- **Conventional Commits**: Structured commit messages
- **Feature Branches**: Topic-based development
- **Pull Request Reviews**: Code quality gates

## 📊 Monitoring & Observability

### Health Checks
- **API Health**: `/api/health` endpoint
- **Database**: Connection and query performance
- **External Services**: LMS platform connectivity
- **Background Jobs**: Task execution monitoring

### Metrics
- **Prometheus**: Application and system metrics
- **Custom Metrics**: Educational platform specific KPIs
- **Performance**: Response times and throughput
- **Business Metrics**: User engagement and program effectiveness

### Logging
- **Structured Logging**: JSON format with correlation IDs
- **Log Levels**: Debug, Info, Warn, Error with appropriate filtering
- **Request Tracing**: Full request lifecycle tracking
- **Error Tracking**: Comprehensive error reporting

## 🚀 Production Deployment

### Container Strategy
- **Multi-stage Builds**: Optimized production images
- **Health Checks**: Container orchestration ready
- **Secret Management**: Environment-based configuration
- **Resource Limits**: Memory and CPU constraints

### Kubernetes Deployment
- **Helm Charts**: Parameterized deployments
- **ConfigMaps**: Application configuration
- **Secrets**: Sensitive data management
- **Ingress**: Load balancing and TLS termination

### Database Management
- **Migrations**: Safe schema updates in production
- **Backups**: Automated backup strategy
- **Monitoring**: Performance and capacity planning
- **Connection Pooling**: Efficient database connections

## 🆘 Getting Help

### Resources
- **API Documentation**: [./api/README.md](./api/README.md)
- **Database Schema**: [./database/README.md](./database/README.md)
- **Troubleshooting**: [./troubleshooting/README.md](./troubleshooting/README.md)

### Common Issues
- **Cookie Problems**: Use 127.0.0.1 instead of localhost
- **Docker Issues**: Check Docker daemon and permissions
- **Migration Failures**: Review migration logs and rollback if needed
- **Authentication Errors**: Verify Ory services are running

### Development Support
- **Logs**: Check `logs/` directory for application logs
- **Database**: Use `make migrate-fresh` for clean state
- **Dependencies**: Use `make install-dep` for frontend packages
- **Cache**: Clear browser cookies and restart services

---

## 📄 License
UnlockEdv2 is open-sourced software licensed under the [Apache License, Version 2.0](https://opensource.org/license/apache-2-0/).

## 🤝 Contributing
Please see [CONTRIBUTING.md](../CONTRIBUTING.md) for contribution guidelines.
# AGENTS.md

## Build/Lint/Test Commands

### Frontend (React/TypeScript)
- `cd frontend && yarn build` - Build production bundle
- `cd frontend && yarn lint` - Run ESLint
- `cd frontend && yarn lint-staged` - Run ESLint with auto-fix
- `cd frontend && yarn dev` - Start development server

### Backend (Go)
- `cd backend && go test ./...` - Run all tests
- `cd backend && go test -run TestSpecificFunction ./path/to/package` - Run single test
- `cd backend && go test -v ./path/to/package` - Run tests with verbose output
- `make migrate` - Apply database migrations
- `make migrate-fresh` - Reset database and apply migrations
- `make seed` - Run database seeder

## Code Style Guidelines

### Frontend
- Use TypeScript with strict mode enabled
- Follow ESLint + Prettier configuration (single quotes, 4-space tabs, semicolons)
- Import paths use `@/` alias for src directory
- React functional components with hooks
- Tailwind CSS for styling

### Backend
- Go 1.22.2+ with standard formatting (`go fmt`)
- Package naming: lowercase, single words when possible
- Use testify for assertions in tests
- Error handling with explicit error returns
- GORM for database operations
- Struct tags for JSON/DB serialization

### Testing
- Frontend: Component testing with React Testing Library
- Backend: Unit tests in `*_test.go` files, integration tests in `tests/integration/`
- Test functions named `TestFunctionName` with `*testing.T` parameter
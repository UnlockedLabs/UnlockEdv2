INSTALL_GOOSE=go install github.com/pressly/goose/v3/cmd/goose@latest
INIT_HOOKS=cd frontend && yarn prepare && cd ..
DOCKER_COMPOSE=docker-compose.yml
PROD_COMPOSE=config/docker-compose.prod.yml
KOLIBRI_COMPOSE=config/docker-compose.kolibri.yml
FE_DEV_COMPOSE=config/docker-compose.fe-dev.yml
MIGRATE_MAIN=backend/migrations/main.go --dir backend/migrations
BUILD_RECREATE=--build --force-recreate
SEED_MAIN=backend/seeder/main.go
BINARY_NAME=server
MIDDLEWARE=provider-middleware
GOARCH=$(shell go env GOARCH)
GOOS=$(shell go env GOOS)

ascii_art:
	@echo ' ____ ___      .__                 __              .___     ________  '
	@echo '|    |   \____ |  |   ____   ____ |  | __ ____   __| _/__  _\_____  \ '
	@echo '|    |   /    \|  |  /  _ \_/ ___\|  |/ // __ \ / __ |\  \/ //  ____/ '
	@echo '|    |  /   |  \  |_(  <_> )  \___|    <\  ___// /_/ | \   //       \ '
	@echo '|______/|___|  /____/\____/ \___  >__|_ \\___  >____ |  \_/ \_______ \'
	@echo '             \/                 \/     \/    \/     \/              \/'


.PHONY: help prod backend-dev frontend-dev migrate-fresh seed build-binaries init kolibri migrate


help: ascii_art
	@echo " ⚡Usage: make [target] ⚡"
	@echo " Targets:"
	@echo " ⚡ init           Install initial development dependencies for the project"
	@echo "   prod           Run the production Docker Compose setup (all containers)"
	@echo "   kolibri        Run all containers with Kolibri (requires login to UL ECR | team only)"
	@echo "   frontend-dev   Run the development Docker Compose setup (requires vite)"
	@echo "   backend-dev    Run only the essential containers (requires vite, server and middleware)"
	@echo "   migrate        Run the Go migration script"
	@echo "   migrate-fresh  Run the Go migration script to reset the database to a fresh state"
	@echo " 󱘤  seed           Run the seeder script"
	@echo "   build          Build Go binaries for different platforms"

prod: ascii_art
	docker compose -f $(DOCKER_COMPOSE) -f $(PROD_COMPOSE) up $(BUILD_RECREATE)

install: ascii_art
	@echo 'Installing dependencies...'
	$(INSTALL_GOOSE) && $(INIT_HOOKS)
	@echo 'Dependencies installed successfully.'

backend-dev: ascii_art
	docker compose up --build --force-recreate

frontend-dev: ascii_art
	docker compose -f $(DOCKER_COMPOSE) -f $(FE_DEV_COMPOSE) up $(BUILD_RECREATE)

migrate-fresh: ascii_art
	go run $(MIGRATE_MAIN) --fresh

migrate: ascii_art
	go run $(MIGRATE_MAIN)

kolibri: ascii_art
	docker compose -f $(DOCKER_COMPOSE) -f $(PROD_COMPOSE) -f $(KOLIBRI_COMPOSE) up $(BUILD_RECREATE)

seed: ascii_art
	go run $(SEED_MAIN)

build: ascii_art
	@echo "Building binaries for different platforms..."
	go build -o bin/$(BINARY_NAME)-$(GOOS)-$(GOARCH) backend/main.go && go build -o bin/$(MIDDLEWARE)-$(GOOS)-$(GOARCH) provider-middleware/. && go build -o bin/cron-tasks-$(GOOS)-$(GOARCH) ./backend/tasks/.
	@echo "Binaries built successfully."

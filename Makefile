DOCKER_COMPOSE=docker-compose.yml
PROD_COMPOSE=config/docker-compose.prod.yml
KOLIBRI_COMPOSE=config/docker-compose.kolibri.yml
FE_DEV_COMPOSE=config/docker-compose.fe-dev.yml
MIGRATE_MAIN=backend/migrations/main.go
BUILD_RECREATE=--build --force-recreate
SEED_MAIN=backend/seeder/main.go
BINARY_NAME=server
MIDDLEWARE=provider-middleware

ascii_art:
	@echo ' ____ ___      .__                 __              .___     ________  '
	@echo '|    |   \____ |  |   ____   ____ |  | __ ____   __| _/__  _\_____  \ '
	@echo '|    |   /    \|  |  /  _ \_/ ___\|  |/ // __ \ / __ |\  \/ //  ____/ '
	@echo '|    |  /   |  \  |_(  <_> )  \___|    <\  ___// /_/ | \   //       \ '
	@echo '|______/|___|  /____/\____/ \___  >__|_ \\___  >____ |  \_/ \_______ \'
	@echo '             \/                 \/     \/    \/     \/              \/'


.PHONY: help prod backend-dev frontend-dev migrate-fresh seed build-binaries install kolibri


help: ascii_art
	@echo " ⚡Usage: make [target] ⚡"
	@echo " Targets:"
	@echo "   prod           Run the production Docker Compose setup (all containers)"
	@echo "   kolibri        Run all containers with Kolibri (requires login to UL ECR | team only)"
	@echo "   frontend-dev   Run the development Docker Compose setup (requires vite)"
	@echo "   backend-dev    Run only the essential containers (requires vite, server and middleware)"
	@echo "   migrate-fresh  Run the Go migration script"
	@echo " 󱘤  seed           Run the seeder script"
	@echo "   build-binaries Build Go binaries for different platforms"

prod: ascii_art
	docker compose -f $(DOCKER_COMPOSE) -f $(PROD_COMPOSE) up $(BUILD_RECREATE)

install: ascii_art
	@echo 'Installing dependencies...'
	cd frontend && yarn install
	cd backend && go mod download
	cd provider-middleware && go mod download
	@echo 'Dependencies installed successfully.'

backend-dev: ascii_art
	docker compose up --build --force-recreate

frontend-dev: ascii_art
	docker compose -f $(DOCKER_COMPOSE) -f $(FE_DEV_COMPOSE) up $(BUILD_RECREATE)

migrate-fresh: ascii_art
	go run $(MIGRATE_MAIN)

kolibri: ascii_art
	docker compose -f $(DOCKER_COMPOSE) -f $(PROD_COMPOSE) -f $(KOLIBRI_COMPOSE) up $(BUILD_RECREATE)

seed: ascii_art
	go run $(SEED_MAIN)

build-binaries: ascii_art
	@echo "Building binaries for different platforms..."
	GOOS=linux GOARCH=amd64 go build -o bin/$(BINARY_NAME)-linux-amd64 backend/main.go && go build -o bin/$(MIDDLEWARE)-linux-amd64 provider-middleware/.
	GOOS=darwin GOARCH=amd64 go build -o bin/$(BINARY_NAME)-darwin-amd64 backend/main.go && go build -o bin/$(MIDDLEWARE)-darwin-amd64 provider-middleware/.
	GOOS=darwin GOARCH=arm64 go build -o bin/$(BINARY_NAME)-darwin-arm64 backend/main.go && go build -o bin/$(MIDDLEWARE)-darwin-arm64 provider-middleware/.
	GOOS=windows GOARCH=amd64 go build -o bin/$(BINARY_NAME)-windows-amd64.exe backend/main.go && go build -o bin/$(MIDDLEWARE)-windows-amd64 provider-middleware/.
	@echo "Binaries built successfully."

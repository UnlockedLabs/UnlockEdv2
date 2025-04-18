DOCKER_COMPOSE=docker-compose.yml
KOLIBRI_COMPOSE=config/docker-compose.kolibri.yml
MIGRATE_MAIN=backend/migrations/main.go -dir backend/migrations
BUILD_RECREATE=--build --force-recreate
BINARY_NAME=server
MIDDLEWARE=provider-middleware
GOARCH=$(shell go env GOARCH)
GOOS=$(shell go env GOOS)
ACCOUNT_ID=$(AWS_ACCOUNT_ID)
REPO=.dkr.ecr.us-west-2.amazonaws.com

ascii_art:
	@echo ' ____ ___      .__                 __              .___     ________  '
	@echo '|    |   \____ |  |   ____   ____ |  | __ ____   __| _/__  _\_____  \ '
	@echo '|    |   /    \|  |  /  _ \_/ ___\|  |/ // __ \ / __ |\  \/ //  ____/ '
	@echo '|    |  /   |  \  |_(  <_> )  \___|    <\  ___// /_/ | \   //       \ '
	@echo '|______/|___|  /____/\____/ \___  >__|_ \\___  >____ |  \_/ \_______ \'
	@echo '             \/                 \/     \/    \/     \/              \/'


.PHONY: help prod dev migrate-fresh seed build-binaries init kolibri migrate reset migration install-dep


help: ascii_art
	@echo " ⚡Usage: make [target] ⚡"
	@echo " Targets:"
	@echo " ⚡ init                   Install initial development dependencies for the project"
	@echo "   dev                    Run containers in development mode with hot-reloading for server and frontend only"
	@echo " 󱗆  kolibri                Run all containers with Kolibri (requires login to UL ECR | team only)"
	@echo "   migrate                Apply the migrations"
	@echo "   migrate-fresh          Drop the tables in the main application and to reset the database to a fresh state"
	@echo "   migration NAME=x       Create a new migration with the provided name"
	@echo " 󱗆  install-dep NAME=x     Install a dependency on the front-end while the containers are running"
	@echo " 󱘤  seed FEATURES=x        Run the seeder script. FEATURES=programs,open-content,providers"
	@echo "   build                  Build Go binaries for different platforms"
	@echo " 󰑙  reset                  Drop all volumes and reset all data in the database"
	@echo " ➕ merge PR=x             Merge a PR (requires GitHub CLI and permissions | team only)"


reset: ascii_art
	docker compose down --volumes

init: ascii_art
	@echo 'Installing dependencies...'
	go install github.com/pressly/goose/v3/cmd/goose@latest && go install github.com/air-verse/air@latest && cd frontend && yarn install && yarn prepare && cd ..
	@echo 'Dependencies installed successfully.'
	./config/zims.sh
	docker compose up $(BUILD_RECREATE)

dev: ascii_art
	./config/zims.sh
	docker compose up $(BUILD_RECREATE)

install-dep: ascii_art
	@if [ -z "$(NAME)" ]; then \
		echo "Error: NAME is not set, please provide package name (make install-dep NAME=some_pkg)"; \
		exit 1; \
	fi
	docker compose down && docker volume rm -f unlockedv2_node_modules && cd frontend && yarn add $(NAME) && cd .. && docker compose up $(BUILD_RECREATE)
migrate-fresh: ascii_art
	go run $(MIGRATE_MAIN) --fresh

migrate: ascii_art
	go run $(MIGRATE_MAIN)

kolibri: ascii_art
	docker compose -f $(DOCKER_COMPOSE) -f $(KOLIBRI_COMPOSE) up $(BUILD_RECREATE)

seed: ascii_art
	go run backend/seeder/main.go "$(FEATURES)"

build: ascii_art
	@if [ -z "$(ACCOUNT_ID)" ]; then \
		echo "Error: ACCOUNT_ID is not set, you must set AWS_ACCOUNT_ID env var, or pass ACCOUNT_ID=value in order to tag builds"; \
		exit 1; \
	fi
	docker buildx build . -f backend/Dockerfile --tag=$(ACCOUNT_ID)$(REPO)/unlockedv2:latest && docker buildx build . -f backend/tasks/Dockerfile --tag=$(ACCOUNT_ID)$(REPO)/cron_tasks:latest && docker buildx build frontend -f frontend/Dockerfile --tag=$(ACCOUNT_ID)$(REPO)/frontend:latest && docker buildx build . -f provider-middleware/Dockerfile --tag=$(ACCOUNT_ID)$(REPO)/provider_middleware:latest

migration: ascii_art
	@if [ -z "$(NAME)" ]; then \
		echo "Error: NAME is not set"; \
		exit 1; \
	fi
	@echo "Creating migration with name $(NAME)..."
	goose -dir backend/migrations create $(NAME) sql
	goose -dir backend/migrations fix

merge: ascii_art
	@if [-z "$(PR)" ];then \
		echo "Error: PR is not set"; \
		exit 1; \
	fi
	@echo "Merging PR $(PR)..."
	./.github/merge.sh $(PR)

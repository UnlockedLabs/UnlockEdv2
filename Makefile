# pipefail so a failed `docker compose build` is not masked by the `tee` that
# keeps its output in logs/ — a silently swallowed tutor build was exactly how
# `make dev` used to come up without the tutor and say nothing useful.
SHELL := /bin/bash
.SHELLFLAGS := -o pipefail -c

DOCKER_COMPOSE=docker-compose.yml
TUTOR_BUILD_LOG=logs/tutor-build.log
KOLIBRI_COMPOSE=config/docker-compose.kolibri.yml
MIGRATE_MAIN=backend/migrations/main.go -dir backend/migrations
BUILD_RECREATE=--build --force-recreate
# Set TUTOR_DIR in .env (or the environment) if your tutor checkout lives
# somewhere other than a sibling ../ai/ directory. Docker Compose reads the
# same variable from .env for the tutor build context, so the two never drift.
DEFAULT_AI_DIR=../ai/unlocked-hiset-ai

# tutor-service only builds from the sibling ../ai/unlocked-hiset-ai checkout when
# it's present; otherwise its published image is pulled instead. Building it
# separately (not as part of one big `docker compose up --build`) matters: a
# `docker compose up --build` builds every service before starting any of
# them, so a broken tutor-service build previously aborted the whole command
# and took the ENTIRE stack down with it — falling back to the published image
# on a build failure keeps that from happening. $(1) is extra `docker compose`
# flags (e.g. `-f some-file.yml`).
define run_dev_compose
	@set -e; \
	AI_DIR=$${TUTOR_DIR:-$$(sed -n 's/^TUTOR_DIR=//p' .env 2>/dev/null | tail -1)}; \
	AI_DIR=$${AI_DIR:-$(DEFAULT_AI_DIR)}; \
	TUTOR_READY=0; TUTOR_WHY=; \
	if [ -d "$$AI_DIR" ]; then \
		export TUTOR_GIT_COMMIT=$$(git -C "$$AI_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown); \
		export TUTOR_GIT_BRANCH=$$(git -C "$$AI_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown); \
		echo "Building tutor-service from $$AI_DIR @ $$TUTOR_GIT_BRANCH ($$TUTOR_GIT_COMMIT)"; \
		mkdir -p $(dir $(TUTOR_BUILD_LOG)); \
		if docker compose $(1) build tutor-service 2>&1 | tee $(TUTOR_BUILD_LOG); then \
			TUTOR_READY=1; \
		else \
			TUTOR_WHY="the build from $$AI_DIR failed — full output in $(TUTOR_BUILD_LOG)"; \
			echo "tutor-service failed to build — trying to pull the published image instead."; \
		fi; \
	else \
		TUTOR_WHY="no checkout at $$AI_DIR (set TUTOR_DIR in .env to point at it)"; \
		echo "No tutor checkout at $$AI_DIR — set TUTOR_DIR to its path, or pulling the published image instead."; \
	fi; \
	if [ "$$TUTOR_READY" = "0" ]; then \
		if docker compose $(1) pull tutor-service; then \
			TUTOR_READY=1; \
		else \
			echo; \
			echo "=============================================================="; \
			echo " THE APP IS STARTING WITHOUT THE AI TUTOR."; \
			echo " Reason: $$TUTOR_WHY"; \
			echo " The GHCR fallback also failed: the package is private, so the"; \
			echo " pull needs 'docker login ghcr.io -u <github-user>' with a PAT"; \
			echo " that has read:packages."; \
			echo "=============================================================="; \
			echo; \
		fi; \
	fi; \
	docker compose $(1) build $$(docker compose $(1) config --services | grep -v '^tutor-service$$'); \
	if [ "$$TUTOR_READY" = "1" ]; then \
			docker compose $(1) up --force-recreate; \
		else \
			docker compose $(1) up --force-recreate $$(docker compose $(1) config --services | grep -v '^tutor-service$$'); \
	fi 
endef
SEED_MAIN=backend/seeder/main.go
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


.PHONY: help prod dev dev-registry dev-tutor migrate-fresh seed build-binaries init kolibri migrate reset migration install-dep


help: ascii_art
	@echo " ⚡Usage: make [target] ⚡"
	@echo " Targets:"
	@echo " ⚡ init                   Install initial development dependencies for the project"
	@echo "   dev                    Run containers in development mode with hot-reloading for server and frontend only"
	@echo "   dev-tutor              Like dev, but with live hot-reload for tutor source (requires sibling checkout / symlink)"
	@echo "   dev-registry           Like dev, but pulls the tutor image from GHCR instead of building it (no sibling checkout needed)"
	@echo " 󱗆  kolibri                Run all containers with Kolibri (requires login to UL ECR | team only)"
	@echo "   migrate                Apply the migrations"
	@echo "   migrate-fresh          Drop the tables in the main application and to reset the database to a fresh state"
	@echo "   migration NAME=x       Create a new migration with the provided name"
	@echo " 󱗆  install-dep NAME=x     Install a dependency on the front-end while the containers are running"
	@echo " 󱘤  seed                   Run the seeder script"
	@echo "   build                  Build Go binaries for different platforms"
	@echo " 󰑙  reset                  Drop all volumes and reset all data in the database"
	@echo " ➕ merge PR=x             Merge a PR (requires GitHub CLI and permissions | team only)"


reset: ascii_art
	docker compose down --volumes

init: ascii_art
	@echo 'Installing dependencies...'
	go install github.com/pressly/goose/v3/cmd/goose@latest && go install github.com/air-verse/air@latest && cd frontend && yarn install && cd ..
	@echo 'Dependencies installed successfully.'
	$(MAKE) dev

dev: ascii_art
	./config/zims.sh
	$(call run_dev_compose,)

# Like `dev`, but pulls the tutor image from GHCR instead of building it from a sibling
# checkout. Needs `docker login ghcr.io` unless the package is Internal/Public.
dev-registry: ascii_art
	./config/zims.sh
	docker compose pull tutor-service
	docker compose up --force-recreate

# Like `dev`, but mounts the sibling tutor checkout as a live volume so Next.js
# HMR works — no rebuild needed when you edit tutor source files.
dev-tutor: ascii_art
	./config/zims.sh
	docker compose -f docker-compose.yml -f docker-compose.dev-tutor.yml up $(BUILD_RECREATE)

install-dep: ascii_art
	@if [ -z "$(NAME)" ]; then \
		echo "Error: NAME is not set, please provide package name (make install-dep NAME=some_pkg)"; \
		exit 1; \
	fi
	docker compose down && docker volume rm -f unlockedv2_node_modules && cd frontend && yarn add $(NAME) && cd ..
	$(call run_dev_compose,)
migrate-fresh: ascii_art
	go run $(MIGRATE_MAIN) --fresh

migrate: ascii_art
	go run $(MIGRATE_MAIN)

kolibri: ascii_art
	$(call run_dev_compose,-f $(DOCKER_COMPOSE) -f $(KOLIBRI_COMPOSE))

seed: ascii_art
	go run $(SEED_MAIN)

build: ascii_art
	@if [ -z "$(ACCOUNT_ID)" ]; then \
		echo "Error: ACCOUNT_ID is not set, you must set AWS_ACCOUNT_ID env var, or pass ACCOUNT_ID=value in order to tag builds"; \
		exit 1; \
	fi
	docker buildx build . -f backend/Dockerfile --tag=$(ACCOUNT_ID)$(REPO)/unlockedv2:latest  && docker buildx build frontend -f frontend/Dockerfile --tag=$(ACCOUNT_ID)$(REPO)/frontend:latest && docker buildx build . -f provider-middleware/Dockerfile --tag=$(ACCOUNT_ID)$(REPO)/provider_middleware:latest

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

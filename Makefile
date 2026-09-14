.PHONY: help install dev build lint clean \
	docker-build docker-up docker-down docker-restart docker-logs docker-ps \
	db-generate db-migrate db-validate db-studio db-backup db-restore \
	format format-check typecheck test test-integration \
	status check reset-dev

COMPOSE := docker compose --env-file .env.overhaul -f docker-compose.overhaul.yml
APP_SERVICE := app

help: ## Show available Make targets.
	@echo "PersonalHub commands"
	@echo
	@awk 'BEGIN {FS = ":.*## "}; /^[a-zA-Z0-9_-]+:.*## / {printf "  %-18s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install npm dependencies.
	npm install

dev: ## Start the PostgreSQL-configured development server.
	npm run dev

build: ## Build with the PostgreSQL configuration.
	npm run build

lint: ## Run ESLint.
	npm run lint

format: ## Format supported project files (does not include ignored inspection notes).
	npm run format

format-check: ## Check formatting without modifying files.
	npm run format:check

typecheck: ## Type-check without writing TypeScript incremental state.
	npm run typecheck

test: ## Run unit tests only.
	npm test

test-integration: ## Run disposable-PostgreSQL integration tests.
	npm run test:integration

clean: ## Remove local build/cache output without touching data.
	rm -rf .next

docker-build: ## Build the Docker image.
	$(COMPOSE) build

docker-up: ## Build and start PersonalHub through Docker Compose.
	$(COMPOSE) up -d --build

docker-down: ## Stop the Docker Compose stack.
	$(COMPOSE) down

docker-restart: ## Restart the PersonalHub Docker service.
	$(COMPOSE) restart $(APP_SERVICE)

docker-logs: ## Follow Docker Compose logs.
	$(COMPOSE) logs -f

docker-ps: ## Show Docker Compose service status.
	$(COMPOSE) ps

db-generate: ## Generate the Prisma client.
	npm run prisma:generate

db-migrate: ## Run Prisma development migrations.
	npm run prisma:migrate

db-validate: ## Validate the Prisma schema against the PostgreSQL environment.
	npm run prisma:validate

db-studio: ## Open Prisma Studio.
	npx dotenv -e .env.overhaul -- npx prisma studio

db-backup: ## Create a timestamped PostgreSQL backup.
	npm run db:backup

db-restore: ## Restore PostgreSQL from BACKUP=./backups/file.dump.
	@if [ -z "$(BACKUP)" ]; then \
		echo "Usage: make db-restore BACKUP=./backups/postgres/personalhub-example.dump"; \
		exit 1; \
	fi
	npm run db:restore -- "$(BACKUP)"

status: ## Show Git status, Docker status, and latest backups.
	@echo "Git status:"
	@git status --short
	@echo
	@echo "Docker Compose:"
	@$(COMPOSE) ps || true
	@echo
	@echo "Latest backups:"
	@if ls backups/postgres/*.dump >/dev/null 2>&1; then \
		ls -lt backups/postgres/*.dump | head -5; \
	else \
		echo "No PostgreSQL backup archives found."; \
	fi

check: format-check lint typecheck test build ## Run non-integration quality gates.

reset-dev: ## Safely clear dev build output after confirmation; does not delete the database.
	@echo "This removes .next only. It does NOT delete PostgreSQL data."
	@printf "Type YES to continue: "; \
	read confirmation; \
	if [ "$$confirmation" = "YES" ]; then \
		rm -rf .next; \
		echo "Removed .next"; \
	else \
		echo "Cancelled. No changes were made."; \
	fi

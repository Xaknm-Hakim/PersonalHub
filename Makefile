.PHONY: help install dev build lint clean \
	docker-build docker-up docker-down docker-restart docker-logs docker-ps \
	db-generate db-migrate db-seed db-studio db-backup db-restore \
	status check reset-dev

APP_SERVICE := personalhub

help: ## Show available Make targets.
	@echo "PersonalHub commands"
	@echo
	@awk 'BEGIN {FS = ":.*## "}; /^[a-zA-Z0-9_-]+:.*## / {printf "  %-18s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install npm dependencies.
	npm install

dev: ## Start the Next.js development server.
	npm run dev

build: ## Build the Next.js app.
	npm run build

lint: ## Run ESLint.
	npm run lint

clean: ## Remove local build/cache output without touching data.
	rm -rf .next

docker-build: ## Build the Docker image.
	docker compose build

docker-up: ## Build and start PersonalHub through Docker Compose.
	docker compose up -d --build

docker-down: ## Stop the Docker Compose stack.
	docker compose down

docker-restart: ## Restart the PersonalHub Docker service.
	docker compose restart $(APP_SERVICE)

docker-logs: ## Follow Docker Compose logs.
	docker compose logs -f

docker-ps: ## Show Docker Compose service status.
	docker compose ps

db-generate: ## Generate the Prisma client.
	npm run prisma:generate

db-migrate: ## Run Prisma development migrations.
	npm run prisma:migrate

db-seed: ## Seed the local SQLite database.
	npm run prisma:seed

db-studio: ## Open Prisma Studio.
	npx prisma studio

db-backup: ## Create a timestamped SQLite backup.
	npm run db:backup

db-restore: ## Restore SQLite from BACKUP=./backups/file.db.
	@if [ -z "$(BACKUP)" ]; then \
		echo "Usage: make db-restore BACKUP=./backups/personalhub-example.db"; \
		exit 1; \
	fi
	npm run db:restore -- "$(BACKUP)"

status: ## Show Git status, Docker status, and latest backups.
	@echo "Git status:"
	@git status --short
	@echo
	@echo "Docker Compose:"
	@docker compose ps || true
	@echo
	@echo "Latest backups:"
	@if ls backups/*.db >/dev/null 2>&1; then \
		ls -lt backups/*.db | head -5; \
	else \
		echo "No backup .db files found."; \
	fi

check: lint build ## Run lint and build.

reset-dev: ## Safely clear dev build output after confirmation; does not delete the database.
	@echo "This removes .next only. It does NOT delete ./data/personalhub.db."
	@printf "Type YES to continue: "; \
	read confirmation; \
	if [ "$$confirmation" = "YES" ]; then \
		rm -rf .next; \
		echo "Removed .next"; \
	else \
		echo "Cancelled. No changes were made."; \
	fi

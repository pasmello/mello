.PHONY: install dev build deploy migrate lint typecheck test clean compose-up compose-down

install:
	pnpm install

compose-up:
	docker compose -f infra/compose.dev.yml up -d

compose-down:
	docker compose -f infra/compose.dev.yml down

dev: compose-up
	pnpm dev

build:
	pnpm build

migrate:
	pnpm --filter @mello/api run migrate

deploy-api:
	pnpm --filter @mello/api run deploy

deploy-web:
	pnpm --filter @mello/web run deploy

deploy: deploy-api deploy-web

lint:
	pnpm lint

typecheck:
	pnpm typecheck

test:
	pnpm test

clean:
	pnpm -r run clean
	rm -rf node_modules apps/*/node_modules packages/*/node_modules apps/*/dist packages/*/dist apps/web/.svelte-kit apps/web/build

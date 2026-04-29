.PHONY: setup agent-install frontend-install backend-test agent-test frontend-build test dev

setup: agent-install frontend-install

agent-install:
	cd agent && npm install

frontend-install:
	npm --prefix frontend install

backend-test:
	cd backend && go test ./...

agent-test:
	cd agent && npm test

agent-typecheck:
	cd agent && npm run typecheck

frontend-build:
	npm --prefix frontend run build

test: backend-test agent-typecheck agent-test frontend-build

dev:
	bash ./scripts/dev.sh

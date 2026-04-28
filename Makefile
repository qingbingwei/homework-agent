.PHONY: backend-test agent-test frontend-build test

backend-test:
	cd backend && go test ./...

agent-test:
	cd agent && PYTHONPATH=. python3 -m pytest tests -q

frontend-build:
	npm --prefix frontend run build

test: backend-test agent-test frontend-build

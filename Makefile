.PHONY: setup agent-install frontend-install backend-test agent-test frontend-build test dev

setup: agent-install frontend-install

agent-install:
	python3 -m pip install -r agent/requirements.txt

frontend-install:
	npm --prefix frontend install

backend-test:
	cd backend && go test ./...

agent-test:
	cd agent && PYTHONPATH=. python3 -m pytest tests -q

frontend-build:
	npm --prefix frontend run build

test: backend-test agent-test frontend-build

dev:
	bash ./scripts/dev.sh

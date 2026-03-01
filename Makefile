PYTHON ?= python3.13
PIP := $(PYTHON) -m pip

.PHONY: help deps deps-lock lock doctor doctor-full run stop test

help:
	@echo "Available targets:"
	@echo "  make deps       - Install project dependencies from requirements.txt"
	@echo "  make deps-lock  - Install exact locked dependencies"
	@echo "  make lock       - Refresh requirements-lock.txt from current environment"
	@echo "  make doctor     - Check local Python/Streamlit/watchdog setup and app port"
	@echo "  make doctor-full - Run doctor + check key project files"
	@echo "  make run        - Run Streamlit app headless"
	@echo "  make stop       - Stop running Streamlit app"
	@echo "  make test       - Run project test script"

deps:
	$(PIP) install -r requirements.txt

deps-lock:
	$(PIP) install -r requirements-lock.txt

lock:
	$(PIP) freeze > requirements-lock.txt

doctor:
	@echo "== Environment =="
	@echo "python: $$($(PYTHON) --version)"
	@echo "pip: $$($(PIP) --version)"
	@echo "streamlit: $$(streamlit --version)"
	@echo "watchdog: $$($(PIP) show watchdog | awk '/^Version:/ {print $$2}')"
	@echo "== Health Check =="
	@curl -fsSI http://localhost:8501 >/dev/null && echo "port 8501: OK" || (echo "port 8501: NOT REACHABLE" && exit 1)

doctor-full: doctor
	@echo "== Key Files =="
	@[ -f requirements.txt ] && echo "requirements.txt: OK" || echo "requirements.txt: MISSING"
	@[ -f requirements-lock.txt ] && echo "requirements-lock.txt: OK" || echo "requirements-lock.txt: MISSING"
	@[ -f processed_emails.json ] && echo "processed_emails.json: OK" || echo "processed_emails.json: MISSING"
	@[ -f .env ] && echo ".env: OK" || echo ".env: MISSING (create if you use local env vars)"

run:
	streamlit run app.py --server.headless true

stop:
	pkill -f "streamlit run app.py" || true

test:
	$(PYTHON) test_processor.py
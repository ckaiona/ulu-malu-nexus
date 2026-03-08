# NEXUS Build & Deploy Targets
# Usage: make <target>

ACR      ?= crxphgjvtawmqvs.azurecr.io
RG       ?= rg-uluguardian
CAE      ?= cae-xphgjvtawmqvs
JOB      ?= nexus-scanner
SWA_NAME ?= ULUMaluCommandNexus
SUB      ?= $(shell az account show --query id -o tsv 2>/dev/null)

.PHONY: help build deploy scanner-build scanner-deploy scanner-job scanner-test swa-settings

help:
	@echo "NEXUS targets:"
	@echo "  make build           - Build React app (npm run build)"
	@echo "  make deploy          - Build + git push (triggers SWA GitHub Actions)"
	@echo "  make scanner-build   - Build + push scanner Docker image to ACR"
	@echo "  make scanner-deploy  - scanner-build + create/update Container App Job"
	@echo "  make scanner-test    - Manually trigger a test scan job execution"
	@echo "  make swa-settings    - Configure SWA app settings for scanner"

build:
	npm run build

deploy: build
	cd .. && git add -A && git commit -m "deploy: NEXUS update" && git push

# ── Scanner Docker image ──────────────────────────────────────────────────────

scanner-build:
	@echo "Building scanner image → $(ACR)/nexus-scanner:latest"
	az acr build \
		--registry crxphgjvtawmqvs \
		--image nexus-scanner:latest \
		--file ../scanner/Dockerfile \
		../scanner

# ── Container App Job ─────────────────────────────────────────────────────────

scanner-deploy: scanner-build
	@echo "Creating/updating Container App Job: $(JOB)"
	@if az containerapp job show --name $(JOB) --resource-group $(RG) &>/dev/null; then \
		echo "Job exists — updating image"; \
		az containerapp job update \
			--name $(JOB) \
			--resource-group $(RG) \
			--image $(ACR)/nexus-scanner:latest; \
	else \
		echo "Creating new job"; \
		az containerapp job create \
			--name $(JOB) \
			--resource-group $(RG) \
			--environment $(CAE) \
			--trigger-type Manual \
			--replica-timeout 600 \
			--replica-retry-limit 1 \
			--replica-completion-count 1 \
			--parallelism 1 \
			--image $(ACR)/nexus-scanner:latest \
			--registry-server $(ACR) \
			--cpu 1.0 \
			--memory 2Gi \
			--env-vars \
				NEXUS_API=https://blue-meadow-061a5911e.2.azurestaticapps.net/api \
				TARGET_URL=https://example.com \
				SCAN_TYPE=external \
				CLIENT_NAME=Test \
				SCAN_ID=S000; \
	fi
	@echo ""
	@echo "✓ Container App Job ready: $(JOB)"
	@echo "  Grant SWA managed identity 'Contributor' on the job:"
	@echo "  az role assignment create --role Contributor \\"
	@echo "    --assignee <SWA_PRINCIPAL_ID> \\"
	@echo "    --scope /subscriptions/$(SUB)/resourceGroups/$(RG)/providers/Microsoft.App/jobs/$(JOB)"

# ── Configure SWA app settings ────────────────────────────────────────────────

swa-settings:
	@echo "Configuring SWA app settings for scanner..."
	az staticwebapp appsettings set \
		--name $(SWA_NAME) \
		--setting-names \
			AZURE_SUBSCRIPTION_ID=$(SUB) \
			AZURE_RESOURCE_GROUP=$(RG) \
			SCANNER_JOB_NAME=$(JOB) \
			NEXUS_API_BASE=https://blue-meadow-061a5911e.2.azurestaticapps.net/api
	@echo "✓ SWA settings updated"
	@echo ""
	@echo "Next: enable managed identity on SWA and grant it job access."
	@echo "  az staticwebapp identity assign --name $(SWA_NAME) --resource-group $(RG)"

# ── Manual test trigger ───────────────────────────────────────────────────────

scanner-test:
	@echo "Triggering test scan execution..."
	az containerapp job start \
		--name $(JOB) \
		--resource-group $(RG) \
		--yaml - <<'EOF'
template:
  containers:
  - name: scanner
    env:
    - name: TARGET_URL
      value: https://scanme.nmap.org
    - name: SCAN_TYPE
      value: external
    - name: CLIENT_NAME
      value: "Test Client"
    - name: SCAN_ID
      value: TEST001
EOF
	@echo "✓ Test job started — check logs:"
	@echo "  az containerapp job execution list --name $(JOB) --resource-group $(RG)"

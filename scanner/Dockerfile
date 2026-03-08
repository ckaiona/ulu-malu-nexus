# NEXUS Active Scanner — Tier 2
# Runs nmap + nuclei against authorized targets, posts results back to NEXUS API
FROM node:20-alpine

# System tools
RUN apk add --no-cache \
    nmap \
    nmap-scripts \
    curl \
    wget \
    unzip \
    ca-certificates \
    openssl \
    bind-tools

# Install nuclei (latest stable)
ARG NUCLEI_VERSION=3.3.9
RUN ARCH=$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/') && \
    wget -q "https://github.com/projectdiscovery/nuclei/releases/download/v${NUCLEI_VERSION}/nuclei_${NUCLEI_VERSION}_linux_${ARCH}.zip" \
         -O /tmp/nuclei.zip && \
    unzip -q /tmp/nuclei.zip -d /usr/local/bin && \
    rm /tmp/nuclei.zip && \
    chmod +x /usr/local/bin/nuclei

# Update nuclei templates on first run (baked in here to speed up job start)
RUN nuclei -update-templates -silent 2>/dev/null || true

WORKDIR /app
COPY scan.js .
COPY package.json .
RUN npm install --omit=dev

CMD ["node", "scan.js"]

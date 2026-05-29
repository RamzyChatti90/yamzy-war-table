#!/usr/bin/env bash
# WAR TABLE ⚔ — install.sh (Linux / macOS / WSL)
# Usage :  curl -sL https://raw.githubusercontent.com/RamzyChatti90/yamzy-war-table/main/install.sh | bash

set -euo pipefail

EXTENSION_NAME='war-table'
REPO_URL='https://github.com/RamzyChatti90/yamzy-war-table.git'
JAR_VERSION='1.0.0'
JAR_URL="https://github.com/RamzyChatti90/yamzy-war-table/releases/download/v${JAR_VERSION}/war-table-backend-${JAR_VERSION}.jar"

YAMZY_HOME="${YAMZY_HOME:-$HOME/.yamzy}"
EXT_DIR="$YAMZY_HOME/extensions/$EXTENSION_NAME"

echo "→ YAMZY_HOME = $YAMZY_HOME"

# 1. Clone or pull
if [ -d "$EXT_DIR" ]; then
  echo "→ Extension déjà installée. Mise à jour…"
  cd "$EXT_DIR" && git pull origin main
else
  echo "→ Clone du repo war-table…"
  mkdir -p "$YAMZY_HOME/extensions"
  git clone --depth 1 "$REPO_URL" "$EXT_DIR"
  cd "$EXT_DIR"
fi

# 2. Download JAR
JAR_FILE="$EXT_DIR/backend/war-table-backend-${JAR_VERSION}.jar"
if [ ! -f "$JAR_FILE" ]; then
  echo "→ Téléchargement JAR backend ($JAR_VERSION)…"
  mkdir -p "$EXT_DIR/backend"
  curl -sL -o "$JAR_FILE" "$JAR_URL"
fi

# 3. Manifest read
DISPLAY_NAME=$(jq -r .displayName extension.json)
VERSION=$(jq -r .version extension.json)
AUTHOR=$(jq -r .author extension.json)
FE_PORT=$(jq -r .frontend.port extension.json)
BE_PORT=$(jq -r .backend.port extension.json)
echo "→ Installation $DISPLAY_NAME v$VERSION par $AUTHOR"

# 4. Docker compose up
echo "→ Build + start des conteneurs…"
docker compose up -d --build

# 5. Registry global
REG_FILE="$YAMZY_HOME/extensions.json"
if [ ! -f "$REG_FILE" ]; then
  echo '{"extensions":[]}' > "$REG_FILE"
fi

if ! jq -e ".extensions[] | select(.name == \"$EXTENSION_NAME\")" "$REG_FILE" >/dev/null; then
  tmp=$(mktemp)
  jq ".extensions += [{
    name: \"$EXTENSION_NAME\",
    displayName: \"$DISPLAY_NAME\",
    version: \"$VERSION\",
    installedAt: \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
    path: \"$EXT_DIR\",
    status: \"running\",
    frontendUrl: \"http://localhost:$FE_PORT\",
    backendUrl:  \"http://localhost:$BE_PORT\"
  }]" "$REG_FILE" > "$tmp" && mv "$tmp" "$REG_FILE"
  echo "✓ Extension enregistrée dans $REG_FILE"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✓ WAR TABLE ⚔ installé et lancé"
echo "═══════════════════════════════════════════════════════════"
echo "  Frontend : http://localhost:$FE_PORT/war-table"
echo "  Backend  : http://localhost:$BE_PORT/actuator/health"
echo "  Logs     : docker compose -f $EXT_DIR/docker-compose.yml logs -f"
echo "  Stop     : docker compose -f $EXT_DIR/docker-compose.yml down"
echo ""

#!/bin/bash

# ============================================================
# XPERT — Deploy Script (Frontend + Backend)
# Uso: ./deploy.sh
#
# O .env deve ser criado manualmente na VPS uma única vez:
#   nano /var/www/xpert/.env
# Depois disso, basta rodar ./deploy.sh para cada atualização.
# ============================================================

set -e

APP_DIR="/var/www/xpert"
DIST_DIR="$APP_DIR/dist"
SERVICE_NAME="xpert-api"

echo "🚀 Iniciando Deploy do XPERT..."
cd "$APP_DIR" || exit 1

# --- 1. Verificar se .env existe ---
if [ ! -f ".env" ]; then
    echo "❌ Arquivo .env não encontrado!"
    echo ""
    echo "Crie o .env na VPS com:"
    echo "  nano $APP_DIR/.env"
    echo ""
    echo "Conteúdo mínimo:"
    echo "  VITE_SUPABASE_URL=https://xxx.supabase.co"
    echo "  VITE_SUPABASE_ANON_KEY=xxx"
    echo "  VITE_API_URL=https://api.seudominio.com"
    echo "  OPENROUTER_API_KEY=xxx"
    echo "  OPENROUTER_MODEL=openai/gpt-4o-mini"
    echo "  PORT=3001"
    echo "  CORS_ORIGIN=https://seudominio.com"
    exit 1
fi

echo "✅ .env encontrado"

# --- 2. Instalar dependências ---
echo "📦 Instalando dependências..."
npm install

# --- 3. Build do Frontend (Vite) ---
echo "🏗️ Build do frontend..."
npm run build

# --- 5. Permissões do Nginx ---
echo "🔑 Ajustando permissões..."
sudo chown -R www-data:www-data "$DIST_DIR"
sudo chmod -R 755 "$DIST_DIR"

# --- 6. Configurar serviço systemd (apenas na primeira vez) ---
if [ ! -f "/etc/systemd/system/${SERVICE_NAME}.service" ]; then
    echo "📄 Criando serviço systemd: ${SERVICE_NAME}..."
    sudo tee /etc/systemd/system/${SERVICE_NAME}.service > /dev/null <<UNIT
[Unit]
Description=XPERT API Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=${APP_DIR}
ExecStart=/usr/bin/npx tsx server/index.ts
Restart=on-failure
RestartSec=5
EnvironmentFile=${APP_DIR}/.env
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
UNIT
    sudo systemctl daemon-reload
    sudo systemctl enable ${SERVICE_NAME}
fi

# --- 7. Reiniciar backend ---
echo "🔄 Reiniciando backend..."
sudo systemctl restart ${SERVICE_NAME}

sleep 2
if sudo systemctl is-active --quiet ${SERVICE_NAME}; then
    echo "✅ Backend rodando!"
else
    echo "❌ Falha no backend. Para ver o erro:"
    echo "   sudo journalctl -u ${SERVICE_NAME} -n 20"
fi

echo ""
echo "════════════════════════════════════════"
echo "  ✅ Deploy finalizado!"
echo "  Frontend → Nginx ($DIST_DIR)"
echo "  Backend  → systemd ($SERVICE_NAME)"
echo "════════════════════════════════════════"
echo ""
echo "  Comandos úteis:"
echo "  sudo systemctl status $SERVICE_NAME"
echo "  sudo journalctl -u $SERVICE_NAME -f"

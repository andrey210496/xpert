#!/bin/bash

# --- CONFIGURAÇÕES ---
APP_DIR="/var/www/xpert"
DIST_DIR="$APP_DIR/dist"

# Defina suas chaves aqui (ou melhor, passe como variáveis de ambiente da VPS)
# Exemplo: export VITE_GEMINI_API_KEY="sua_chave" && ./deploy.sh
GEMINI_KEY=${VITE_GEMINI_API_KEY:-"COLOQUE_SUA_CHAVE_AQUI"}
SUPABASE_URL=${VITE_SUPABASE_URL:-"https://seu-projeto.supabase.co"}
SUPABASE_KEY=${VITE_SUPABASE_ANON_KEY:-"sua-anon-key"}

echo "🚀 Iniciando Deploy do XPERT..."

# 1. Entrar no diretório
cd $APP_DIR || exit

# 2. Criar .env temporário
echo "📝 Criando arquivo .env temporário..."
cat <<EOF > .env
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_ANON_KEY=$SUPABASE_KEY
VITE_GEMINI_API_KEY=$GEMINI_KEY
VITE_UAZAPI_BASE_URL=$VITE_UAZAPI_BASE_URL
VITE_UAZAPI_INSTANCE_TOKEN=$VITE_UAZAPI_INSTANCE_TOKEN
VITE_SUPERADMIN_WHATSAPP=$VITE_SUPERADMIN_WHATSAPP
EOF

# 3. Instalar dependências (se necessário)
echo "📦 Instalando dependências..."
npm install

# 4. Rodar o Build
echo "🏗️ Executando Build (Vite)..."
npm run build

# 5. Limpar rastro (Excluir .env)
echo "🧹 Removendo arquivo .env por segurança..."
rm .env

# 6. Garantir permissões para o Nginx
echo "🔑 Ajustando permissões para www-data..."
sudo chown -R www-data:www-data $DIST_DIR
sudo chmod -R 755 $DIST_DIR

echo "✅ Deploy finalizado com sucesso!"
echo "ℹ️  O Nginx continuará servindo o diretório $DIST_DIR automaticamente."

#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$ROOT_DIR/infra/.env"

NETWORK="eventhub-net"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "ERROR: Missing $ENV_FILE" 
    exit 1
fi

source "$ENV_FILE"

require_cmd() {
    command -v "$1" || {
        echo "ERROR: '$1' is required." 
        exit 1
    }
}

require_cmd podman
require_cmd curl

remove_container() {
    local name="$1"

    if podman container exists "$name"; then
        podman rm -f "$name" || true
    fi
}

wait_mysql() {
    for _ in {1..120}; do
        if podman exec mysql \
            mysqladmin ping \
            -uroot \
            -p"$MYSQL_ROOT_PASSWORD" \
            --silent; then
            return 0
        fi
        sleep 1
    done

    echo "ERROR: MySQL did not become ready." 
    podman logs mysql  || true
    exit 1
}

wait_postgres() {
    for _ in {1..120}; do
        if podman exec postgres \
            pg_isready \
            -U "$POSTGRES_USER" \
            -d "$POSTGRES_DB"; then
            return 0
        fi
        sleep 1
    done

    echo "ERROR: PostgreSQL did not become ready." 
    podman logs postgres  || true
    exit 1
}

wait_mongodb() {
    for _ in {1..120}; do
        if podman exec mongodb \
            mongosh --quiet \
            --eval "db.adminCommand('ping').ok" 2>/dev/null |
            grep -q '^1$'; then
            return 0
        fi
        sleep 1
    done

    echo "ERROR: MongoDB did not become ready." 
    podman logs mongodb  || true
    exit 1
}

wait_redis() {
    for _ in {1..120}; do
        if [[ "$(podman exec redis redis-cli ping 2>/dev/null || true)" == "PONG" ]]; then
            return 0
        fi
        sleep 1
    done

    echo "ERROR: Redis did not become ready." 
    podman logs redis  || true
    exit 1
}

wait_rabbitmq() {
    for _ in {1..120}; do
        if podman exec rabbitmq \
            rabbitmq-diagnostics -q ping; then
            return 0
        fi
        sleep 1
    done

    echo "ERROR: RabbitMQ did not become ready." 
    podman logs rabbitmq  || true
    exit 1
}

wait_http() {
    local url="$1"
    local container="$2"

    for _ in {1..120}; do
        if curl -fsS "$url"; then
            return 0
        fi
        sleep 1
    done

    echo "ERROR: $container did not become ready: $url" 
    podman logs "$container"  || true
    exit 1
}

build_image() {
    local tag="$1"
    local directory="$2"

    podman build \
        -t "$tag" \
        "$directory"
}

if ! podman network exists "$NETWORK"; then
    podman network create "$NETWORK"
fi

podman volume exists eventhub-mysql ||
    podman volume create eventhub-mysql

podman volume exists eventhub-postgres ||
    podman volume create eventhub-postgres

podman volume exists eventhub-mongo ||
    podman volume create eventhub-mongo

podman volume exists eventhub-redis ||
    podman volume create eventhub-redis

podman volume exists eventhub-rabbitmq ||
    podman volume create eventhub-rabbitmq

podman volume exists ollama-data ||
    podman volume create ollama-data

remove_container mysql

podman run -d \
    --name mysql \
    --network "$NETWORK" \
    -v eventhub-mysql:/var/lib/mysql \
    -e MYSQL_ROOT_PASSWORD="$MYSQL_ROOT_PASSWORD" \
    -e MYSQL_DATABASE="$MYSQL_DATABASE" \
    docker.io/library/mysql:8

wait_mysql

remove_container postgres

podman run -d \
    --name postgres \
    --network "$NETWORK" \
    -v eventhub-postgres:/var/lib/postgresql/data \
    -e POSTGRES_USER="$POSTGRES_USER" \
    -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
    -e POSTGRES_DB="$POSTGRES_DB" \
    docker.io/library/postgres:16

wait_postgres

remove_container mongodb

podman run -d \
    --name mongodb \
    --network "$NETWORK" \
    -v eventhub-mongo:/data/db \
    docker.io/library/mongo:8

wait_mongodb

remove_container redis

podman run -d \
    --name redis \
    --network "$NETWORK" \
    -v eventhub-redis:/data \
    docker.io/library/redis:7 \
    redis-server --appendonly yes

wait_redis

remove_container rabbitmq

podman run -d \
    --name rabbitmq \
    --network "$NETWORK" \
    -v eventhub-rabbitmq:/var/lib/rabbitmq \
    docker.io/library/rabbitmq:3-management

wait_rabbitmq

build_image \
    eventhub-auth \
    "$ROOT_DIR/services/auth-service-node"

build_image \
    eventhub-catalog \
    "$ROOT_DIR/services/legacy-catalog-java"

build_image \
    eventhub-booking \
    "$ROOT_DIR/services/booking-service-python"

build_image \
    eventhub-notification-worker \
    "$ROOT_DIR/services/notification-worker-go"

build_image \
    eventhub-ai-insight \
    "$ROOT_DIR/services/ai-insight-service-python"

build_image \
    eventhub-analytics \
    "$ROOT_DIR/services/analytics-service-python"

build_image \
    eventhub-gateway \
    "$ROOT_DIR/gateway"

build_image \
    eventhub-frontend \
    "$ROOT_DIR/frontend"

remove_container ollama

podman run -d \
    --name ollama \
    --network "$NETWORK" \
    -v ollama-data:/root/.ollama \
    -e OLLAMA_HOST=0.0.0.0:11434 \
    -p 11434:11434 \
    docker.io/ollama/ollama \
    serve

for _ in {1..120}; do
    if curl -fsS http://localhost:11434/api/tags; then
        break
    fi
    sleep 1
done

if ! curl -fsS http://localhost:11434/api/tags; then
    echo "ERROR: Ollama did not become ready." 
    podman logs ollama || true
    exit 1
fi

podman exec ollama \
    ollama pull "$OLLAMA_MODEL"

remove_container auth-service

podman run -d \
    --name auth-service \
    --network "$NETWORK" \
    -p 8082:8082 \
    -e PORT=8082 \
    -e PGHOST=postgres \
    -e PGPORT=5432 \
    -e PGUSER="$POSTGRES_USER" \
    -e PGPASSWORD="$POSTGRES_PASSWORD" \
    -e PGDATABASE="$POSTGRES_DB" \
    -e JWT_SECRET="$JWT_SECRET" \
    eventhub-auth

wait_http \
    "http://localhost:8082/health" \
    auth-service

remove_container catalog-service

podman run -d \
    --name catalog-service \
    --network "$NETWORK" \
    -p 8081:8081 \
    -e SPRING_DATASOURCE_URL="jdbc:mysql://mysql:3306/eventhub_catalog" \
    -e SPRING_DATASOURCE_USERNAME="root" \
    -e SPRING_DATASOURCE_PASSWORD="$MYSQL_ROOT_PASSWORD" \
    eventhub-catalog

wait_http \
    "http://localhost:8081/api/catalog" \
    catalog-service

podman exec mysql mysql \
    -uroot \
    -p"$MYSQL_ROOT_PASSWORD" \
    eventhub_catalog 

remove_container booking-service

podman run -d \
    --name booking-service \
    --network "$NETWORK" \
    -p 8083:8083 \
    -e PORT=8083 \
    -e MONGO_URI="mongodb://mongodb:27017" \
    -e MONGO_DB="$MONGO_DB" \
    -e RABBITMQ_URL="amqp://guest:guest@rabbitmq:5672/" \
    -e AI_INSIGHT_URL="http://ai-insight-service:8084" \
    eventhub-booking

wait_http \
    "http://localhost:8083/health" \
    booking-service

remove_container notification-worker

podman run -d \
    --name notification-worker \
    --network "$NETWORK" \
    eventhub-notification-worker

remove_container ai-insight-service

podman run -d \
    --name ai-insight-service \
    --network "$NETWORK" \
    -p 8084:8084 \
    -e PORT=8084 \
    -e OLLAMA_URL="http://ollama:11434" \
    -e OLLAMA_MODEL="$OLLAMA_MODEL" \
    eventhub-ai-insight

wait_http \
    "http://localhost:8084/health" \
    ai-insight-service

remove_container analytics-service

podman run -d \
    --name analytics-service \
    --network "$NETWORK" \
    -p 8085:8085 \
    -e PORT=8085 \
    -e REDIS_URL="redis://redis:6379/0" \
    -e BOOKING_SERVICE_URL="http://booking-service:8083" \
    -e CATALOG_SERVICE_URL="http://catalog-service:8081" \
    -e SNAPSHOT_KEY="$SNAPSHOT_KEY" \
    eventhub-analytics

wait_http \
    "http://localhost:8085/health" \
    analytics-service

remove_container gateway

podman run -d \
    --name gateway \
    --network "$NETWORK" \
    -p 8080:8080 \
    eventhub-gateway

wait_http \
    "http://localhost:8080/health" \
    gateway

remove_container frontend

podman run -d \
    --name frontend \
    --network "$NETWORK" \
    -p 3000:3000 \
    eventhub-frontend

wait_http \
    "http://localhost:3000" \
    frontend

podman run --rm \
    --network "$NETWORK" \
    -e REDIS_URL="redis://redis:6379/0" \
    -e BOOKING_SERVICE_URL="http://booking-service:8083" \
    -e CATALOG_SERVICE_URL="http://catalog-service:8081" \
    -e SNAPSHOT_KEY="$SNAPSHOT_KEY" \
    eventhub-analytics \
    python job.py

exit 0

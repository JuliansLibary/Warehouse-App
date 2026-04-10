-- PostgreSQL initialization script
-- Runs once when the container is first created (data volume is empty).
-- Creates both application databases and grants all necessary privileges.

-- 1. Application database (EF Core / warehouse backend)
SELECT 'CREATE DATABASE warehousedb'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'warehousedb')\gexec

GRANT ALL PRIVILEGES ON DATABASE warehousedb TO warehouse;

-- 2. Keycloak database
SELECT 'CREATE DATABASE keycloakdb'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'keycloakdb')\gexec

GRANT ALL PRIVILEGES ON DATABASE keycloakdb TO warehouse;

-- 3. Schema permissions (needed for Keycloak 24+ with PostgreSQL)
\connect keycloakdb
GRANT ALL ON SCHEMA public TO warehouse;
ALTER SCHEMA public OWNER TO warehouse;

\connect warehousedb
GRANT ALL ON SCHEMA public TO warehouse;
ALTER SCHEMA public OWNER TO warehouse;

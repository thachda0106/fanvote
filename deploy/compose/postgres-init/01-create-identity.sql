-- Runs once on the pg-app container's first boot: identity is a separate
-- logical database on the shared app Postgres instance (ADR-0004).
CREATE DATABASE identity;

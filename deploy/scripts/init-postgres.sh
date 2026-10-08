set -eu
test -n "${CRM_DB_USER:-}"
test "${CRM_DB_USER}" != "${POSTGRES_USER}"
test -n "${CRM_DB_PASSWORD:-}"
test "${#CRM_DB_PASSWORD}" -ge 32
psql -X -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
\getenv app_role CRM_DB_USER
\getenv app_password CRM_DB_PASSWORD
CREATE ROLE :"app_role" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD :'app_password';
SQL

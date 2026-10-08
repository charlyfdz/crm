set -eu
test -n "${REDIS_PASSWORD:-}"
test "${#REDIS_PASSWORD}" -ge 32
test -n "${CRM_REDIS_MAXMEMORY:-}"
case "$CRM_REDIS_MAXMEMORY" in
  *[!0-9bBkKmMgG]*) printf '%s\n' 'CRM_REDIS_MAXMEMORY needs a memory value' >&2; exit 1 ;;
esac
case "$REDIS_PASSWORD" in
  *[!a-fA-F0-9]*) printf '%s\n' 'REDIS_PASSWORD must use hexadecimal characters' >&2; exit 1 ;;
esac
umask 077
printf 'bind 0.0.0.0\nprotected-mode yes\nport 6379\nrequirepass %s\ndir /data\nappendonly no\nsave ""\nmaxmemory %s\nmaxmemory-policy allkeys-lru\n' "$REDIS_PASSWORD" "$CRM_REDIS_MAXMEMORY" > /tmp/redis.conf
exec /usr/local/bin/docker-entrypoint.sh redis-server /tmp/redis.conf

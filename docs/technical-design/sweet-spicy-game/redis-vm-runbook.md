# Redis VM Deployment Runbook

This runbook covers self-hosted Redis on the VM for project-scale deployment.

---

## 1. Install Redis (Ubuntu)

```bash
sudo apt-get update
sudo apt-get install -y redis-server
```

Enable auto-start:

```bash
sudo systemctl enable redis-server
sudo systemctl start redis-server
sudo systemctl status redis-server
```

---

## 2. Basic Redis Configuration

Edit `/etc/redis/redis.conf`:

```conf
bind 127.0.0.1
port 6379
protected-mode yes
appendonly yes
appendfsync everysec
maxmemory-policy allkeys-lru
```

Restart:

```bash
sudo systemctl restart redis-server
```

Validate:

```bash
redis-cli ping
```

Expected output: `PONG`.

---

## 3. API Environment

Set in `apps/api/.env`:

```env
REDIS_URL=redis://127.0.0.1:6379
```

The API behavior:

- If Redis is up: Socket.IO Redis adapter enabled and room state stored in Redis.
- If Redis is down/missing: API falls back to in-memory behavior (single instance only).

---

## 4. Health Checks

Recommended checks:

1. `redis-cli ping` from host.
2. API startup logs include Redis connection success.
3. API health endpoint reports room count without errors.
4. Room create/join/start flow works after API restart (state should survive once Redis-backed path is active).

---

## 5. Keyspace Reference

- `room:{ROOM_CODE}`
- `user-room:{USER_ID}`
- `rooms:active`

Redis is schema-less, so there is no migration step like Prisma.  
Only PostgreSQL uses Prisma migrations (`prisma migrate deploy`).

TTL policy:

- Waiting room: 24h sliding TTL.
- In-progress room: no TTL.
- Finished/cancelled snapshot: 6h TTL.

---

## 6. Backup and Recovery (Project Level)

1. Keep AOF enabled (`appendonly yes`).
2. Backup `/var/lib/redis` periodically (daily is usually enough for this scope).
3. On restore, restart Redis and verify key existence for active rooms.

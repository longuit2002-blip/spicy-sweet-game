# Hướng dẫn deploy lại khi đổi code (Sweet & Spicy)

Tài liệu tiếng Việt bổ sung cho [devops-setup-and-deploy.md](./devops-setup-and-deploy.md). Mục tiêu: biết **thay đổi nào** cần **build image**, **push GHCR**, và **chạy lại** trên server.

## Hai service độc lập

| Image | Ứng dụng | Build từ |
|-------|-----------|----------|
| **`sweet-spicy-api`** | `apps/api` (NestJS, Prisma, Socket.IO) | `docker build -f apps/api/Dockerfile` (context = **gốc monorepo**) |
| **`sweet-spicy-web`** | `apps/web` (Next.js) | `docker build -f apps/web/Dockerfile` (cùng context) |

**Luôn build từ thư mục có `apps/`, `pnpm-lock.yaml`** (ví dụ `~/spicy-sweet-game`). **Không** build từ `/opt/sweet-spicy` (chỉ có compose + `.env`).

---

## Bảng tra nhanh: đổi gì → làm gì

| Thay đổi trong code/repo | Cần build image mới? | Cần deploy lại VM? | Ghi chú |
|--------------------------|---------------------|-------------------|---------|
| **Backend** `apps/api` (controller, service, socket, DTO, v.v.) | **Có — api** | **Có** (pull + up) | Build + push `api`, tăng tag (vd `v3`), `export API_IMAGE=...` rồi `./deploy-vm.sh` hoặc `compose up -d`. |
| **Frontend** `apps/web` (UI, page, store — không phải env public) | **Có — web** | **Có** | Build + push `web`, cùng `--build-arg NEXT_PUBLIC_*` hiện tại. |
| **Biến `NEXT_PUBLIC_*`** hoặc đổi **domain / IP public** trong bundle trình duyệt | **Có — web** | **Có** | Giá trị này **embed lúc build** Next. Sửa `.env` trên server **chưa đủ** ; phải **rebuild web** với `--build-arg` đúng + cập nhật `.env` + deploy. |
| Chỉ **`CLIENT_URL`**, `JWT_SECRET`, `DATABASE_URL`, `PORT` (api đã có trong compose), v.v. trong **`.env`** | **Không** (nếu không đổi code trong image) | **Có — nhẹ** | `nano /opt/sweet-spicy/.env` → `docker compose -f docker-compose.prod.yml up -d` (hoặc `./deploy-vm.sh` với cùng `WEB_IMAGE`/`API_IMAGE`). |
| **Prisma** `schema.prisma` / migration | **Có — api** (sau khi đổi code generate/build) | **Có** | Sau deploy: `prisma migrate deploy` hoặc `db push` (xem guide chính). Rollback **image** không tự revert DB. |
| **`packages/shared-types`** hoặc **`packages/game-logic`** | **Có — thường cả api và web** | **Có** | Cả hai image đều phụ thuộc package; an toàn nhất: rebuild **api** + **web**. |
| **`docker-compose.prod.yml`** trên server | **Không** | **Có** | Copy file mới vào `/opt/sweet-spicy` → `compose up -d`. |
| **Nginx** `deploy/vm/nginx/default.conf` | **Không** | **Có** | Sửa file trong `/etc/nginx/...` → `sudo nginx -t` → `reload`. |
| **Dockerfile**, **`.dockerignore`** | **Có** (image bị ảnh hưởng) | **Có** | Build lại image đó, push tag mới, deploy. |

---

## Quy trình chuẩn sau khi sửa code

### 1. Trên máy có Docker (PC hoặc server đủ ổ đĩa)

```bash
cd ~/spicy-sweet-game   # hoặc đường dẫn repo
git pull
```

**API** (đổi tag mỗi lần release, vd `v3`):

```bash
docker build -f apps/api/Dockerfile -t ghcr.io/longuit2002-blip/sweet-spicy-api:v3 .
```

**Web** (thay IP/domain cho đúng môi trường):

```bash
docker build -f apps/web/Dockerfile -t ghcr.io/longuit2002-blip/sweet-spicy-web:v3 . \
  --build-arg NEXT_PUBLIC_API_URL=http://YOUR_PUBLIC_IP/api \
  --build-arg NEXT_PUBLIC_SOCKET_URL=http://YOUR_PUBLIC_IP
```

### 2. Đăng nhập GHCR và push

```bash
docker login ghcr.io -u longuit2002-blip
docker push ghcr.io/longuit2002-blip/sweet-spicy-api:v3
docker push ghcr.io/longuit2002-blip/sweet-spicy-web:v3
```

### 3. Trên EC2 (`/opt/sweet-spicy`)

Cập nhật `.env` nếu cần (URL public, DB, bí mật):

```bash
nano /opt/sweet-spicy/.env
```

Deploy:

```bash
cd /opt/sweet-spicy
export WEB_IMAGE=ghcr.io/longuit2002-blip/sweet-spicy-web:v3
export API_IMAGE=ghcr.io/longuit2002-blip/sweet-spicy-api:v3
./deploy-vm.sh
```

(hoặc `docker compose -f docker-compose.prod.yml up -d` nếu đã login và đã export biến.)

### 4. DB (nếu đổi Prisma)

```bash
docker compose -f /opt/sweet-spicy/docker-compose.prod.yml exec api \
  sh -c "cd /app/apps/api && npx prisma migrate deploy"
```

---

## Phân biệt env “build-time” và “runtime”

- **`NEXT_PUBLIC_*`**: Next.js đọc lúc **build** `web`. Đổi IP/domain → **build lại web** + `--build-arg` tương ứng.
- **`CLIENT_URL`**, **`DATABASE_URL`**, **`JWT_SECRET`**: thường chỉ cần sửa **`/opt/sweet-spicy/.env`** và **`compose up -d`** (api đọc runtime).
- **`PORT`**: do **`docker-compose.prod.yml`** set riêng `web` = 3000, `api` = 8000 — **không** nên đặt một `PORT` chung trong `.env` cho cả hai container.

---

## Kiểm tra nhanh sau deploy

```bash
docker compose -f /opt/sweet-spicy/docker-compose.prod.yml ps
curl -sS http://127.0.0.1/api/health
```

Guest login (POST):

```bash
curl -sS -X POST http://127.0.0.1/api/auth/guest \
  -H 'Content-Type: application/json' \
  -d '{"nickname":"test"}'
```

Trình duyệt: `http://YOUR_PUBLIC_IP` (không mở `/api/auth/guest` bằng GET trên thanh địa chỉ).

---

## Rollback

Giữ tag cũ (vd `v2`) đã chạy ổn:

```bash
export WEB_IMAGE=ghcr.io/longuit2002-blip/sweet-spicy-web:v2
export API_IMAGE=ghcr.io/longuit2002-blip/sweet-spicy-api:v2
/opt/sweet-spicy/deploy-vm.sh
```

---

## Xem thêm

- Hướng dẫn đầy đủ (English): [devops-setup-and-deploy.md](./devops-setup-and-deploy.md)
- Máy EC2 ổ nhỏ (8 GiB): nên **build trên laptop** rồi chỉ **pull** trên server; hoặc tăng dung lượng EBS.

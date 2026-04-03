# DevOps Roadmap For Sweet & Spicy: Docker, Jenkins, AWS/GCP

## Mục tiêu

Tài liệu này tập trung vào một learning path thực dụng cho repo `spicy-sweet-game`:

- Dockerize được project
- dựng được Jenkins pipeline
- build và push image lên registry
- deploy được lên cloud theo hướng đơn giản, dễ học, dễ maintain

Phạm vi hiện tại không bao gồm Kubernetes.

## Kết luận ngắn

Nếu mục tiêu là học DevOps bài bản nhưng vẫn bám sát project này, thứ tự nên là:

1. chuẩn hóa local build
2. Dockerize `web` và `api`
3. dựng Jenkins CI/CD
4. deploy lên cloud qua VM hoặc managed container service

Trong giai đoạn đầu, nên ưu tiên:

- `Jenkins + Docker + AWS EC2`
hoặc
- `Jenkins + Docker + Google Compute Engine`

Đây là hướng dễ hiểu nhất vì:

- không có quá nhiều moving parts
- dễ nhìn thấy toàn bộ flow CI/CD
- vẫn học được image build, registry, env, deploy, rollback

## AWS hay GCP?

### Nếu muốn dễ kiếm tài liệu và phổ biến hơn

Chọn `AWS`.

Stack đề xuất:

- Jenkins
- Docker
- GitHub Container Registry hoặc Docker Hub
- AWS EC2 để chạy `web` và `api`
- Nginx làm reverse proxy

### Nếu muốn giao diện gọn, VM đơn giản, trải nghiệm khá dễ chịu

Chọn `GCP`.

Stack đề xuất:

- Jenkins
- Docker
- Artifact Registry hoặc Docker Hub
- Google Compute Engine
- Nginx làm reverse proxy

## Khuyến nghị thực tế cho learning path

Nếu bạn chưa từng triển khai CI/CD hoàn chỉnh, tôi khuyên:

1. bắt đầu với `Jenkins + Docker + một VM`
2. chỉ khi đã quen mới học thêm ECS, Cloud Run, hoặc Kubernetes

Lý do:

- VM giúp bạn hiểu bản chất deploy
- bạn học được SSH, systemd, env file, reverse proxy, port mapping
- debug dễ hơn managed platform

## Kiến trúc đề xuất cho repo này

Repo hiện tại có:

- `apps/web`: Next.js frontend
- `apps/api`: backend realtime/API
- `packages/*`: shared packages

Mô hình deploy phù hợp:

- 1 container cho `web`
- 1 container cho `api`
- 1 reverse proxy ở cloud VM

Cloud runtime ở giai đoạn đầu:

- một máy ảo duy nhất chạy cả `web` và `api`

Điều này đủ tốt để học:

- build image
- push image
- pull image trên server
- restart container an toàn
- cấu hình domain và reverse proxy

## Kiến trúc CI/CD mục tiêu

```text
Developer Push
  -> Jenkins Pipeline
    -> Install
    -> Typecheck
    -> Lint
    -> Test
    -> Build
    -> Docker Build
    -> Docker Push
    -> SSH Deploy To Cloud VM
      -> pull new images
      -> recreate containers
      -> health check
```

## Roadmap triển khai

### Phase 1: Foundation

Mục tiêu:

- chuẩn hóa build local
- chuẩn hóa env
- xác định rõ entrypoint của từng app

Deliverables:

- `.env.example`
- script root rõ ràng trong `package.json`
- tài liệu local run

Checklist:

- `pnpm install`
- `pnpm typecheck`
- `pnpm build`
- `web` chạy độc lập
- `api` chạy độc lập

Tiêu chí xong:

- bất kỳ ai clone repo cũng biết cần env gì và chạy lệnh gì

### Phase 2: Dockerize

Mục tiêu:

- đóng gói `web` và `api` thành image riêng
- có `docker-compose` cho local và cho server

Deliverables:

- `docker/web/Dockerfile`
- `docker/api/Dockerfile`
- `docker/compose/docker-compose.dev.yml`
- `docker/compose/docker-compose.prod.yml`
- `.dockerignore`

Nguyên tắc:

- multi-stage build
- runtime image càng nhỏ càng tốt
- không hardcode env vào image nếu không bắt buộc

### Phase 3: Jenkins CI

Mục tiêu:

- mỗi push đều đi qua quality gate
- pipeline build được image ổn định

Deliverables:

- `Jenkinsfile`
- credentials cho registry
- credentials cho SSH deploy

Stage đề xuất:

1. `Checkout`
2. `Install`
3. `Typecheck`
4. `Lint`
5. `Test`
6. `Build`
7. `Docker Build`
8. `Docker Push`

Tiêu chí xong:

- pipeline fail sớm nếu code lỗi
- image được gắn tag theo `branch` và `commit SHA`

### Phase 4: Cloud Deploy

Mục tiêu:

- deploy image mới lên cloud VM bằng Jenkins
- rollback được ở mức cơ bản

Deliverables:

- một VM trên AWS EC2 hoặc GCP Compute Engine
- Docker Engine cài trên VM
- file compose production trên server
- deploy stage trong Jenkins

Flow deploy:

1. Jenkins SSH vào VM
2. pull image mới
3. stop container cũ
4. start container mới
5. health check
6. nếu fail thì rollback về image trước

## Hướng triển khai khuyên dùng

### Option A: AWS EC2

Đây là đường học tốt nhất nếu muốn gần với môi trường thực tế phổ biến.

Thành phần:

- `EC2`
- `Security Group`
- `Elastic IP` nếu cần IP ổn định
- `Nginx`
- `Docker Engine`
- registry: `Docker Hub`, `GHCR`, hoặc `Amazon ECR`

Flow:

- Jenkins build image
- push lên registry
- SSH vào EC2
- pull image
- `docker compose up -d`

Ưu điểm:

- tài liệu nhiều
- học được cách triển khai trên Linux server
- dễ mở rộng sau này sang ECS

Nhược điểm:

- bạn phải tự quản lý VM
- cần tự làm reverse proxy, TLS, log, backup cơ bản

### Option B: GCP Compute Engine

Nếu muốn deploy kiểu tương tự EC2 nhưng trên GCP.

Thành phần:

- `Compute Engine`
- `Firewall Rules`
- `Static IP` nếu cần
- `Nginx`
- `Docker Engine`
- registry: `Artifact Registry`, `Docker Hub`, hoặc `GHCR`

Flow gần như giống hệt AWS EC2.

Ưu điểm:

- setup VM khá dễ
- giao diện quản trị tương đối gọn

Nhược điểm:

- ít phổ biến hơn AWS trong nhiều team backend/platform

## Nên dùng registry nào?

### Cách đơn giản nhất để học nhanh

Chọn `Docker Hub` hoặc `GitHub Container Registry`.

Lý do:

- setup nhanh
- dễ tích hợp Jenkins
- không khóa bạn vào cloud cụ thể

### Khi muốn cloud-native hơn

- AWS: dùng `Amazon ECR`
- GCP: dùng `Artifact Registry`

Khuyến nghị:

Giai đoạn đầu nên dùng `GHCR` hoặc `Docker Hub`.

## Jenkins deploy strategy

### Cách đơn giản và maintainable

Jenkins không nên tự chứa toàn bộ logic deploy dài dòng.

Nên tách:

- `Jenkinsfile`: orchestration
- `scripts/ci/*.ps1` hoặc `scripts/ci/*.sh`: logic build/test
- `scripts/deploy/*.sh`: logic deploy

Ví dụ cấu trúc:

```text
ci/
  jenkins/
    README.md

scripts/
  ci/
    install.sh
    typecheck.sh
    lint.sh
    test.sh
    build.sh
  deploy/
    deploy-vm.sh
    rollback-vm.sh
```

## Mô hình deploy production đầu tiên

### Khuyến nghị

Một VM, hai container, một reverse proxy.

Ví dụ:

- `web` chạy cổng nội bộ `3000`
- `api` chạy cổng nội bộ `8000`
- `nginx` public `80/443`

Nginx route:

- `/` -> `web`
- `/api` -> `api`
- `/socket.io` -> `api`

Điểm quan trọng với project này:

- Socket.IO cần reverse proxy hỗ trợ websocket upgrade
- CORS và `NEXT_PUBLIC_API_URL` phải đồng bộ với domain thực tế

## Variables và secrets cần quản lý

### Trên Jenkins

- `REGISTRY_USERNAME`
- `REGISTRY_TOKEN`
- `SSH_PRIVATE_KEY`
- `DEPLOY_HOST`
- `DEPLOY_USER`

### Trên server

- `NEXT_PUBLIC_API_URL`
- `API_PORT`
- `CORS_ORIGIN`
- `JWT_SECRET`
- các env khác của backend

Nguyên tắc:

- secret không commit vào repo
- chỉ commit file example

## File backlog nên tạo

### Foundation

- `.env.example`
- `README` section cho local run

### Docker

- `docker/web/Dockerfile`
- `docker/api/Dockerfile`
- `docker/compose/docker-compose.dev.yml`
- `docker/compose/docker-compose.prod.yml`
- `.dockerignore`

### CI/CD

- `Jenkinsfile`
- `ci/jenkins/README.md`
- `scripts/ci/install.sh`
- `scripts/ci/typecheck.sh`
- `scripts/ci/lint.sh`
- `scripts/ci/test.sh`
- `scripts/ci/build.sh`
- `scripts/deploy/deploy-vm.sh`
- `scripts/deploy/rollback-vm.sh`

## Sprint plan đề xuất

### Sprint 1

Mục tiêu:

- chuẩn hóa scripts
- xác định env
- build local ổn định

Kết quả:

- `pnpm typecheck`
- `pnpm build`
- `.env.example`

### Sprint 2

Mục tiêu:

- Dockerize `api`
- Dockerize `web`
- compose chạy local

Kết quả:

- Dockerfile cho `api`
- Dockerfile cho `web`
- compose local

### Sprint 3

Mục tiêu:

- Jenkins CI

Kết quả:

- pipeline build, typecheck, lint, test
- image push lên registry

### Sprint 4

Mục tiêu:

- deploy cloud bằng Jenkins

Kết quả:

- Jenkins có stage deploy
- app chạy trên EC2 hoặc Compute Engine
- domain trỏ đúng

## Anti-pattern cần tránh

- viết pipeline trước khi local build chưa ổn
- hardcode secret vào `docker-compose` hoặc script
- để Jenkinsfile quá dài và khó đọc
- gắn chặt deploy vào một cloud-specific service quá sớm
- đẩy thẳng production mà không có health check sau deploy
- để frontend gọi API bằng `localhost` khi đã lên cloud

## Definition of done

### Done cho Docker

- `web` và `api` đều build được bằng Docker
- local compose chạy được full stack

### Done cho Jenkins

- mỗi push chạy được pipeline
- image được build và push ổn định

### Done cho cloud deploy

- Jenkins deploy được lên VM
- ứng dụng truy cập được qua domain hoặc IP
- websocket hoạt động
- rollback thủ công được

## Khuyến nghị chốt

Nếu bạn muốn vừa học vừa áp dụng nhanh cho repo này, hướng tốt nhất hiện tại là:

1. Dockerize repo
2. dùng Jenkins để build và push image
3. deploy lên `AWS EC2` hoặc `GCP Compute Engine`
4. chỉ sau đó mới cân nhắc dịch chuyển sang service nâng cao hơn như `ECS` hoặc `Cloud Run`

Nếu phải chọn một hướng cụ thể ngay bây giờ, tôi khuyên:

- `AWS EC2 + Jenkins + Docker + GHCR`

Đây là tổ hợp dễ học, dễ debug, ít abstraction, và đủ tốt để bạn hiểu đúng CI/CD end-to-end.

# DevOps Learning Path For Sweet & Spicy

## Mục tiêu

Tài liệu này định nghĩa một lộ trình DevOps thực tế cho repo `spicy-sweet-game`, với mục tiêu:

- học bài bản theo thứ tự từ dễ đến khó
- giữ kiến trúc clean và maintainable
- tránh nhảy quá sớm vào Kubernetes khi Docker và CI chưa ổn
- biến repo hiện tại thành một playground đủ tốt để luyện `build`, `test`, `package`, `deploy`

Hướng đi được đề xuất là:

1. chuẩn hóa build và runtime local
2. Dockerize từng service
3. thêm CI bằng Jenkins
4. thêm CD local lên Kubernetes
5. sau cùng mới tối ưu observability, rollback, release strategy

## Nguyên tắc thiết kế

- Mỗi bước phải chạy được độc lập trước khi sang bước tiếp theo.
- Không hardcode secret, token, password trong source code hay pipeline.
- CI chỉ build thứ đã chạy được local.
- Docker image phải reproducible, nhỏ gọn, và có healthcheck rõ ràng.
- Môi trường deploy phải tách config ra khỏi image.
- Monorepo cần một entrypoint rõ ràng cho build, test, và deploy.

## Phạm vi repo hiện tại

Repo đang có cấu trúc chính:

- `apps/web`: Next.js frontend
- `apps/api`: backend API realtime
- `packages/*`: shared packages
- `docs/`: tài liệu kỹ thuật

Điều này phù hợp với mô hình 2 service chính:

- `web`
- `api`

Nếu về sau có DB, cache, queue, monitoring thì thêm thành service phụ, không trộn vào image chính.

## Mô hình học đề xuất

### Giai đoạn 1: Build Foundation

Mục tiêu:

- hiểu rõ project chạy như thế nào
- chuẩn hóa script build/test/typecheck
- xác định dependency runtime của `web` và `api`

Đầu ra cần có:

- script root rõ ràng trong `package.json`
- xác định port chuẩn cho từng app
- chuẩn hóa file env mẫu
- thống nhất cách chạy local trước khi dockerize

Checklist:

1. xác nhận lệnh local chuẩn:
- `pnpm install`
- `pnpm --filter web dev` hoặc script tương đương
- `pnpm --filter api dev` hoặc script tương đương
- `pnpm typecheck`
- `pnpm build`

2. xác nhận biến môi trường cần thiết:
- `NEXT_PUBLIC_API_URL`
- `API_PORT`
- `CORS_ORIGIN`
- JWT secret
- database URL nếu có

3. tạo tài liệu môi trường:
- `.env.example`
- `.env.web.example`
- `.env.api.example`

Rủi ro cần tránh:

- script root không nhất quán
- mỗi app dùng port hoặc env theo kiểu ngầm định
- build local chưa ổn mà đã viết Dockerfile

### Giai đoạn 2: Dockerize

Mục tiêu:

- đóng gói `web` và `api` thành image riêng
- chạy local stack bằng Docker Compose
- tách rõ build-time và runtime config

Kiến trúc đề xuất:

- `Dockerfile.web`
- `Dockerfile.api`
- `docker-compose.dev.yml`
- `docker-compose.ci.yml`

Khuyến nghị cấu trúc thư mục:

```text
docker/
  web/
    Dockerfile
  api/
    Dockerfile
  compose/
    docker-compose.dev.yml
    docker-compose.ci.yml
  env/
    web.env.example
    api.env.example
```

### Docker strategy cho `apps/web`

Mục tiêu:

- multi-stage build
- tách dependency install và runtime
- chỉ copy phần cần thiết cho app chạy

Stage đề xuất:

1. `base`
- cài `pnpm`
- set working directory

2. `deps`
- copy lockfile + package manifests
- install dependencies

3. `builder`
- copy source
- build Next.js app

4. `runner`
- copy artifact cần thiết
- expose port
- start app

Điểm cần lưu ý:

- nếu dùng standalone output của Next.js thì runtime image sẽ gọn hơn
- không copy toàn bộ repo vào runtime image nếu không cần
- cần phân biệt env compile-time và runtime cho frontend

### Docker strategy cho `apps/api`

Mục tiêu:

- build backend rõ ràng
- runtime image nhỏ
- healthcheck được

Stage đề xuất:

1. `base`
2. `deps`
3. `builder`
4. `runner`

Điểm cần lưu ý:

- copy đúng artifact build của backend
- expose đúng API port
- thêm endpoint health như `/health`

### Docker Compose strategy

Mục tiêu:

- một lệnh để dựng local stack
- tiện cho cả dev lẫn CI smoke test

Service tối thiểu:

- `web`
- `api`

Service tùy chọn:

- `postgres`
- `redis`
- `jenkins`

Compose nên có:

- network riêng
- named volumes nếu cần persist data
- env file cho từng service
- healthcheck
- dependency order bằng `depends_on` kết hợp healthcheck nếu cần

Ví dụ logic kết nối:

- `web` gọi `api` qua service name nội bộ khi chạy trong compose
- browser ngoài container gọi `web` qua `localhost`

### Giai đoạn 3: CI với Jenkins

Mục tiêu:

- biến build process thành pipeline có thể lặp lại
- tạo thói quen CI/CD chuẩn

Tại sao Jenkins ở bước này:

- giúp học pipeline as code rõ ràng
- hiểu artifact flow trước khi deploy lên Kubernetes
- phù hợp để luyện credential, branch, stage, agent, image build

Triển khai local:

- chạy Jenkins bằng Docker
- mount Docker socket hoặc dùng agent phù hợp để build image
- lưu Jenkins data bằng volume riêng

Khuyến nghị thư mục:

```text
ci/
  jenkins/
    Jenkinsfile
    README.md
```

Nếu muốn đơn giản, có thể đặt `Jenkinsfile` ở root.

### Jenkins pipeline đề xuất

Stage tối thiểu:

1. `Checkout`
- pull source code

2. `Install`
- `pnpm install --frozen-lockfile`

3. `Quality`
- `pnpm typecheck`
- `pnpm lint`

4. `Test`
- unit test nếu có
- smoke test tối thiểu

5. `Build`
- `pnpm build`

6. `Docker Build`
- build image cho `web`
- build image cho `api`

7. `Docker Push`
- push lên registry với tag theo branch và commit SHA

8. `Deploy`
- chỉ bật khi sang giai đoạn Kubernetes

Tag strategy nên dùng:

- `branch-shortsha`
- `latest` chỉ dùng cho branch rõ ràng như `main`

Credential cần chuẩn bị:

- registry username/password hoặc token
- kubeconfig hoặc service account nếu sang deploy K8s

Nguyên tắc maintainable:

- không nhét business logic dài vào Jenkinsfile
- script phức tạp nên tách ra `scripts/ci/*`
- Jenkinsfile chỉ orchestration

## Giai đoạn 4: Kubernetes Local

Mục tiêu:

- học deployment model hiện đại
- hiểu rolling update, config separation, service discovery

Khuyến nghị môi trường:

- `k3d` nếu muốn nhẹ
- `minikube` nếu quen hơn

Không nên bắt đầu bằng cluster cloud thật ở giai đoạn đầu.

Khuyến nghị thư mục:

```text
deploy/
  k8s/
    base/
      web-deployment.yaml
      web-service.yaml
      api-deployment.yaml
      api-service.yaml
      configmap.yaml
      secret.example.yaml
      ingress.yaml
```

Sau khi quen hơn có thể chuyển sang:

```text
deploy/
  helm/
    sweet-spicy/
```

### Kubernetes objects tối thiểu

1. `Deployment` cho `web`
2. `Deployment` cho `api`
3. `Service` cho `web`
4. `Service` cho `api`
5. `ConfigMap` cho non-secret config
6. `Secret` cho secret
7. `Ingress` để route domain/path

### Probe strategy

Mỗi service nên có:

- `readinessProbe`
- `livenessProbe`

Điều này đặc biệt quan trọng với realtime API, vì pod chưa sẵn sàng mà nhận traffic sớm sẽ gây lỗi khó đoán.

## Giai đoạn 5: CD

Mục tiêu:

- từ branch hoặc tag, Jenkins có thể deploy bản mới có kiểm soát

Lộ trình CD nên tăng dần:

1. manual deploy từ Jenkins
2. auto deploy cho môi trường local/staging
3. gated deploy cho production

Chiến lược đơn giản trước:

- `main` -> deploy staging
- tag release -> deploy production

## Kiến trúc CI/CD đề xuất cho repo này

```text
Developer Push
  -> Jenkins Pipeline
    -> install
    -> typecheck
    -> lint
    -> test
    -> build
    -> docker build
    -> docker push
    -> optional deploy to k3d/minikube
      -> web deployment
      -> api deployment
```

## File backlog nên tạo

### Phase A: foundation

- `.env.example`
- `scripts/ci/typecheck.ps1`
- `scripts/ci/build.ps1`
- `scripts/ci/test.ps1`

### Phase B: docker

- `docker/web/Dockerfile`
- `docker/api/Dockerfile`
- `docker/compose/docker-compose.dev.yml`
- `docker/compose/docker-compose.ci.yml`
- `.dockerignore`

### Phase C: jenkins

- `Jenkinsfile`
- `ci/jenkins/README.md`

### Phase D: kubernetes

- `deploy/k8s/base/web-deployment.yaml`
- `deploy/k8s/base/web-service.yaml`
- `deploy/k8s/base/api-deployment.yaml`
- `deploy/k8s/base/api-service.yaml`
- `deploy/k8s/base/configmap.yaml`
- `deploy/k8s/base/secret.example.yaml`
- `deploy/k8s/base/ingress.yaml`

## Thứ tự triển khai thực tế

### Sprint 1

Mục tiêu:

- local build chuẩn
- env rõ ràng
- Docker cho `api`

Deliverables:

- script typecheck/build thống nhất
- `.env.example`
- `Dockerfile` cho `api`
- compose chạy được `api`

### Sprint 2

Mục tiêu:

- Docker cho `web`
- compose chạy full stack

Deliverables:

- `Dockerfile` cho `web`
- `docker-compose.dev.yml`
- tài liệu local run

### Sprint 3

Mục tiêu:

- Jenkins pipeline hoàn chỉnh cho CI

Deliverables:

- `Jenkinsfile`
- registry push
- quality gate

### Sprint 4

Mục tiêu:

- deploy local lên Kubernetes

Deliverables:

- manifest cơ bản
- Jenkins stage deploy local

## Skill map theo learning path

### Kỹ năng bạn sẽ học ở từng chặng

Docker:

- layer caching
- multi-stage build
- image hygiene
- runtime vs build-time env
- container networking

Jenkins:

- pipeline as code
- artifact promotion
- credentials management
- parallel stage basics
- branch-driven workflows

Kubernetes:

- deployment model
- service discovery
- config/secret separation
- health probe
- rollout strategy

## Anti-pattern cần tránh

- viết Dockerfile rất dài và copy toàn bộ repo vào runtime image
- để Jenkinsfile chứa quá nhiều shell logic
- hardcode secret trong compose hoặc manifest
- cho frontend depend trực tiếp vào `localhost` cố định trong mọi môi trường
- deploy K8s khi chưa có healthcheck và env strategy rõ ràng
- dùng Kubernetes chỉ để “cho có”, trong khi build pipeline còn chưa ổn

## Definition Of Done theo từng mức

### Done cho Docker

- `web` và `api` đều build được bằng image riêng
- compose dựng được stack local
- không cần cài toolchain đầy đủ trên máy để chạy stack containerized

### Done cho Jenkins CI

- mỗi push hoặc PR chạy được quality pipeline
- image build và tag được ổn định
- pipeline fail sớm khi lint/typecheck/test fail

### Done cho Kubernetes local

- deploy được `web` và `api`
- service truy cập được qua ingress hoặc port-forward
- rolling restart không làm hệ thống chết cứng

## Đề xuất ưu tiên cho bạn

Nếu mục tiêu là vừa học vừa áp dụng thực chiến cho repo này, thứ tự tối ưu là:

1. chuẩn hóa script build
2. Dockerize `api`
3. Dockerize `web`
4. compose full stack
5. Jenkins CI
6. registry push
7. Kubernetes local deploy
8. CD cơ bản

## Bước tiếp theo nên làm ngay

1. chuẩn hóa `package.json` scripts cho root, `web`, và `api`
2. viết `Dockerfile` cho `api` trước
3. dựng `docker-compose.dev.yml`
4. chỉ khi stack local ổn mới viết `Jenkinsfile`

## Ghi chú cuối

Nếu làm đúng thứ tự, bạn sẽ học được:

- cách chuẩn hóa một monorepo để build được
- cách đóng gói service thành artifact deployable
- cách tổ chức CI/CD có thể maintain lâu dài
- cách đi từ local dev sang container rồi sang orchestration mà không bị rối

Tài liệu này là roadmap. Bước tiếp theo hợp lý nhất là chuyển roadmap thành `implementation plan` với backlog file-by-file cho chính repo hiện tại.

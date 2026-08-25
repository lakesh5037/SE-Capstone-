# CI/CD PIPELINE DESIGN DOCUMENT
## HemoScan AI — Automated Brain Hemorrhage Diagnostic & Clinical Triage Platform

---

## 1. Introduction & Project Overview

**HemoScan AI** is a full-stack medical web application and clinical decision support system designed to automate the triage of brain CT scans for intracranial hemorrhage (ICH). The platform provides role-based portals for **Radiologists / Emergency Physicians** and **System Administrators**, an algorithmic AI diagnostic engine (`inference.py` executing 3 TensorFlow Lite models for skull slice validation, hemorrhage detection, and 5-subtype classification), digital PDF diagnostic report generation, and a searchable clinical scan registry.

As an emergency clinical triage system, HemoScan AI directly impacts patient diagnostic timelines, treatment urgency, and medical record integrity. This makes reliability, data integrity, security, and controlled releases significantly more important than raw feature velocity. A CI/CD pipeline is therefore essential to guarantee that every change is automatically built, verified, and promoted through controlled environments before reaching physicians and administrators in production.

### 1.1 Current Technology Stack (from repository analysis)

| Layer | Technology |
| :--- | :--- |
| **Backend runtime** | PHP 8.2 + Apache web server |
| **Frontend** | React 18 + Vite + TypeScript (SPA, Tailwind CSS, Lucide React, Framer Motion) |
| **AI Inference Engine** | Python 3 + `ai-edge-litert` / TFLite runtime (`inference.py`) |
| **Auth & Security libs** | Password hashing, session management, CORS preflight verification (`db.php`) |
| **File handling** | Multipart DICOM/CT image upload handler (`upload_scan.php`) |
| **Data layer** | MySQL 8.0 (`brain_scan_db`) — doctor profiles, scan logs, support tickets, notifications |
| **Domain logic** | `inference.py` — 3-stage TFLite hemorrhage detection and subtype classification scoring |
| **Containerization** | `Dockerfile` + `docker-compose.yml` (`hemoscan-frontend`, `hemoscan-backend`, `hemoscan-db`) |
| **Version control** | GitHub (`lakesh5037/SE-Capstone-`) with `main` and `develop` branches |

---

## 2. Requirement Analysis & CI/CD Needs

Analyzing the repository structure (`Dockerfile`, `docker-compose.yml`, PHP API scripts, upload routes, Python AI inference pipeline, MySQL schema, role-based frontend) surfaces the following CI/CD requirements:

*   **Automated build verification:** Every commit/PR must compile TypeScript, check PHP syntax, and confirm that the React frontend, PHP backend, and Docker images build cleanly.
*   **Regression-safe AI inference engine:** `inference.py` encodes business-critical medical rules (slice validation thresholds, bounding box geometry, subtype logits); any change must be covered by automated unit tests so diagnostic scoring logic is never silently broken.
*   **API contract verification:** `db.php`, `login.php`, `signup.php`, `check_user.php`, and `upload_scan.php` expose REST endpoints consumed by the React SPA; integration tests must validate these endpoints on every change.
*   **Secrets & credential hygiene:** The application uses database passwords, SMTP keys, and FCM push tokens; the pipeline must scan for accidentally committed secrets and enforce environment-based configuration.
*   **Dependency & container vulnerability scanning:** `npm` packages, PHP `composer` dependencies, Python `pip` packages, and base Docker images (`php:8.2-apache`, `node:20-alpine`, `nginx:stable-alpine`) must be scanned for known CVEs before release, given the sensitive patient data involved.
*   **Role-based access regression checks:** Radiologist vs. Administrator portal permissions must not regress; access-control tests belong in the pipeline.
*   **Reproducible, environment-parity deployment:** Docker and Docker Compose already exist, so the pipeline should build once and promote the exact same image across Dev → Staging → Production rather than rebuilding per environment.
*   **Controlled release with rollback:** Because medical diagnostic reports and patient records are clinically significant, production deployments need a manual approval gate, health-check-based verification, and an automated rollback path.
*   **Auditability:** Approvals, deployments, and rollbacks should be logged and notified, mirroring the audit-logging built into the physician portal design.

---

## 3. CI/CD Pipeline Architecture & Diagram

The pipeline is organized into four logical zones: **Source Trigger**, **Continuous Integration**, **Continuous Deployment** (environment promotion), and **Post-Deployment Observability**. The flow tracks developer commits through to a production release, including the manual approval gate and the automated rollback loop.

### 3.1 Stage-by-Stage Workflow

1.  **Source Code Management:** Developer pushes code to a feature branch and opens a Pull Request against `develop`/`main` on GitHub. Branch protection rules require the pipeline to pass and at least one review before merge.
2.  **Build:** GitHub Actions / Jenkins checks out the code, runs `npm ci` for the React frontend, verifies PHP syntax (`php -l`), and builds the Docker images using existing Dockerfiles to confirm artifacts compile and start.
3.  **Automated Testing:** Unit tests (`inference.py` scoring logic via PyTest), API/integration tests (PHP REST routes: auth, registration, CT image upload, support ticket submission), and role-based access tests run against the built artifact.
4.  **Code Quality & Security Analysis:** ESLint/Prettier for static JS/TS analysis, SonarQube/SonarCloud for maintainability and coverage gates, `npm audit` / Snyk for dependency CVEs, and secret scanning (`gitleaks`) for hardcoded credentials.
5.  **Packaging:** On success, Docker images are tagged with the commit SHA and version, then pushed to a container registry (Docker Hub / GitHub Container Registry / AWS ECR).
6.  **Deploy to Development:** The tagged image is auto-deployed to a Dev environment (via `docker compose` on host port `3002`/`8082`/`3308`) on every merge to the `develop` branch for internal verification.
7.  **Deploy to Staging/QA:** The same image is promoted to Staging, seeded with realistic (anonymized) CT scan test data, and smoke-tested; QA/manual exploratory testing of the Radiologist and Admin portals happens here.
8.  **Approval Gate:** A manual approval step (e.g., GitHub Environments protection rule) requires sign-off from a release owner before the image is promoted to Production — appropriate given the medical weight of diagnostic triage data.
9.  **Deploy to Production:** The approved image is released using a **Blue-Green** or **Canary** strategy so the live physician-facing portal and API endpoints are never taken fully offline during a release.
10. **Monitoring, Notifications & Rollback:** Health checks (`curl http://localhost:8081/index.php`) and application logs are monitored post-release; Slack/FCM notifications report status; a failed health check automatically triggers rollback to the last known-good image.

---

## 4. Tools & Technologies per Stage

| Stage | Recommended Tool(s) | Justification |
| :--- | :--- | :--- |
| **Source Code Management** | GitHub + branch protection | Repository is hosted on GitHub (`lakesh5037/SE-Capstone-`); branch protection enforces quality gates before merge. |
| **CI Orchestration** | GitHub Actions (Proposed Architecture) / Jenkins (Practical Implementation) | GitHub Actions offers native YAML workflows; Jenkins (Port 9090) demonstrates self-hosted automation, Docker socket mounting, and SCM polling (`H/15 * * * *`). |
| **Build** | Node.js 20 (`npm ci`), PHP 8.2 CLI, Python 3, Docker Buildx | Matches the existing Dockerfile/docker-compose setup; `npm ci` ensures deterministic installs from `package-lock.json`. |
| **Unit / Integration Testing** | PyTest + PHPUnit + Jest | PyTest verifies `inference.py` TFLite models; PHPUnit tests PHP API endpoints (`check_user.php`, `upload_scan.php`); Jest tests React UI components. |
| **Code Quality** | ESLint + Prettier, SonarCloud | ESLint/Prettier catch style and bug-prone patterns in TS/JS; SonarCloud adds maintainability, duplication, and coverage-trend gates on every PR. |
| **Security Scanning** | `npm audit` / Snyk, `gitleaks`, Trivy | `npm audit`/Snyk cover dependency CVEs; `gitleaks` prevents committed secrets (database passwords, API keys); Trivy scans built Docker images for OS vulnerabilities. |
| **Packaging / Registry** | Docker + GitHub Container Registry (GHCR) / Docker Hub | Reuses project's existing containerization (`hemoscan-frontend`, `hemoscan-backend`); free for public repos and integrates natively with CI. |
| **Deployment / Orchestration** | Docker Compose (Dev/Staging), AWS ECS / Render (Prod) | Docker Compose keeps local Dev lightweight and isolated; AWS ECS / Render gives Production rolling updates, health checks, and rollback support. |
| **Configuration & Secrets** | Encrypted Secrets / `.env` per environment | Keeps database passwords and API tokens out of source control and scoped per environment. |
| **Notifications** | Slack / Firebase Cloud Messaging (FCM) / Email | Immediate visibility into build, test, and deployment status for the clinical team and release owner. |
| **Monitoring & Logging** | Prometheus + Grafana, cURL Health Checks | Tracks API latency, HTTP response codes, and container health post-deployment to detect regressions quickly. |

---

## 5. Automated Testing Strategy

Testing is layered so that fast, cheap checks run first and slower, environment-dependent checks run later in the pipeline — failing fast saves compute time and gives developers quicker feedback.

### 5.1 Test Layers

| Test Type | Scope / Example | Pipeline Stage | Tooling |
| :--- | :--- | :--- | :--- |
| **Unit tests** | `inference.py`: CT slice validation, bounding box geometry, subtype logit thresholds | On every commit/PR | PyTest |
| **API / Integration tests** | Backend routes: `login.php`, `upload_scan.php`, `check_user.php`, CORS headers | On every commit/PR | PHPUnit |
| **Access-control tests** | Radiologist vs. Admin route permissions; unauthenticated requests rejected | On every commit/PR | Custom PHP Scripts |
| **Static analysis / linting** | TypeScript syntax, PHP linting (`php -l`), code style | Pre-merge (PR check) | ESLint, Prettier |
| **Security tests** | Dependency CVEs, secret leakage, container image vulnerabilities | Pre-merge and pre-deploy | `npm audit`/Snyk, `gitleaks`, Trivy |
| **Smoke tests** | App boots, `/index.php` returns HTTP 200 JSON status | After deploy to each environment | cURL / Postman |
| **End-to-end (UI) tests** | Full CT upload wizard, bounding box rendering, PDF report generation | Staging only, before approval gate | Playwright or Cypress |
| **Performance / load tests** | Concurrent CT scan uploads and AI inference processing | Staging (periodic / pre-release) | k6 or Apache JMeter |

### 5.2 Quality Gates
*   Pipeline fails the build if any unit or integration test fails — no merge or deployment proceeds.
*   Minimum code coverage threshold (70–80%) enforced via SonarCloud on `inference.py` and route handlers.
*   Any high/critical CVE from `npm audit`/Snyk or Trivy blocks packaging until resolved or explicitly waived by a maintainer.
*   Smoke tests must pass in each environment before the pipeline proceeds to the next promotion step.

---

## 6. Deployment Strategy

The same Docker image, built and tested once in CI, is promoted unchanged across three environments — avoiding "works in one environment but not another" drift.

| Environment | Purpose | Trigger | Strategy |
| :--- | :--- | :--- | :--- |
| **Development (Dev)** | Internal integration testing for developers; latest merged code | Automatic on every merge to `develop` | Direct deploy via `docker compose up -d`; ephemeral seeded database reset regularly |
| **Staging / QA** | Pre-production validation, manual QA, UAT with realistic (anonymized) CT scan data | Automatic on merge to `main` branch, after Dev passes smoke tests | Rolling deploy on a Staging environment mirroring production configuration |
| **Production** | Live physician-facing clinical decision support system handling real patient CT scans | Manual approval gate, then automated promotion of exact image validated in Staging | **Blue-Green** or **Canary** deployment to avoid downtime; automatic health-check verification with rollback |

### 6.1 Why Blue-Green / Canary for Production
Because the platform provides diagnostic CT scan triage in emergency room settings, a bad release must never take the system fully offline or serve a broken diagnostic pipeline. **Blue-Green deployment** keeps a full duplicate of the previous production version running until the new version passes health checks, allowing an instant traffic-switch rollback. **Canary releases** (routing a small percentage of traffic first) can be used for higher-risk changes such as updating TFLite model weights in `inference.py`.

---

## 7. Security, Quality Checks, Notifications & Rollback

### 7.1 Security Controls
*   Static Application Security Testing (SAST) via ESLint security plugins on every PR.
*   Dependency scanning (`npm audit` / Snyk) for React packages, PHP extensions, and Python libraries.
*   Secret scanning (`gitleaks`) to catch accidental commits of database passwords or SMTP credentials before merge.
*   Container image scanning (Trivy) on the built Docker images (`hemoscan-frontend`, `hemoscan-backend`) prior to registry push.
*   Principle of least privilege for CI service accounts and deployment credentials, stored as encrypted secrets, scoped per environment.
*   HTTPS/TLS enforced at the load balancer in Staging and Production; CORS headers strictly enforced in `db.php`.

### 7.2 Quality Checks
*   Mandatory PR review plus green CI status checks before merge (branch protection).
*   Static code analysis and coverage gates (SonarCloud) block merges below the quality threshold.
*   Consistent linting/formatting (ESLint + Prettier) enforced as a required CI check.

### 7.3 Notifications
*   Slack/FCM alerts on: pipeline failure, successful deployment to each environment, and any triggered rollback.
*   The manual approval-gate request for Production is sent as a high-priority notification to the release owner.
*   Notifications include commit SHA, author, environment, and a link to the pipeline run for fast triage.

### 7.4 Rollback Mechanism
*   Every deployment is tagged and versioned (`image:commit-SHA`), so the previous known-good image is always identifiable.
*   Post-deploy automated health checks (`curl http://localhost:8081/index.php`) run immediately after each promotion.
*   If health checks fail, the pipeline automatically re-points traffic to the previous stable image (Blue-Green switch-back) without waiting for manual intervention.
*   A manual one-click rollback workflow is also exposed to the release owner for issues detected after automated checks pass.
*   All rollback events are logged and trigger a notification, supporting complete clinical auditability.

---

## 8. Summary & Practical Implementation (Pages 7–10 Evidence)

This CI/CD design takes the HemoScan AI platform and defines a comprehensive workflow covering source management, build, layered automated testing, code quality/security scanning, container packaging, and controlled promotion through Development, Staging, and Production environments.

### Practical Implementation Evidence (Pages 7–10 Mapping):

*   **Page 7 — Jenkins Installation & Docker:** Demonstrates Jenkins containerized on Port `9090` (`hemo-jenkins`) with host Docker socket mounting (`/var/run/docker.sock`), running alongside isolated Capstone containers (`hemoscan-frontend` on port 3001, `hemoscan-backend` on port 8081, and `hemoscan-db` on port 3307).
*   **Page 8 — Jenkinsfile & SCM Polling:** Demonstrates the declarative `Jenkinsfile` Groovy configuration and SCM Polling (`H/15 * * * *`) setup connecting Jenkins to the GitHub repository (`lakesh5037/SE-Capstone-`).
*   **Page 9 — Before & After Automation:** Demonstrates automated execution triggered by a Git push to `develop`, where Jenkins automatically polls changes, clones code, compiles Docker images, and restarts container instances without human intervention.
*   **Page 10 — After Changes:** Demonstrates visual verification of the active React physician dashboard (`http://localhost:3001`), the PHP REST API (`http://localhost:8081/index.php`), and the MySQL database connection (`localhost:3307`).

---

### Repository Details:
*   **GitHub Repository:** `https://github.com/lakesh5037/SE-Capstone-`
*   **Active Branch:** `develop` / `main`
*   **Jenkins Server:** `http://localhost:9090`

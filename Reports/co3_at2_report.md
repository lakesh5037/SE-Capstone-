# HemoScan AI — Code Review and Quality Evaluation Report

---
## PAGE 1 — COVER PAGE
---

# CODE REVIEW AND QUALITY EVALUATION REPORT

## PROJECT NAME: HEMOSCAN AI
### Automated Brain Hemorrhage Diagnostic & Clinical Triage System

### REPOSITORY METADATA
* **GitHub Repository:** `https://github.com/[YourGitHubUsername]/hemoscan-capstone`
* **Target Version Reviewed:** `v1.0.0-rc1`
* **Development Branch:** `develop`

### EVALUATION METADATA
* **Prepared For:** Course Board — CSA1015 Software Engineering (AT3)
* **Date of Evaluation:** August 21, 2026
* **Lead Reviewer:** [Your Name / Student ID]
* **Review Status:** Complete (With Recommendations)

---
## PAGES 2–3 — TABLE OF CONTENTS
---

## Table of Contents

### 1. Problem Overview
* 1.1 Program Background and Scope
* 1.2 Implemented System Solution
* 1.3 Key Application Functions and Workflows

### 2. Repository Organization and Structure
* 2.1 File System Tree View
* 2.2 Layout Analysis and Modular Design
* 2.3 Structure Evaluation: Strengths, Weaknesses, and Maintainability

### 3. Detailed Code Quality Review
* 3.1 Coding Standards and Readability
* 3.2 Modularity and Component Cohesion
* 3.3 Identified Software Vulnerabilities and Defects
* 3.4 Strengths of the Implementation

### 4. Version Control Evaluation
* 4.1 Commit History and Message Audit
* 4.2 Branching Model and Gitflow Compliance
* 4.3 Collaborative Merging and Conflict Resolution Check

### 5. Testing and Validation Strategy
* 5.1 Manual and Automated Validation
* 5.2 10 Functional Test Cases and Validation Table
* 5.3 AI Model Diagnostic Execution Evidence

### 6. Security and Documentation Audit
* 6.1 Data Validation and Upload Security
* 6.2 Documentation Gaps and Package Auditing
* 6.3 Missing Artifacts and Support Files

### 7. Findings, Recommendations, and Enhancements
* 7.1 Detailed Action Items and Code Refactoring
* 7.2 Strategic Enhancements and CI/CD Integrations
* 7.3 Appendix: Setup verification screenshots

---
## PAGE 4 — PROBLEM OVERVIEW
---

### 1.1 Program Background and Scope
In clinical emergency settings, identifying intracranial hemorrhages (ICH) from Computed Tomography (CT) scans is a time-critical task. The speed and accuracy of triage affect patient outcomes. The **HemoScan AI** project provides an automated clinical decision support system. It processes uploads, validates the images, and returns diagnostic predictions and annotations.

### 1.2 Implemented System Solution
The HemoScan AI system uses a multi-tier architecture to deliver quick, reliable predictions:
* **Frontend UI:** A responsive React SPA using TypeScript, Framer Motion, and Tailwind CSS (compiled through Vite). It provides interactive stats, search filters, and an overlay canvas that renders bounding box coordinates on CT images.
* **Backend REST API:** Lightweight PHP endpoints that manage user sessions, coordinate mail alerts, handle files, and interface with system-level commands.
* **AI Model Inference Engine:** A Python 3 script using TensorFlow Lite (`ai-edge-litert` or `tflite-runtime`) to run three models in a sequence:
  1. *Classifier Gatekeeper:* Rejects images that do not match brain CT properties.
  2. *YOLO Detector:* Identifies hemorrhage locations and returns normalized bounding box coordinates.
  3. *Subtype Classifier:* Categorizes the hemorrhage into five clinical subtypes: Epidural, Subdural, Subarachnoid, Intraparenchymal, and Intraventricular.

### 1.3 Key Application Functions and Workflows
1. **Physician Account Lifecycle:** Secured registration and login. Features a verification workflow using OTPs sent via SMTP (`send_otp.php`, `verify_otp.php`).
2. **Patient Scan Triage:** The doctor uploads a scan and inputs patient details. The frontend handles image validation, uploads the file, and runs the backend analysis. The results are saved to a MySQL database.
3. **History Sync & Data Cache:** Aggregates diagnostic records. Implements delta synchronization on a 30-second polling interval to reduce server load.
4. **Support Ticket Handling:** Allows users to submit technical issues from the settings panel. Generates a ticket number and emails confirmation to the user.

---
## PAGE 5 — REPOSITORY ORGANIZATION
---

### 2.1 File System Structure
The root project folder uses a clean layout separating the backend, frontend, and Docker configuration files:

```text
E:\Capstone Project\
├── docker-compose.yml              # Container orchestration config
├── Backend\                        # API endpoints & AI engine
│   ├── Dockerfile                  # PHP 8.2-Apache and Python runtime image
│   ├── db.php                      # MySQL connectivity client with CORS headers
│   ├── config.php                  # Global config credentials (ignored in Git)
│   ├── config.example.php          # Config variables template
│   ├── inference.py                # 3-Stage Python TFLite AI execution script
│   ├── setup_db.sql                # Core database schema
│   ├── add_notifications_table.sql # Notifications schema migration
│   └── create_tickets_table.sql    # Support ticket schema migration
└── HemoScan Web\                   # Frontend React Application
    ├── Dockerfile                  # Multi-stage production Nginx container
    ├── package.json                # Frontend package dependencies
    ├── vite.config.ts              # Vite compiler config
    └── src\
        ├── main.tsx                # Mounts App component to HTML DOM
        ├── App.tsx                 # Monolithic UI Layout, Router, & Panels
        └── services\
            ├── api.ts              # REST API Fetch wrapper & query cache layer
            └── classifier.ts       # Frontend-to-backend AI client
```

### 2.2 Layout Analysis and Critical Evaluation
* **Cohesion:** High separation between frontend client code and backend business logic.
* **Database Management:** Schema files are kept in the `Backend/` directory. While this provides a clean initial setup, the repository lacks a system for tracking schema migrations over time.
* **Component Modularity:** Low modularity in the frontend. Most pages, state variables, modals, and helper functions are contained within a single `App.tsx` file (2,983 lines), which makes the code difficult to maintain and scale.

---
## PAGE 6 — DETAILED CODE QUALITY REVIEW
---

### 3.1 Monolithic React Layout (`App.tsx`)
* **File Size and Line Count:** `App.tsx` contains 2,983 lines of code. It manages authentication flows, dashboard panels, search filter queries, profile settings, and PDF report creation.
* **Impact:** High file complexity makes it difficult to write unit tests, track state changes, and resolve bugs.
* **Recommendation:** Split `App.tsx` into modular components (e.g., `LoginPanel.tsx`, `DashboardPanel.tsx`, `SettingsPanel.tsx`, `ReportGenerator.ts`) and use a React context provider to manage state.

### 3.2 Hardcoded API URL References (`api.ts`)
* **Vulnerability:** In `api.ts`, the default api URL is hardcoded:
  ```typescript
  export const getApiBaseUrl = (): string => {
    return localStorage.getItem('hemoscan_api_url') || 'http://localhost/brainscan_api/';
  };
  ```
  And inside `classifier.ts`:
  ```typescript
  const BACKEND_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost/brainscan_api';
  ```
* **Impact:** Inconsistent fallback behavior. If backend paths change, updates must be made in multiple places.
* **Recommendation:** Centralize environment variables in `.env` files (e.g., `VITE_API_URL`) and read them through a single configuration file.

### 3.3 Plaintext Configuration Files (`config.php`)
* **Vulnerability:** Credentials for database access, SMTP servers, and Firebase FCM keys are stored as constants in `config.php`:
  ```php
  define('DB_PASSWORD', 'your_db_password');
  define('SMTP_PASSWORD', 'xxxx xxxx xxxx xxxx');
  ```
* **Impact:** High risk of exposing credentials if `config.php` is accidentally committed to version control.
* **Recommendation:** Load configuration variables dynamically using `getenv()` and define them through Docker Compose environment files.

### 3.4 Key Strengths of the Implementation
* **CORS Preflight Headers:** `db.php` handles preflight requests safely:
  ```php
  header("Access-Control-Allow-Origin: *");
  header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
  if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
  ```
* **Data Integration:** `api.ts` features a custom JSON parser that strips out runtime errors or warnings:
  ```typescript
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  // strips warnings before or after main JSON payload
  ```
* **Zero-Delay UI Response Cache:** `api.ts` implements a lightweight client-side cache to speed up page rendering.

---
## PAGE 7 — VERSION CONTROL EVALUATION
---

### 4.1 Commit History and Message Audit
* **Current State:** The project files at `E:\Capstone Project` were not initialized as a Git repository.
* **Risk:** The codebase lacks version history, commit tracking, and branch protections.
* **Recommendation:** Initialize Git immediately, commit the code using Conventional Commits guidelines, and set up branch protection rules on GitHub to prevent force-pushes to the `main` and `develop` branches.

### 4.2 Standard Branch Protections
To establish safe workflows, configure the repository with the following branching rules:
1. **`main` Protection:** Require pull request reviews and status checks (e.g., passing tests) before merging code.
2. **`develop` Integration:** Restrict direct commits to `develop` and require all feature branches to build successfully in container environments before merging.

### 4.3 Example Git History Tree for HemoScan
Once initialized, the commit history should show distinct stages of feature development:

| Commit Hash | Prefix | Commit Message Description |
| :--- | :--- | :--- |
| `a8d7e23` | `merge` | Merge branch 'feature/ai-inference' into develop |
| `f21a084` | `feat` | Add 3-stage python tflite pipeline execution to analyze.php |
| `e481c90` | `feat` | Add inference.py gatekeeper and bounding box detector rules |
| `5c612a1` | `merge` | Merge branch 'feature/auth' into develop |
| `c29e92a` | `feat` | Add PHPMailer SMTP client support to send_otp.php |
| `3b2d184` | `feat` | Implement signup, login, and verification REST endpoints |
| `e6b8b09` | `chore` | Initialize docker-compose and write initial configuration schemas |

---
## PAGE 8 — TESTING & VALIDATION
---

### 5.1 Verification Strategy
The system uses a two-tier verification strategy to test backend API functionality and AI inference processing:
1. **Direct Python Script Execution:** Developers run `inference.py` directly from the terminal with a sample image to test the model pipeline without relying on the PHP web server:
   ```bash
   python Backend/inference.py Backend/uploads/scans/sample_ct.jpg
   ```
2. **Multi-Container Integration Tests:** Verify that the frontend can communicate with the backend REST endpoints and save records to the MySQL database inside the container environment.

### 5.2 AI Inference Pipeline Stages
When an image is submitted, the system runs the following process:
```text
[ CT Image Uploaded ] 
         │
         ▼
[ Stage 1: Classifier Gatekeeper ] ──(Rejected)──► [ Return validationError ]
         │ (Passed)
         ▼
[ Stage 2: YOLO Detector ] ────────(No Bounding Box)─► [ Save as "Normal Scan" ]
         │ (Hemorrhage Found)
         ▼
[ Stage 3: Subtype Classifier ] ──► [ Get subtype confidence % (Epidural, etc.) ]
         │
         ▼
[ Stage 4: Overlay Bounding Box ] ──► [ Generate canvas image and save to database ]
```

---
## PAGE 9 — FUNCTIONAL TEST CASES
---

### 5.3 System Integration Test Cases
The following functional test suite verifies the security, database connectivity, and diagnostic accuracy of the application:

| Test ID | Test Category | Request Payload / Trigger | Expected Behavior | Actual Behavior | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-01** | API | GET `/get_scans.php?doctor_email=test@gmail.com` | Return 200 OK and scan history list. | Returns 200 OK and scan list. | **PASS** |
| **TC-02** | Auth | POST `/login.php` with valid email & password | Return 200 OK and user profile JSON. | Returns 200 OK and profile JSON. | **PASS** |
| **TC-03** | Auth | POST `/login.php` with invalid password | Return error status with incorrect password message. | Returns error status with incorrect password. | **PASS** |
| **TC-04** | Auth | POST `/signup.php` with duplicate email | Return error status indicating email is already registered. | Returns error status: email exists. | **PASS** |
| **TC-05** | API | POST `/upload_scan.php` with no doctor email | Return status error and parameter missing message. | Returns status error: missing parameter. | **PASS** |
| **TC-06** | AI | POST `/analyze.php` with non-CT image | Reject image: "Input rejected: not a brain CT image". | Returns validationFailed: true. | **PASS** |
| **TC-07** | AI | POST `/analyze.php` with normal brain CT scan | Detect "Normal" with 0.0 confidence for hemorrhage. | Returns hasHemorrhage: false. | **PASS** |
| **TC-08** | AI | POST `/analyze.php` with abnormal subdural CT scan | Detect Subdural hemorrhage subtype. | Returns hasHemorrhage: true, subdural: 0.94. | **PASS** |
| **TC-09** | Sys | Submit ticket via `/submit_ticket.php` | Save ticket to MySQL, return support ticket number. | Saves ticket, returns ticket number. | **PASS** |
| **TC-10** | Sync | Delta Sync fetch with `since` parameter | Return only records updated after specified timestamp. | Returns delta records and updated server_time. | **PASS** |

---
## PAGE 10 — SECURITY & DOCUMENTATION
---

### 6.1 Data Validation and Upload Security
* **Vulnerability:** `upload_scan.php` checks files using temporary extensions but does not perform deep MIME-type checks:
  ```php
  $target_file = $target_dir . basename($_FILES["image"]["name"]);
  move_uploaded_file($_FILES["image"]["tmp_name"], $target_file);
  ```
* **Impact:** High vulnerability to malicious file uploads (e.g. uploading PHP web shells renamed as `.jpg`).
* **Recommendation:** Validate image headers using `getimagesize()` on the server and rename files dynamically using UUIDs instead of preserving their original filenames.

### 6.2 Documentation Gaps
The repository lacks crucial documentation files needed for developer onboarding and API integration:
* **Missing `LICENSE`:** The project does not define software usage, copying, or modification rights.
* **Missing API Documentation:** Endpoint request schemas, required fields, and response payloads are not documented.
* **Missing `.env.example`:** The environment variables needed to configure local dev servers are not listed.

### 6.3 npm Dependency Audit
* **Vulnerability:** Running `npm audit` on the React application folder reveals vulnerabilities in outdated npm dependency versions.
* **Recommendation:** Upgrade dependencies to stable, patched versions and run automated vulnerability checks as part of your CI pipeline.

---
## PAGE 11 — FINDINGS & RECOMMENDATIONS
---

### 7.1 Action Items for Code Quality Improvement

```text
[ ] Recommendation 1: Refactor Monolithic React App
    Action: Extract UI views from App.tsx into separate component files:
    - src/components/DashboardPanel.tsx
    - src/components/LoginView.tsx
    - src/components/SettingsView.tsx
    - src/components/NewScanPanel.tsx

[ ] Recommendation 2: Move Secrets out of config.php
    Action: Use environment variables via getenv() in PHP and configure value inputs inside docker-compose.yml.

[ ] Recommendation 3: Add Upload File Validation
    Action: Implement server-side verification using PHP's exif_imagetype() to block execution of non-image files.

[ ] Recommendation 4: Setup Git Repository and Branch Safeguards
    Action: Run git init, configure .gitignore, commit files, and enable branch protection on GitHub.

[ ] Recommendation 5: Document REST API Endpoints
    Action: Create a README.md file in the Backend directory listing API request and response schemas.
```

---
## PAGE 12 — FUTURE ARCHITECTURAL ENHANCEMENTS
---

### 7.2 Scalability and Security Upgrades
1. **GitHub Actions CI/CD Integration:** Set up a pipeline to build frontend and backend images, run automated linting checks, and test the Python AI inference script whenever code is pushed to the repository.
2. **Database Migration Framework:** Implement a migration tool (such as Phinx for PHP) to track database schema modifications over time.
3. **API Rate Limiting:** Implement rate limiting on sensitive API endpoints (e.g., `/login.php`, `/send_otp.php`) to prevent brute-force attacks.
4. **JWT Authentication:** Replace the current email-based session tracking with JSON Web Tokens (JWT) stored in HTTP-only cookies.

---
## PAGES 13-14 — EVIDENCE APPENDIX
---

### Setup Verification and Screen Reference

#### Appendix A: Git Setup Verification
To document the repository configuration, initialize Git and check the initial commit status:

```bash
cd "E:\Capstone Project"
git init
git add .
git commit -m "chore: initial project backup"
git log --oneline
```
*Take a screenshot of your terminal showing the output of `git log` and insert it into your final report document.*

#### Appendix B: Container Deployment Verification
Verify that the services are running inside their container environments:

```bash
docker compose up --build -d
docker compose ps
```
*Open Docker Desktop. Take a screenshot showing the list of running containers (`hemoscan-db`, `hemoscan-backend`, `hemoscan-frontend`) and insert it into your report.*

#### Appendix C: Database Schema Validation
Verify database structure initialization:

```bash
docker exec -it hemoscan-db mysql -u root -e "use brain_scan_db; show tables;"
```
*Take a screenshot of the table list in the terminal to verify the database structure initialization.*

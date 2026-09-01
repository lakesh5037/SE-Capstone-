pipeline {
    agent any

    environment {
        REGISTRY_USER  = 'lakesh5037'
        IMAGE_NAME_FE  = 'hemoscan-frontend'
        IMAGE_NAME_BE  = 'hemoscan-backend'
    }

    stages {

        // ─── STAGE 1: PULL LATEST CODE FROM GITHUB ────────────────────────────
        stage('Checkout Code') {
            steps {
                echo 'Pulling latest code from GitHub develop branch...'
                git branch: 'develop', url: 'https://github.com/lakesh5037/SE-Capstone-.git'
            }
        }

        // ─── STAGE 2: BUILD FRONTEND (always fresh — no Docker layer cache) ───
        stage('Build Frontend Docker Image') {
            steps {
                echo 'Building React + Vite + Nginx frontend image (no-cache)...'
                sh "docker build --no-cache -t ${REGISTRY_USER}/${IMAGE_NAME_FE}:latest './HemoScan Web'"
            }
        }

        // ─── STAGE 3: BUILD BACKEND ────────────────────────────────────────────
        stage('Build Backend Docker Image') {
            steps {
                echo 'Building PHP 8.2 + Python AI backend image...'
                sh "docker build -t ${REGISTRY_USER}/${IMAGE_NAME_BE}:latest ./Backend"
            }
        }

        // ─── STAGE 4: DEPLOY ALL CONTAINERS ───────────────────────────────────
        //
        //  DATA SAFETY EXPLANATION:
        //  ─────────────────────────────────────────────────────────────────────
        //  The DB container is removed & recreated on every build BUT its data
        //  lives in the Docker named volume  hemoscan-db-data  which is NEVER
        //  deleted by this script.  MySQL only runs initdb scripts when
        //  /var/lib/mysql is EMPTY (first run).  On subsequent builds, MySQL
        //  finds existing data in the volume and SKIPS the init scripts, so
        //  existing doctor/scan records are preserved.
        //
        //  Uploads (profile images, scan images) are stored in the named volume
        //  hemoscan-uploads and are likewise preserved across builds.
        //  ─────────────────────────────────────────────────────────────────────

        stage('Deploy Application Containers') {
            steps {
                echo 'Deploying HemoScan containers with persistent storage...'
                sh '''
                    # ── 1. Network ───────────────────────────────────────────────
                    docker network create hemoscan-net || true

                    # ── 2. Stop & remove only the APPLICATION containers ─────────
                    #    We purposely DO NOT remove volumes so DB data is preserved.
                    docker rm -f hemoscan-db hemoscan-backend hemoscan-frontend hemoscan-phpmyadmin || true

                    # ── 3. MySQL — mounts the PERSISTENT named volume ────────────
                    #    On first run: volume is empty → MySQL runs init scripts
                    #      (setup_db.sql is mounted → creates all tables)
                    #    On subsequent runs: volume has data → init scripts skipped
                    #      → existing doctor/scan/OTP records are fully preserved
                    docker run -d --name hemoscan-db \
                        --network hemoscan-net \
                        --restart unless-stopped \
                        -p 3307:3306 \
                        -e MYSQL_ALLOW_EMPTY_PASSWORD=yes \
                        -e MYSQL_DATABASE=brain_scan_db \
                        -v hemoscan-db-data:/var/lib/mysql \
                        -v "$PWD/Backend/setup_db.sql:/docker-entrypoint-initdb.d/1_setup.sql:ro" \
                        -v "$PWD/Backend/add_notifications_table.sql:/docker-entrypoint-initdb.d/2_notifications.sql:ro" \
                        -v "$PWD/Backend/create_tickets_table.sql:/docker-entrypoint-initdb.d/3_tickets.sql:ro" \
                        mysql:8.0

                    # ── 4. Wait until MySQL is healthy ───────────────────────────
                    echo "Waiting for MySQL to be ready..."
                    until docker exec hemoscan-db mysqladmin ping -h localhost --silent 2>/dev/null; do
                        echo "  MySQL not yet ready, waiting 3 s..."
                        sleep 3
                    done
                    echo "MySQL is ready."

                    # ── 5. Backend ───────────────────────────────────────────────
                    docker run -d --name hemoscan-backend \
                        --network hemoscan-net \
                        --restart unless-stopped \
                        -p 8081:80 \
                        -e DB_HOST=hemoscan-db \
                        -e DB_USER=root \
                        -e DB_PASSWORD="" \
                        -e DB_NAME=brain_scan_db \
                        -v hemoscan-uploads:/var/www/html/uploads \
                        ${REGISTRY_USER}/${IMAGE_NAME_BE}:latest

                    # ── 6. Frontend ──────────────────────────────────────────────
                    docker run -d --name hemoscan-frontend \
                        --network hemoscan-net \
                        --restart unless-stopped \
                        -p 3001:80 \
                        ${REGISTRY_USER}/${IMAGE_NAME_FE}:latest

                    # ── 7. phpMyAdmin ────────────────────────────────────────────
                    docker run -d --name hemoscan-phpmyadmin \
                        --network hemoscan-net \
                        --restart unless-stopped \
                        -p 8082:80 \
                        -e PMA_HOST=hemoscan-db \
                        phpmyadmin:latest
                '''
            }
        }

        // ─── STAGE 5: VERIFY ──────────────────────────────────────────────────
        stage('Verify Active Containers') {
            steps {
                echo 'Active HemoScan containers:'
                sh 'docker ps --filter "name=hemoscan" --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"'
                echo 'Persistent Docker volumes:'
                sh 'docker volume ls --filter "name=hemoscan"'
            }
        }
    }

    post {
        success {
            echo '''
            ================================================================
            SUCCESS: HemoScan deployed successfully!
              Frontend   → http://localhost:3001
              Backend    → http://localhost:8081/index.php
              phpMyAdmin → http://localhost:8082
            NOTE: DB data is persisted in Docker volume "hemoscan-db-data".
                  Rebuild will NOT delete existing doctor/scan records.
            ================================================================
            '''
        }
        failure {
            echo 'BUILD FAILED. Check Console Output above for details.'
        }
    }
}

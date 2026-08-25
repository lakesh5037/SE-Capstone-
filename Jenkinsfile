pipeline {
    agent any

    stages {

        // ── STAGE 1: Checkout Code from GitHub ─────────────────────────────────
        stage('Checkout Code') {
            steps {
                echo 'Cloning repository from GitHub...'
                git branch: 'develop', url: 'https://github.com/lakesh5037/SE-Capstone-.git'
            }
        }

        // ── STAGE 2: Build Frontend Docker Image ────────────────────────────────
        stage('Build Frontend Image') {
            steps {
                echo 'Building React + Vite + Nginx frontend image...'
                sh "docker build -t lakesh5037/hemoscan-frontend:latest './HemoScan Web'"
            }
        }

        // ── STAGE 3: Build Backend Docker Image ─────────────────────────────────
        stage('Build Backend Image') {
            steps {
                echo 'Building PHP 8.2 Apache + Python TFLite backend image...'
                sh 'docker build -t lakesh5037/hemoscan-backend:latest ./Backend'
            }
        }

        // ── STAGE 4: Deploy All Containers ──────────────────────────────────────
        stage('Deploy Application') {
            steps {
                echo 'Stopping old containers, creating network, deploying fresh containers...'
                sh '''
                    # ─── 1. Create isolated Docker network for HemoScan (safe to re-run) ───
                    docker network create hemoscan-net || true

                    # ─── 2. Stop & remove old HemoScan containers cleanly ────────────────
                    docker stop hemoscan-frontend hemoscan-backend hemoscan-db || true
                    docker rm   hemoscan-frontend hemoscan-backend hemoscan-db || true

                    # ─── 3. Start Database on hemoscan-net ───────────────────────────────
                    #        Mount SQL init scripts so tables are created on first boot
                    docker run -d \
                        --name hemoscan-db \
                        --network hemoscan-net \
                        -p 3307:3306 \
                        -e MYSQL_ALLOW_EMPTY_PASSWORD=yes \
                        -e MYSQL_DATABASE=brain_scan_db \
                        -v "$PWD/Backend/setup_db.sql:/docker-entrypoint-initdb.d/1_setup_db.sql" \
                        -v "$PWD/Backend/add_notifications_table.sql:/docker-entrypoint-initdb.d/2_add_notifications_table.sql" \
                        -v "$PWD/Backend/create_tickets_table.sql:/docker-entrypoint-initdb.d/3_create_tickets_table.sql" \
                        mysql:8.0

                    # ─── 4. Wait for MySQL to finish initializing tables (10 seconds) ───
                    echo "Waiting 10s for MySQL to initialize..."
                    sleep 10

                    # ─── 5. Start Backend on hemoscan-net ────────────────────────────────
                    #        DB_HOST=hemoscan-db works because both are on hemoscan-net
                    docker run -d \
                        --name hemoscan-backend \
                        --network hemoscan-net \
                        -p 8081:80 \
                        -e DB_HOST=hemoscan-db \
                        -e DB_USER=root \
                        -e DB_PASSWORD="" \
                        -e DB_NAME=brain_scan_db \
                        -v "$PWD/Backend/uploads:/var/www/html/uploads" \
                        lakesh5037/hemoscan-backend:latest

                    # ─── 6. Start Frontend on hemoscan-net ───────────────────────────────
                    docker run -d \
                        --name hemoscan-frontend \
                        --network hemoscan-net \
                        -p 3001:80 \
                        lakesh5037/hemoscan-frontend:latest
                '''
            }
        }

        // ── STAGE 5: Verify Running Containers ──────────────────────────────────
        stage('Verify Containers') {
            steps {
                echo 'Checking all HemoScan containers are running...'
                sh 'docker ps --filter "name=hemoscan"'
            }
        }

    }

    post {
        success {
            echo '''
            ✅ HemoScan AI is running!
               Frontend  → http://localhost:3001
               Backend   → http://localhost:8081
               Database  → localhost:3307 (brain_scan_db)
               phpMyAdmin→ http://localhost:8082 (if running)
            '''
        }
        failure {
            echo '❌ Build FAILED. Check the Console Output above for the exact error.'
        }
    }
}

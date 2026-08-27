pipeline {
    agent any

    environment {
        REGISTRY_USER = 'lakesh5037'
        IMAGE_NAME_FE = 'hemoscan-frontend'
        IMAGE_NAME_BE = 'hemoscan-backend'
    }

    stages {
        // ─── STAGE 1: CHECKOUT CODE FROM GITHUB ──────────────────────────────
        stage('Checkout Code') {
            steps {
                echo 'Cloning repository from GitHub...'
                git branch: 'develop', url: 'https://github.com/lakesh5037/SE-Capstone-.git'
            }
        }

        // ─── STAGE 2: BUILD FRONTEND REACT DOCKER IMAGE ───────────────────────
        stage('Build Frontend Docker Image') {
            steps {
                echo 'Building React + Vite production container image without cache...'
                sh "docker build --no-cache -t ${REGISTRY_USER}/${IMAGE_NAME_FE}:latest './HemoScan Web'"
            }
        }

        // ─── STAGE 3: BUILD BACKEND PHP & PYTHON DOCKER IMAGE ──────────────────
        stage('Build Backend Docker Image') {
            steps {
                echo 'Building PHP 8.2 Apache & Python AI container image...'
                sh "docker build -t ${REGISTRY_USER}/${IMAGE_NAME_BE}:latest ./Backend"
            }
        }

        // ─── STAGE 4: DEPLOY CONTAINERS & EXECUTE SQL MIGRATIONS ──────────────
        stage('Deploy & Run Application Containers') {
            steps {
                echo 'Deploying HemoScan containers and importing SQL schema...'
                sh '''
                    # 1. Create dedicated bridge network
                    docker network create hemoscan-net || true

                    # 2. Clean up any existing containers
                    docker rm -f hemoscan-db hemoscan-backend hemoscan-frontend hemoscan-phpmyadmin || true

                    # 3. Start Database on hemoscan-net
                    docker run -d --name hemoscan-db --network hemoscan-net -p 3307:3306 \
                      -e MYSQL_ALLOW_EMPTY_PASSWORD=yes \
                      -e MYSQL_DATABASE=brain_scan_db \
                      mysql:8.0

                    # 4. Wait for MySQL to fully stabilize
                    echo "Waiting for MySQL database server to be ready..."
                    sleep 8
                    until docker exec hemoscan-db mysqladmin ping -h "localhost" --silent; do
                        echo "Waiting for MySQL..."
                        sleep 3
                    done
                    sleep 3

                    # 5. Create database & import all schemas in a single atomic stream
                    echo "Initializing database and importing all SQL schemas..."
                    docker exec hemoscan-db mysql -u root -e "CREATE DATABASE IF NOT EXISTS brain_scan_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" || true
                    cat ./Backend/setup_db.sql ./Backend/add_notifications_table.sql ./Backend/create_tickets_table.sql | docker exec -i hemoscan-db mysql -u root brain_scan_db || true

                    # 6. Start Backend on hemoscan-net
                    docker run -d --name hemoscan-backend --network hemoscan-net -p 8081:80 \
                      -e DB_HOST=hemoscan-db -e DB_USER=root -e DB_NAME=brain_scan_db \
                      lakesh5037/hemoscan-backend:latest

                    # 7. Start Frontend on hemoscan-net
                    docker run -d --name hemoscan-frontend --network hemoscan-net -p 3001:80 \
                      lakesh5037/hemoscan-frontend:latest

                    # 8. Start phpMyAdmin on hemoscan-net connected to hemoscan-db
                    docker run -d --name hemoscan-phpmyadmin --network hemoscan-net -p 8082:80 \
                      -e PMA_HOST=hemoscan-db \
                      phpmyadmin:latest
                '''
            }
        }

        // ─── STAGE 5: VERIFY ACTIVE CONTAINERS ───────────────────────────────
        stage('Verify Active Containers') {
            steps {
                echo 'Verifying active Docker containers on host...'
                sh 'docker ps --filter "name=hemoscan"'
            }
        }
    }

    post {
        always {
            echo 'Jenkins Pipeline Execution Finished.'
        }
        success {
            echo '''
            =======================================================
            🎉 SUCCESS: HemoScan stack built, DB imported, and live!
               Frontend   → http://localhost:3001
               Backend    → http://localhost:8081/index.php
               Database   → http://localhost:8082 (phpMyAdmin)
            =======================================================
            '''
        }
        failure {
            echo '❌ FAILURE: Check Console Output for error details.'
        }
    }
}

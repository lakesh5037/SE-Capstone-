pipeline {
    agent any

    stages {

        // ── STAGE 1: Checkout Latest Code from GitHub ───────────────────────────
        stage('Checkout Code') {
            steps {
                echo 'Cloning latest code from GitHub develop branch...'
                git branch: 'develop', url: 'https://github.com/lakesh5037/SE-Capstone-.git'
            }
        }

        // ── STAGE 2: Stop Old Containers ────────────────────────────────────────
        stage('Stop Old Containers') {
            steps {
                echo 'Stopping and removing old containers...'
                sh 'docker-compose down || true'
                sh 'docker rm -f hemoscan-db hemoscan-backend hemoscan-frontend hemoscan-phpmyadmin || true'
            }
        }

        // ── STAGE 3: Build & Start All Containers via docker-compose ────────────
        stage('Build & Deploy') {
            steps {
                echo 'Building fresh images and starting all containers...'
                sh 'docker-compose up --build -d'
            }
        }

        // ── STAGE 4: Start phpMyAdmin for DB viewing ─────────────────────────────
        stage('Start phpMyAdmin') {
            steps {
                echo 'Starting phpMyAdmin for database access...'
                sh 'docker run -d --name hemoscan-phpmyadmin -p 8082:80 -e PMA_HOST=db --network capstoneproject_default phpmyadmin:latest || true'
            }
        }

        // ── STAGE 5: Verify Running Containers ───────────────────────────────────
        stage('Verify Containers') {
            steps {
                echo 'All running containers:'
                sh 'docker ps'
            }
        }

    }

    post {
        success {
            echo '''
            ========================================
            SUCCESS! HemoScan AI is LIVE!
            ----------------------------------------
            Frontend   → http://localhost:3001
            Backend    → http://localhost:8081
            Database   → http://localhost:8082
            Jenkins    → http://localhost:9090
            ========================================
            '''
        }
        failure {
            echo 'BUILD FAILED. Check Console Output above for the error.'
        }
    }
}

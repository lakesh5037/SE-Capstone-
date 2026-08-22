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
                echo 'Building React + Vite production container image...'
                sh "docker build -t ${REGISTRY_USER}/${IMAGE_NAME_FE}:latest './HemoScan Web'"
            }
        }

        // ─── STAGE 3: BUILD BACKEND PHP & PYTHON DOCKER IMAGE ──────────────────
        stage('Build Backend Docker Image') {
            steps {
                echo 'Building PHP 8.2 Apache & Python AI container image...'
                sh "docker build -t ${REGISTRY_USER}/${IMAGE_NAME_BE}:latest ./Backend"
            }
        }

        // ─── STAGE 4: DEPLOY & RUN APPLICATION CONTAINERS ─────────────────────
        stage('Deploy & Run Application Containers') {
            steps {
                echo 'Deploying HemoScan application containers using Docker...'
                sh '''
                    docker rm -f hemoscan-db hemoscan-backend hemoscan-frontend || true
                    docker run -d --name hemoscan-db -p 3307:3306 -e MYSQL_ALLOW_EMPTY_PASSWORD=yes -e MYSQL_DATABASE=brain_scan_db mysql:8.0
                    docker run -d --name hemoscan-backend -p 8081:80 -e DB_HOST=hemoscan-db -e DB_USER=root -e DB_NAME=brain_scan_db lakesh5037/hemoscan-backend:latest
                    docker run -d --name hemoscan-frontend -p 3001:80 lakesh5037/hemoscan-frontend:latest
                '''
            }
        }

        // ─── STAGE 5: VERIFY ACTIVE CONTAINERS ───────────────────────────────
        stage('Verify Active Containers') {
            steps {
                echo 'Verifying active Docker containers on host...'
                sh 'docker ps'
            }
        }
    }

    post {
        always {
            echo 'Jenkins Pipeline Execution Finished.'
        }
        success {
            echo '🎉 SUCCESS: HemoScan stack built, deployed, and running in Docker!'
        }
        failure {
            echo '❌ FAILURE: Check Console Output for error details.'
        }
    }
}

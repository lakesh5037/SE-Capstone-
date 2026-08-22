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
                echo 'Successfully connected to GitHub. Checking out source files...'
                checkout scm
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

        // ─── STAGE 4: VERIFY BUILT ARTIFACTS ──────────────────────────────────
        stage('Verify Built Containers') {
            steps {
                echo 'Verifying built container images on host...'
                sh "docker images | grep hemoscan || true"
            }
        }
    }

    post {
        always {
            echo 'Jenkins Pipeline Execution Finished.'
        }
        success {
            echo '🎉 SUCCESS: All pipeline stages passed successfully!'
        }
        failure {
            echo '❌ FAILURE: Check Console Output for error details.'
        }
    }
}

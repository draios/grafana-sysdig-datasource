pipeline {
    agent {
        dockerfile {
            label 'builder-backend-j8'
        }
    }

    environment {
        S3_BUCKET = "sysdigcloud-frontend-staging/styleguide"
    }

    stages {
        stage('Prepare') {
            steps {
                echo 'Cleaning up...'
                sh 'rm -rf dist'
                sh 'rm -rf sysdig'
                echo 'Preparing environment'
                sh 'npm install'
                sh './node_modules/.bin/yarn install'
            }
        }
        stage('Build') {
            steps {
                echo 'Building...'
            }
        }
        stage('Test') {
            steps {
                echo 'Testing...'
            }
        }
        stage('Deploy') {
            steps {
                echo 'Deploying....'
            }
        }
    }
}
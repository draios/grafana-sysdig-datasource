pipeline {
    agent {
        dockerfile {
            label 'builder-backend-j8'
        }
    }

    environment {
        VERSION = "v0.0.2"
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
                sh 'npm run build'
            }
        }

        stage('Deploy') {
            environment {
                DIST_PATH = "dist"
                FILE_NAME_PREFIX = "grafana-sysdig-datasource"
                BUILD_FILE_NAME = "${env.FILE_NAME_PREFIX}-${env.VERSION}.${env.BUILD_NUMBER}"
                RELEASE_FILE_NAME = "${env.FILE_NAME_PREFIX}-${env.VERSION}"
            }
            steps {
                echo 'Cleaning up artifacts....'
                sh 'rm -rf sysdig/test'

                echo 'Deploying zip file....'
                sh 'zip -ry ${env.BUILD_FILE_NAME}.zip sysdig'
                sh 'aws s3 cp ${env.BUILD_FILE_NAME}.zip s3://download.draios.com/stable/grafana-sysdig-datasource/${env.BUILD_FILE_NAME}.zip --acl public-read'
                sh 'aws s3 cp ${env.BUILD_FILE_NAME}.zip s3://download.draios.com/stable/grafana-sysdig-datasource/${env.RELEASE_FILE_NAME}.zip --acl public-read'

                echo 'Deploying tgz file....'
                sh 'tar zcvf ${env.BUILD_FILE_NAME}.tgz sysdig'
                sh 'aws s3 cp ${env.BUILD_FILE_NAME}.tgz s3://download.draios.com/stable/grafana-sysdig-datasource/${env.BUILD_FILE_NAME}.tgz --acl public-read'
                sh 'aws s3 cp ${env.BUILD_FILE_NAME}.tgz s3://download.draios.com/stable/grafana-sysdig-datasource/${env.RELEASE_NAME_PREFIX}.tgz --acl public-read'
            }
        }
    }
}
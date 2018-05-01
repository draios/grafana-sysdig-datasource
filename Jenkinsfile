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
                echo "Cleaning up..."
                sh 'rm -rf dist'
                sh 'rm -rf sysdig'
                echo "Preparing environment"
                sh 'npm install'
                sh './node_modules/.bin/yarn install'
            }
        }

        stage('Build') {
            steps {
                echo "Building..."
                sh 'npm run build'
            }
        }

        stage('Deploy') {
            environment {
                DIST_PATH = "dist"
                FILE_NAME_PREFIX = "grafana-sysdig-datasource"
                BUILD_FILE_NAME = "${FILE_NAME_PREFIX}-${VERSION}.${env.BUILD_ID}"
                RELEASE_FILE_NAME = "${FILE_NAME_PREFIX}-${VERSION}"
            }
            steps {
                echo "Cleaning up artifacts...."
                sh 'rm -rf sysdig/test'

                echo "Deploying zip file...."
                echo "zip -ry ${BUILD_FILE_NAME}.zip sysdig"
                echo "aws s3 cp ${BUILD_FILE_NAME}.zip s3://download.draios.com/stable/grafana-sysdig-datasource/${BUILD_FILE_NAME}.zip --acl public-read"
                echo "aws s3 cp ${BUILD_FILE_NAME}.zip s3://download.draios.com/stable/grafana-sysdig-datasource/${RELEASE_FILE_NAME}.zip --acl public-read"

                echo "Deploying tgz file...."
                echo "tar zcvf ${BUILD_FILE_NAME}.tgz sysdig"
                echo "aws s3 cp ${BUILD_FILE_NAME}.tgz s3://download.draios.com/stable/grafana-sysdig-datasource/${BUILD_FILE_NAME}.tgz --acl public-read"
                echo "aws s3 cp ${BUILD_FILE_NAME}.tgz s3://download.draios.com/stable/grafana-sysdig-datasource/${RELEASE_FILE_NAME}.tgz --acl public-read"
            }
        }
    }
}
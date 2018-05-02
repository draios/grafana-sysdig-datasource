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
        stage('Prepare build') {
            steps {
                echo "Cleaning up..."
                sh "rm -rf dist"
                sh "rm -rf sysdig"
                echo "Preparing environment"
                sh "npm install"
                sh "./node_modules/.bin/yarn install"
            }
        }

        stage('Build') {
            steps {
                echo "Building..."
                sh "npm run build"
            }
        }

        stage('Prepare deploy') {
            environment {
                DIST_PATH = "dist"
            }
            steps {
                echo "Cleaning up artifacts...."
                sh "cp -R ${DIST_PATH} sysdig"
                sh "rm -rf sysdig/test"
            }
        }

        stage('Deploy') {
            environment {
                FILE_NAME_PREFIX = "grafana-sysdig-datasource"
                BUILD_FILE_NAME = "${FILE_NAME_PREFIX}-${VERSION}.${env.BUILD_ID}"
                RELEASE_FILE_NAME = "${FILE_NAME_PREFIX}-${VERSION}"
            }
            steps {
                echo "Deploying zip file...."
                sh "zip -ry ${BUILD_FILE_NAME}.zip sysdig"
                sh "aws s3 cp ${BUILD_FILE_NAME}.zip s3://download.draios.com/dev/grafana-sysdig-datasource/${BUILD_FILE_NAME}.zip --acl public-read"
                sh "aws s3 cp ${BUILD_FILE_NAME}.zip s3://download.draios.com/dev/grafana-sysdig-datasource/${RELEASE_FILE_NAME}.zip --acl public-read"

                echo "Deploying tgz file...."
                sh "tar zcvf ${BUILD_FILE_NAME}.tgz sysdig"
                sh "aws s3 cp ${BUILD_FILE_NAME}.tgz s3://download.draios.com/dev/grafana-sysdig-datasource/${BUILD_FILE_NAME}.tgz --acl public-read"
                sh "aws s3 cp ${BUILD_FILE_NAME}.tgz s3://download.draios.com/dev/grafana-sysdig-datasource/${RELEASE_FILE_NAME}.tgz --acl public-read"
            }
        }
    }
}
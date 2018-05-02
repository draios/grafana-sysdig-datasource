#!/bin/bash

VERSION=$1
BUILD_ID=$2

FILE_NAME_PREFIX="grafana-sysdig-datasource"
BUILD_FILE_NAME="${FILE_NAME_PREFIX}-v${VERSION}.${BUILD_ID}"
LATEST_FILE_NAME="${FILE_NAME_PREFIX}-v${VERSION}"
S3_BUCKET="s3://download.draios.com"
DIST_PATH="dist"

echo "Cleaning up artifacts...."
cp -R ${DIST_PATH} sysdig
rm -rf sysdig/test

echo "Deploying zip file...."
zip -ry ${BUILD_FILE_NAME}.zip sysdig
aws s3 cp ${BUILD_FILE_NAME}.zip ${S3_BUCKET}/${S3_DEST}/${BUILD_FILE_NAME}.zip --acl public-read
aws s3 cp ${BUILD_FILE_NAME}.zip ${S3_BUCKET}/${S3_DEST}/${LATEST_FILE_NAME}.zip --acl public-read

echo "Deploying tgz file...."
tar zcvf ${BUILD_FILE_NAME}.tgz sysdig
aws s3 cp ${BUILD_FILE_NAME}.tgz ${S3_BUCKET}/${S3_DEST}/${BUILD_FILE_NAME}.tgz --acl public-read
aws s3 cp ${BUILD_FILE_NAME}.tgz ${S3_BUCKET}/${S3_DEST}/${LATEST_FILE_NAME}.tgz --acl public-read

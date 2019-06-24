#
#  Copyright 2018 Draios Inc.
#
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
#
#!/bin/bash

# Env parameters
# - BUILD_CONTAINER (default: true)
# - ENVIRONMENT (default: development)
# - GIT_BRANCH (default: dev)
# - BUILD_NUMBER (default: 42)

setup_env() {
    echo "Prepare environment..."

    set +u

    #
    # Set default variables
    #
    if [ -z ${BUILD_CONTAINER} ]
    then
        BUILD_CONTAINER=true
    fi
    if [ -z ${ENVIRONMENT} ]
    then
        ENVIRONMENT=development
    fi
    if [ -z ${GIT_BRANCH} ]
    then
        GIT_BRANCH=dev
    fi
    if [ -z ${BUILD_NUMBER} ]
    then
        BUILD_NUMBER=42
    fi

    set -u

    GIT_BRANCH_NAME=$(echo ${GIT_BRANCH} | cut -d"/" -f2)

    if [ "${GIT_BRANCH_NAME}" = "master" ]; then
        ENVIRONMENT=production
    fi

    USER_VERSION=`cat VERSION`
    if [ "${ENVIRONMENT}" = "production" ]; then
        VERSION=${USER_VERSION}
    else
        VERSION=${USER_VERSION}.${BUILD_NUMBER}
    fi
    GRAFANA_VERSION=`cat VERSION_GRAFANA`

    S3_BUCKET="s3://download.draios.com"

    if [[ "$GIT_BRANCH_NAME" == 'master' ]]; then
        S3_DEST="stable/grafana-sysdig-datasource"
    elif [[ "$GIT_BRANCH_NAME" == 'dev' ]]; then
        S3_DEST="dev/grafana-sysdig-datasource"
    else
        S3_DEST="dev/grafana-sysdig-datasource/${GIT_BRANCH_NAME}"
    fi

    FILE_NAME_PREFIX="grafana-sysdig-datasource"
    BUILD_FILE_NAME="${FILE_NAME_PREFIX}-v${USER_VERSION}.${BUILD_NUMBER}"
    BUILD_FILE_NAME_LATEST="${FILE_NAME_PREFIX}-v${USER_VERSION}"

    DOCKER_IMAGE_TAG=sysdiglabs/grafana
    if [ "${ENVIRONMENT}" = "production" ]; then
        DOCKER_IMAGE_VERSION=${GRAFANA_VERSION}-sysdig-${VERSION}
        DOCKER_IMAGE_VERSION_LATEST="latest"
    else
        DOCKER_IMAGE_VERSION=${GRAFANA_VERSION}-sysdig-${VERSION}-${GIT_BRANCH_NAME}
        DOCKER_IMAGE_VERSION_LATEST="dev"
    fi
}

publish_artifacts() {
    echo "Uploading artifacts to S3..."

    aws s3 cp out/${BUILD_FILE_NAME}.zip ${S3_BUCKET}/${S3_DEST}/${BUILD_FILE_NAME}.zip --acl public-read
    aws s3 cp out/${BUILD_FILE_NAME}.tgz ${S3_BUCKET}/${S3_DEST}/${BUILD_FILE_NAME}.tgz --acl public-read

    # aws s3 cp ${BUILD_FILE_NAME}.zip ${S3_BUCKET}/${S3_DEST}/${BUILD_FILE_NAME_LATEST}.zip --acl public-read
    # aws s3 cp ${BUILD_FILE_NAME}.tgz ${S3_BUCKET}/${S3_DEST}/${BUILD_FILE_NAME_LATEST}.tgz --acl public-read

    if [ "${BUILD_CONTAINER}" = "true" ]; then
        if [ "${ENVIRONMENT}" = "production" ] || [ "${GIT_BRANCH}" = "dev" ]; then
            echo "Publishing image to Docker hub..."

            docker push ${DOCKER_IMAGE_TAG}:${DOCKER_IMAGE_VERSION}
            docker push ${DOCKER_IMAGE_TAG}:${DOCKER_IMAGE_VERSION_LATEST}
        fi
    fi
}

cleanup() {
    echo "Cleaning up..."
    
    docker rmi ${DOCKER_IMAGE_TAG}:${DOCKER_IMAGE_VERSION} || echo "Image ${DOCKER_IMAGE_TAG}:${DOCKER_IMAGE_VERSION} not found!"
    docker rmi ${DOCKER_IMAGE_TAG}:${DOCKER_IMAGE_VERSION_LATEST} || echo "Image ${DOCKER_IMAGE_TAG}:${DOCKER_IMAGE_VERSION_LATEST} not found!"
}

set -ex
    setup_env
    publish_artifacts
    cleanup
set +ex

echo "Done!"

#!/bin/bash

# Env parameters
# - BUILD_CONTAINER (default: true)
# - CLEANUP (default: true)
# - ENVIRONMENT (default: development)
# - BUILD_NUMBER
# - GIT_BRANCH (default: dev)

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
    if [ -z ${CLEANUP} ]
    then
        CLEANUP=true
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

    DIST_PATH="dist"
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

    # Disabling interactive progress bar, and spinners gains 2x performances
    # as stated on https://twitter.com/gavinjoyce/status/691773956144119808
    npm config set progress false
    npm config set spin false
}

build() {
    echo "Building..."

    npm ci

    npm run build

    echo "Cleaning up artifacts...."
    cp -R ${DIST_PATH} sysdig
    rm -rf sysdig/test

    mkdir out
    zip -ry out/${BUILD_FILE_NAME}.zip sysdig
    tar zcvf out/${BUILD_FILE_NAME}.tgz sysdig

    if [ "${BUILD_CONTAINER}" = "true" ]; then
        #
        # create temporary folder with image content
        #
        rm -rf dist-image
        mkdir dist-image
        cp -r sysdig dist-image
        cp deployment/Dockerfile dist-image

        #
        # build Docker image
        #
        docker build dist-image \
            --build-arg GRAFANA_VERSION=${GRAFANA_VERSION} \
            -t ${DOCKER_IMAGE_TAG}:${DOCKER_IMAGE_VERSION} \
            -t ${DOCKER_IMAGE_TAG}:${DOCKER_IMAGE_VERSION_LATEST}
    fi
}

cleanup() {
    if [ "${CLEANUP}" = "true" ]; then
        echo "Cleaning up..."

        rm -rf out
        rm -rf dist-image

        npm run clean        

        docker rmi ${DOCKER_IMAGE_TAG}:${DOCKER_IMAGE_VERSION} || echo "Image ${DOCKER_IMAGE_TAG}:${DOCKER_IMAGE_VERSION} not found!"
        docker rmi ${DOCKER_IMAGE_TAG}:${DOCKER_IMAGE_VERSION_LATEST} || echo "Image ${DOCKER_IMAGE_TAG}:${DOCKER_IMAGE_VERSION_LATEST} not found!"
    fi
}

set -ex
    setup_env
    cleanup
    build
set +ex

echo "Done!"

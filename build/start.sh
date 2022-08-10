#!/bin/bash

setup_env() {
    echo "Prepare environment..."

    GRAFANA_VERSION=`cat VERSION_GRAFANA`

    DIST_PATH="dist"

    PLUGIN_DIR="grafana-data-${GRAFANA_VERSION}/plugins"

    USER_ID=$(id -u)

    # Disabling interactive progress bar, and spinners gains 2x performances
    # as stated on https://twitter.com/gavinjoyce/status/691773956144119808
    npm config set progress false
    npm config set spin false
}

start() {
    echo "Cleaning up..."

    rm -rf ${PLUGIN_DIR}
    docker stop grafana-dev > /dev/null || true
    docker rm grafana-dev > /dev/null || true

    echo "Building..."

    npm run build

    mkdir -p ${PLUGIN_DIR}/sysdig

    cp -R ${DIST_PATH}/. ${PLUGIN_DIR}/sysdig
    rm -rf ${PLUGIN_DIR}/sysdig/test

    echo "Build complete."

    echo "Starting Grafana ${GRAFANA_VERSION} docker container with Sysdig plugin..."

    mkdir -p grafana-data-${GRAFANA_VERSION}

    docker run -p 3000:3000 --user $USER_ID -v "${PWD}/grafana-data-${GRAFANA_VERSION}:/var/lib/grafana" \
           -e GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=sysdig \
           --rm grafana/grafana:${GRAFANA_VERSION}

}

set -ex
setup_env
start

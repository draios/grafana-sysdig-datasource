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

set -x

BUILD_BASE_URL=$1
VERSION=$2
TAG=$3
GRAFANA_VERSION=$4

BUILD_URL=${BUILD_BASE_URL}/grafana-sysdig-datasource-v${VERSION}.tgz

#
# Download and extract plugin
#
curl ${BUILD_URL} -o plugin.tgz
tar zxf plugin.tgz -C deployment

#
# Build image
#
docker build --build-arg GRAFANA_VERSION=${GRAFANA_VERSION} -t ${TAG}:${GRAFANA_VERSION}-sysdig-${VERSION} deployment

#
# Cleanup artifacts extracted from plugin.tgz file
#
rm -rf deployment/sysdig
rm plugin.tgz

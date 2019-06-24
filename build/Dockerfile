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
FROM debian:stable-slim



###############################################################################
#                                                                             #
# Install basic tools/utilities                                               #
#                                                                             #
###############################################################################
RUN apt-get update -y && \
    apt-get install ca-certificates \
      gconf-service \
      libasound2 \
      libatk1.0-0 \
      libatk1.0-0 \
      libdbus-1-3 \
      libgconf-2-4 \
      libgtk-3-0 \
      libnspr4 \
      libnss3 \
      libx11-xcb1 \
      libxss1 \
      libxtst6 \
      fonts-liberation \
      libappindicator3-1 \
      xdg-utils \
      lsb-release \
      wget \
      curl \
      gzip \
      zip \
      git \
      awscli \
      xz-utils -y --no-install-recommends && \
    apt-get install -f

# Install the latest Docker CE binaries
# From https://github.com/getintodevops/jenkins-withdocker/blob/master/Dockerfile
RUN apt-get update && \
    apt-get -y install apt-transport-https \
      ca-certificates \
      curl \
      gnupg2 \
      software-properties-common && \
    curl -fsSL https://download.docker.com/linux/$(. /etc/os-release; echo "$ID")/gpg > /tmp/dkey; apt-key add /tmp/dkey && \
    add-apt-repository \
      "deb [arch=amd64] https://download.docker.com/linux/$(. /etc/os-release; echo "$ID") \
      $(lsb_release -cs) \
      stable" && \
   apt-get update && \
   apt-get -y install docker-ce

# Install Node.js v10
# (ref. https://github.com/nodesource/distributions/blob/master/README.md#installation-instructions)
RUN curl -sL https://deb.nodesource.com/setup_10.x | bash - && \
    apt-get install -y nodejs

# Install Google Chrome unstable (which has cross platform support for headless mode
RUN wget https://dl.google.com/linux/direct/google-chrome-unstable_current_amd64.deb && \
    dpkg -i google-chrome*.deb

# Cleanup
RUN apt-get clean autoclean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* google-chrome-unstable_current_amd64.deb



###############################################################################
#                                                                             #
# Prepare environment                                                         #
#                                                                             #
###############################################################################

WORKDIR /usr/bin/grafana-sysdig-datasource



###############################################################################
#                                                                             #
# Run the build                                                               #
#                                                                             #
###############################################################################

CMD ["./build/build.sh"]


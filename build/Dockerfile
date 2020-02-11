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
    apt-get install -y --no-install-recommends \
        curl \
        zip \
        git \
        awscli \
        && \
    apt-get install -f

# Install Node.js v10
# (ref. https://github.com/nodesource/distributions/blob/master/README.md#installation-instructions)
RUN curl -sL https://deb.nodesource.com/setup_10.x | bash - && \
    apt-get install -y nodejs

# Cleanup
RUN apt-get clean autoclean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

//
//  Copyright 2018 Draios Inc.
//
//  Licensed under the Apache License, Version 2.0 (the "License");
//  you may not use this file except in compliance with the License.
//  You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
//  Unless required by applicable law or agreed to in writing, software
//  distributed under the License is distributed on an "AS IS" BASIS,
//  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//  See the License for the specific language governing permissions and
//  limitations under the License.
//
export default class Cache {
    constructor($q, maxCount = 10, expiration = Number.MAX_VALUE) {
        this.$q = $q;
        this.map = {};
        this.list = [];

        this.maxCount = maxCount;
        this.expiration = expiration;
    }

    getItemId(id) {
        return id;
    }

    async get(id, loader) {
        const data = this.read(id);
        if (data !== undefined) {
            return this.$q.resolve(data);
        } else {
            const promise = this.fetch(loader);

            // store promise as data first...
            this.write(id, promise);

            try {
                // wait for data...
                const data = await promise;

                // and finally store data in the cache
                this.write(id, data);

                return data;
            } catch (ex) {
                // delete pending item
                const itemId = this.getItemId(id);
                const item = this.map[itemId];
                if (item !== undefined) {
                    this.list = [...this.list.filter((d) => d !== item)];
                    delete this.map[itemId];
                }

                throw ex;
            }
        }
    }

    read(id) {
        const itemId = this.getItemId(id);

        this.expireItems();
        const item = this.map[itemId];

        if (item) {
            item.lastAccess = this.now();

            // keep list sorted by creation time
            this.list = [...this.list.filter((d) => d !== item), item];

            return item.data;
        } else {
            return undefined;
        }
    }

    fetch(loader) {
        return this.$q.resolve(loader());
    }

    write(id, data) {
        const itemId = this.getItemId(id);

        const item = this.createItem(itemId, data);

        // replace existing items (used to replace promise with data)
        const previousItem = this.map[itemId];
        if (previousItem !== undefined) {
            this.list = [...this.list.filter((d) => d !== previousItem)];
            delete this.map[itemId];
        }

        this.list.push(item);
        this.map[itemId] = item;

        this.evictItems();

        return item.data;
    }

    createItem(itemId, data) {
        const now = this.now();

        return {
            id: itemId,
            data,
            createdOn: now,
            lastAccess: now
        };
    }

    expireItems() {
        if (this.expiration !== Number.MAX_VALUE) {
            const limit = this.now() - this.expiration;
            const removed = [];
            for (let i = this.list.length - 1; i >= 0; i--) {
                const item = this.list[i];

                if (item.createdOn < limit) {
                    delete this.map[item.id];
                    removed.push(i);
                }
            }

            this.list = this.list.filter((d, i) => removed.indexOf(i) === -1);
        }
    }

    evictItems() {
        if (this.list.length > this.maxCount) {
            const removed = [];
            for (let i = this.list.length - 1 - this.maxCount; i >= 0; i--) {
                const item = this.list[i];

                delete this.map[item.id];
                removed.push(i);
            }

            this.list = this.list.filter((d, i) => removed.indexOf(i) === -1);
        }
    }

    toArray() {
        return this.list.map((item) => item.data);
    }

    now() {
        return Date.now();
    }
}

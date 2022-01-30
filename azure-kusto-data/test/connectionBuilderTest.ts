// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "assert";
import { v4 as uuidv4 } from 'uuid';
import {KustoConnectionStringBuilder} from "../source/connectionBuilder";

describe("KustoConnectionStringBuilder", () => {
    describe("#constructor(connectionString)", () => {
        it("from string with no creds", () => {
            const kcsbs = [
                new KustoConnectionStringBuilder("localhost"),
                new KustoConnectionStringBuilder("data Source=localhost"),
                new KustoConnectionStringBuilder("Addr=localhost"),
                new KustoConnectionStringBuilder("Addr = localhost"),
                KustoConnectionStringBuilder.withAadDeviceAuthentication("localhost", "common"),
            ];

            for (const kcsb of kcsbs) {
                assert.strictEqual(kcsb.dataSource, "localhost");
                assert.strictEqual(kcsb.authorityId, "common");
                const emptyFields = ["aadUserId", "password", "applicationClientId", "applicationKey"] as const;
                for (const field of emptyFields) {
                    assert.strictEqual(kcsb[field], undefined);
                }
            }
        });

        it("from string with username auth", () => {
            const expectedUser = "test";
            const expectedPassword = "Pa$$w0rd";
            const kcsbs = [
                new KustoConnectionStringBuilder(`localhost;AAD User ID=${expectedUser};password=${expectedPassword}`),
                new KustoConnectionStringBuilder(`Data Source=localhost ; AaD User ID=${expectedUser}; Password =${expectedPassword}`),
                new KustoConnectionStringBuilder(` Addr = localhost ; AAD User ID = ${expectedUser} ; Pwd =${expectedPassword}`),
                new KustoConnectionStringBuilder(`Network Address = localhost; AAD User iD = ${expectedUser} ; Pwd = ${expectedPassword} `),
                KustoConnectionStringBuilder.withAadUserPasswordAuthentication("localhost", expectedUser, expectedPassword),
            ];
            const kcsb1 = new KustoConnectionStringBuilder("Server=localhost");
            kcsb1.aadUserId = expectedUser;
            kcsb1.password = expectedPassword;
            kcsbs.push(kcsb1);

            for (const kcsb of kcsbs) {
                assert.strictEqual(kcsb.dataSource, "localhost");
                assert.strictEqual(kcsb.aadUserId, expectedUser);
                assert.strictEqual(kcsb.password, expectedPassword);
                assert.strictEqual(kcsb.authorityId, "common");
                const emptyFields = ["applicationClientId", "applicationKey"] as const;
                for (const field of emptyFields) {
                    assert.strictEqual(kcsb[field], undefined);
                }
            }
        });

        it("from string with app auth", () => {

            const uuid = uuidv4();
            const key = "key of application";

            const kcsbs = [
                new KustoConnectionStringBuilder(`localhost;Application client Id=${uuid};application Key=${key}`),
                new KustoConnectionStringBuilder(`Data Source=localhost ; Application Client Id=${uuid}; Appkey =${key}`),
                new KustoConnectionStringBuilder(` Addr = localhost ; AppClientId = ${uuid} ; AppKey =${key}`),
                new KustoConnectionStringBuilder(`Network Address = localhost; AppClientId = ${uuid} ; AppKey =${key}`),
                KustoConnectionStringBuilder.withAadApplicationKeyAuthentication("localhost", uuid, key)
            ];

            const kcsb1 = new KustoConnectionStringBuilder("server=localhost");
            kcsb1.applicationClientId = uuid;
            kcsb1.applicationKey = key;
            kcsbs.push(kcsb1);

            for (const kcsb of kcsbs) {
                assert.strictEqual(kcsb.dataSource, "localhost");
                assert.strictEqual(kcsb.applicationClientId, uuid);
                assert.strictEqual(kcsb.applicationKey, key);
                assert.strictEqual(kcsb.authorityId, "common");
                const emptyFields = ["aadUserId", "password"] as const;
                for (const field of emptyFields) {
                    assert.strictEqual(kcsb[field], undefined);
                }
            }
        });
    });
});



// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "assert";
import { v4 as uuidv4 } from 'uuid';
import { KustoConnectionStringBuilder } from "../source/connectionBuilder";

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
                const emptyFields = [
                    "aadUserId",
                    "applicationClientId",
                    "password",
                    "msiClientId",
                    "applicationKey",
                    "applicationCertificatePrivateKey",
                    "applicationCertificateThumbprint",
                    "applicationCertificateX5c",
                    "deviceCodeCallback",
                    "loginHint",
                    "timeoutMs",
                    "interactiveLogin",
                    "accessToken",
                    "azLoginIdentity",
                    "managedIdentity"
                ] as const;

                for (const field of emptyFields) {
                    assert.strictEqual(kcsb[field], undefined);
                }
            }
        });


        describe("from string with username auth", () => {
            const expectedUser = "test";
            const expectedPassword = "Pa$$w0rd";

            function doComparison(kcsbs: KustoConnectionStringBuilder[], exceptedAuthorityId: string) {
                for (const kcsb of kcsbs) {
                    assert.strictEqual(kcsb.dataSource, "localhost");
                    assert.strictEqual(kcsb.aadUserId, expectedUser);
                    assert.strictEqual(kcsb.password, expectedPassword);
                    assert.strictEqual(kcsb.authorityId, exceptedAuthorityId);
                    const emptyFields = [
                        "applicationClientId",
                        "msiClientId",
                        "applicationKey",
                        "applicationCertificatePrivateKey",
                        "applicationCertificateThumbprint",
                        "applicationCertificateX5c",
                        "deviceCodeCallback",
                        "loginHint",
                        "timeoutMs",
                        "interactiveLogin",
                        "accessToken",
                        "azLoginIdentity",
                        "managedIdentity"
                    ] as const;
                    for (const field of emptyFields) {
                        assert.strictEqual(kcsb[field], undefined);
                    }

                    assert.strictEqual(kcsb.toString(), `Data Source=localhost;AAD User ID=${expectedUser};Password=****;Authority Id=${exceptedAuthorityId}`)
                    assert.strictEqual(kcsb.toString(false), `Data Source=localhost;AAD User ID=${expectedUser};Password=${expectedPassword};Authority Id=${exceptedAuthorityId}`)
                }
            }

            it("without authority id", () => {
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

                doComparison(kcsbs, "common");
            });

            it("with authority id", () => {
                const expectedAuthorityId = "test-authority";

                const kcsbs = [
                    new KustoConnectionStringBuilder(`localhost;AAD User ID=${expectedUser};password=${expectedPassword};Authority Id=${expectedAuthorityId}`),
                    new KustoConnectionStringBuilder(`Data Source=localhost ; AaD User ID=${expectedUser}; Password =${expectedPassword};authority=${expectedAuthorityId}`),
                    new KustoConnectionStringBuilder(` Addr = localhost ; AAD User ID = ${expectedUser} ; Pwd =${expectedPassword};tenantid=${expectedAuthorityId}`),
                    new KustoConnectionStringBuilder(`Network Address = localhost; AAD User iD = ${expectedUser} ; Pwd = ${expectedPassword};tid=${expectedAuthorityId} `),
                    KustoConnectionStringBuilder.withAadUserPasswordAuthentication("localhost", expectedUser, expectedPassword, expectedAuthorityId),
                ];

                const kcsb1 = new KustoConnectionStringBuilder("Server=localhost");
                kcsb1.aadUserId = expectedUser;
                kcsb1.password = expectedPassword;
                kcsb1.authorityId = expectedAuthorityId;
                kcsbs.push(kcsb1);

                doComparison(kcsbs, expectedAuthorityId);
            })
        });


        describe("from string with app auth", () => {
            const expectedUuid = uuidv4();
            const expectedKey = "key of application";


            function doComparison(kcsbs: KustoConnectionStringBuilder[], expectedAuthorityId: string) {
                for (const kcsb of kcsbs) {
                    assert.strictEqual(kcsb.dataSource, "localhost");
                    assert.strictEqual(kcsb.applicationClientId, expectedUuid);
                    assert.strictEqual(kcsb.applicationKey, expectedKey);
                    assert.strictEqual(kcsb.authorityId, expectedAuthorityId);
                    const emptyFields = [
                        "aadUserId",
                        "password",
                        "msiClientId",
                        "applicationCertificatePrivateKey",
                        "applicationCertificateThumbprint",
                        "applicationCertificateX5c",
                        "deviceCodeCallback",
                        "loginHint",
                        "timeoutMs",
                        "interactiveLogin",
                        "accessToken",
                        "azLoginIdentity",
                        "managedIdentity"
                    ] as const;
                    for (const field of emptyFields) {
                        assert.strictEqual(kcsb[field], undefined);
                    }

                    assert.strictEqual(kcsb.toString(), `Data Source=localhost;Application Client Id=${expectedUuid};Application Key=****;Authority Id=${expectedAuthorityId}`)
                    assert.strictEqual(kcsb.toString(false), `Data Source=localhost;Application Client Id=${expectedUuid};Application Key=${expectedKey};Authority Id=${expectedAuthorityId}`)
                }
            }

            it("without authority id", () => {
                const kcsbs = [
                    new KustoConnectionStringBuilder(`localhost;Application client Id=${expectedUuid};application Key=${expectedKey}`),
                    new KustoConnectionStringBuilder(`Data Source=localhost ; Application Client Id=${expectedUuid}; Appkey =${expectedKey}`),
                    new KustoConnectionStringBuilder(` Addr = localhost ; AppClientId = ${expectedUuid} ; AppKey =${expectedKey}`),
                    new KustoConnectionStringBuilder(`Network Address = localhost; AppClientId = ${expectedUuid} ; AppKey =${expectedKey}`),
                    KustoConnectionStringBuilder.withAadApplicationKeyAuthentication("localhost", expectedUuid, expectedKey)
                ];

                const kcsb1 = new KustoConnectionStringBuilder("server=localhost");
                kcsb1.applicationClientId = expectedUuid;
                kcsb1.applicationKey = expectedKey;
                kcsbs.push(kcsb1);

                doComparison(kcsbs, "common");
            })

            it("with authority id", () => {
                const expectedAuthorityId = "test-authority";

                const kcsbs = [
                    new KustoConnectionStringBuilder(`localhost;Application client Id=${expectedUuid};application Key=${expectedKey};Authority Id=${expectedAuthorityId}`),
                    new KustoConnectionStringBuilder(`Data Source=localhost ; Application Client Id=${expectedUuid}; Appkey =${expectedKey};authority=${expectedAuthorityId}`),
                    new KustoConnectionStringBuilder(` Addr = localhost ; AppClientId = ${expectedUuid} ; AppKey =${expectedKey};tenantid=${expectedAuthorityId}`),
                    new KustoConnectionStringBuilder(`Network Address = localhost; AppClientId = ${expectedUuid} ; AppKey =${expectedKey};tid=${expectedAuthorityId} `),
                    KustoConnectionStringBuilder.withAadApplicationKeyAuthentication("localhost", expectedUuid, expectedKey, expectedAuthorityId)
                ];

                const kcsb1 = new KustoConnectionStringBuilder("server=localhost");
                kcsb1.applicationClientId = expectedUuid;
                kcsb1.applicationKey = expectedKey;
                kcsb1.authorityId = expectedAuthorityId;
                kcsbs.push(kcsb1);

                doComparison(kcsbs, expectedAuthorityId);
            })
        });

    });
});



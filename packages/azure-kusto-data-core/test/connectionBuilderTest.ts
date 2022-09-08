// // Copyright (c) Microsoft Corporation.
// // Licensed under the MIT License.

// /* eslint-disable no-console */

// import assert from "assert";
// import { v4 as uuidv4 } from "uuid";
// import { KustoConnectionStringBuilder } from "../source/connectionBuilder";

// const doComparsion = (
//     kcsbs: KustoConnectionStringBuilder[],
//     expectedProperties: Partial<Record<keyof KustoConnectionStringBuilder, unknown>>,
//     expectedToString: string,
//     expectedToStringWithSecrets: string
// ) => {
//     for (const [i, kcsb] of kcsbs.entries()) {
//         console.log(`Checking connection string #${i} - ${kcsb.toString(false)}`);

//         const clone = KustoConnectionStringBuilder.fromExisting(kcsb);

//         const emptyFields = [
//             "aadUserId",
//             "applicationClientId",
//             "password",
//             "msiClientId",
//             "applicationKey",
//             "applicationCertificatePrivateKey",
//             "applicationCertificateThumbprint",
//             "applicationCertificateX5c",
//             "deviceCodeCallback",
//             "loginHint",
//             "timeoutMs",
//             "accessToken",
//             "isAzLoginIdentity",
//             "isManagedIdentity",
//             "isInteractiveLogin",
//             "isDeviceCode",
//         ];

//         for (const entry of Object.entries(expectedProperties)) {
//             const [key, value] = entry;

//             const kcsbEntry = kcsb[key as keyof KustoConnectionStringBuilder];

//             if (typeof kcsbEntry === "function") {
//                 assert.notStrictEqual(kcsbEntry, undefined, `${key} is not defined`);
//                 continue;
//             }
//             assert.strictEqual(kcsbEntry, value, `${key} is not equal to ${value}`);
//             assert.strictEqual(clone[key as keyof KustoConnectionStringBuilder], value, `${key} is not equal to ${value} in clone`);
//         }

//         for (const field of emptyFields.filter((f) => !(f in expectedProperties))) {
//             assert.strictEqual(kcsb[field as keyof KustoConnectionStringBuilder], undefined, `${field} should be undefined`);
//             assert.strictEqual(clone[field as keyof KustoConnectionStringBuilder], undefined, `${field} should be undefined in clone`);
//         }

//         assert.strictEqual(kcsb.toString(), expectedToString);
//         assert.strictEqual(kcsb.toString(false), expectedToStringWithSecrets);
//     }
// };

// const DEFAULT_AUTHORITY = "organizations";

// describe("KustoConnectionStringBuilder", () => {
//     describe("validation tests", () => {
//         it("throws when empty connection string is provided", () => {
//             assert.throws(() => new KustoConnectionStringBuilder(" "), Error, "Missing connection string");
//         });

//         it("removes trailing dashes from data source", () => {
//             const kcsbForward = new KustoConnectionStringBuilder("https://test.kusto.windows.net/");
//             assert.strictEqual(kcsbForward.dataSource, "https://test.kusto.windows.net");
//             const kcsbBack = new KustoConnectionStringBuilder("https://test.kusto.windows.net\\");
//             assert.strictEqual(kcsbBack.dataSource, "https://test.kusto.windows.net");
//         });

//         it("throws when user or password is empty", () => {
//             assert.throws(
//                 () => KustoConnectionStringBuilder.withAadUserPasswordAuthentication("https://test.kusto.windows.net/", " ", "password"),
//                 Error,
//                 "Invalid user"
//             );
//             assert.throws(
//                 () => KustoConnectionStringBuilder.withAadUserPasswordAuthentication("https://test.kusto.windows.net/", "user", " "),
//                 Error,
//                 "Invalid password"
//             );
//         });

//     describe("#constructor(connectionString)", () => {
//         it("from string with no creds", () => {
//             const kcsbs = [
//                 new KustoConnectionStringBuilder("localhost"),
//                 new KustoConnectionStringBuilder("data Source=localhost"),
//                 new KustoConnectionStringBuilder("Addr=localhost"),
//                 new KustoConnectionStringBuilder("Addr = localhost"),
//             ];

//             doComparsion(
//                 kcsbs,
//                 {
//                     dataSource: "localhost",
//                     authorityId: DEFAULT_AUTHORITY,
//                 },
//                 "Data Source=localhost;Initial Catalog=NetDefaultDB;Authority Id=organizations",
//                 "Data Source=localhost;Initial Catalog=NetDefaultDB;Authority Id=organizations"
//             );
//         });

//         describe("from username auth", () => {
//             const expectedUser = "test";
//             const expectedPassword = "Pa$$w0rd";

//             it("without authority id", () => {
//                 const kcsbs = [
//                     new KustoConnectionStringBuilder(`localhost;AAD User ID=${expectedUser};password=${expectedPassword};AAD Federated Security=True`),
//                     new KustoConnectionStringBuilder(
//                         `Data Source=localhost ; AaD User ID=${expectedUser}; Password =${expectedPassword};AAD Federated Security=True`
//                     ),
//                     new KustoConnectionStringBuilder(
//                         ` Addr = localhost ; AAD User ID = ${expectedUser} ; Pwd =${expectedPassword};AAD Federated Security=True`
//                     ),
//                     new KustoConnectionStringBuilder(
//                         `Network Address = localhost; AAD User iD = ${expectedUser} ; Pwd = ${expectedPassword};AAD Federated Security=True `
//                     ),
//                     KustoConnectionStringBuilder.withAadUserPasswordAuthentication("localhost", expectedUser, expectedPassword),
//                 ];
//                 const kcsb1 = new KustoConnectionStringBuilder("Server=localhost");
//                 kcsb1.aadFederatedSecurity = true;
//                 kcsb1.aadUserId = expectedUser;
//                 kcsb1.password = expectedPassword;
//                 kcsbs.push(kcsb1);

//                 doComparsion(
//                     kcsbs,
//                     {
//                         dataSource: "localhost",
//                         authorityId: DEFAULT_AUTHORITY,
//                         aadUserId: expectedUser,
//                         password: expectedPassword,
//                         aadFederatedSecurity: true,
//                     },
//                     `Data Source=localhost;AAD Federated Security=true;Initial Catalog=NetDefaultDB;AAD User ID=${expectedUser};Password=****;Authority Id=organizations`,
//                     `Data Source=localhost;AAD Federated Security=true;Initial Catalog=NetDefaultDB;AAD User ID=${expectedUser};Password=${expectedPassword};Authority Id=organizations`
//                 );
//             });

//             it("with authority id", () => {
//                 const expectedAuthorityId = "test-authority";

//                 const kcsbs = [
//                     new KustoConnectionStringBuilder(
//                         `localhost;AAD User ID=${expectedUser};password=${expectedPassword};Authority Id=${expectedAuthorityId};AAD Federated Security=True`
//                     ),
//                     new KustoConnectionStringBuilder(
//                         `Data Source=localhost ; AaD User ID=${expectedUser}; Password =${expectedPassword};authority=${expectedAuthorityId};AAD Federated Security=True`
//                     ),
//                     new KustoConnectionStringBuilder(
//                         ` Addr = localhost ; AAD User ID = ${expectedUser} ; Pwd =${expectedPassword};tenantid=${expectedAuthorityId};AAD Federated Security=True`
//                     ),
//                     new KustoConnectionStringBuilder(
//                         `Network Address = localhost; AAD User iD = ${expectedUser} ; Pwd = ${expectedPassword};tid=${expectedAuthorityId};AAD Federated Security=True `
//                     ),
//                     KustoConnectionStringBuilder.withAadUserPasswordAuthentication("localhost", expectedUser, expectedPassword, expectedAuthorityId),
//                 ];

//                 const kcsb1 = new KustoConnectionStringBuilder("Server=localhost");
//                 kcsb1.aadFederatedSecurity = true;
//                 kcsb1.aadUserId = expectedUser;
//                 kcsb1.password = expectedPassword;
//                 kcsb1.authorityId = expectedAuthorityId;
//                 kcsbs.push(kcsb1);

//                 doComparsion(
//                     kcsbs,
//                     {
//                         dataSource: "localhost",
//                         authorityId: expectedAuthorityId,
//                         aadUserId: expectedUser,
//                         password: expectedPassword,
//                         aadFederatedSecurity: true,
//                     },
//                     `Data Source=localhost;AAD Federated Security=true;Initial Catalog=NetDefaultDB;AAD User ID=${expectedUser};Password=****;Authority Id=${expectedAuthorityId}`,
//                     `Data Source=localhost;AAD Federated Security=true;Initial Catalog=NetDefaultDB;AAD User ID=${expectedUser};Password=${expectedPassword};Authority Id=${expectedAuthorityId}`
//                 );
//             });
//         });

//         describe("from app key auth", () => {
//             const expectedUuid = uuidv4();
//             const expectedKey = "key of application";

//             it("without authority id", () => {
//                 const kcsbs = [
//                     new KustoConnectionStringBuilder(
//                         `localhost;Application client Id=${expectedUuid};application Key=${expectedKey};AAD Federated Security=True`
//                     ),
//                     new KustoConnectionStringBuilder(
//                         `Data Source=localhost ; Application Client Id=${expectedUuid}; Appkey =${expectedKey};AAD Federated Security=True`
//                     ),
//                     new KustoConnectionStringBuilder(` Addr = localhost ; AppClientId = ${expectedUuid} ; AppKey =${expectedKey};AAD Federated Security=True`),
//                     new KustoConnectionStringBuilder(
//                         `Network Address = localhost; AppClientId = ${expectedUuid} ; AppKey =${expectedKey};AAD Federated Security=True`
//                     ),
//                 ];

//                 const kcsb1 = new KustoConnectionStringBuilder("server=localhost");
//                 kcsb1.aadFederatedSecurity = true;
//                 kcsb1.applicationClientId = expectedUuid;
//                 kcsb1.applicationKey = expectedKey;
//                 kcsbs.push(kcsb1);

//                 doComparsion(
//                     kcsbs,
//                     {
//                         dataSource: "localhost",
//                         applicationClientId: expectedUuid,
//                         applicationKey: expectedKey,
//                         aadFederatedSecurity: true,
//                     },
//                     `Data Source=localhost;AAD Federated Security=true;Initial Catalog=NetDefaultDB;Application Client Id=${expectedUuid};Application Key=****;Authority Id=organizations`,
//                     `Data Source=localhost;AAD Federated Security=true;Initial Catalog=NetDefaultDB;Application Client Id=${expectedUuid};Application Key=${expectedKey};Authority Id=organizations`
//                 );
//             });

//             it("with authority id", () => {
//                 const expectedAuthorityId = "test-authority";

//                 const kcsbs = [
//                     new KustoConnectionStringBuilder(
//                         `localhost;Application client Id=${expectedUuid};application Key=${expectedKey};Authority Id=${expectedAuthorityId};AAD Federated Security=True`
//                     ),
//                     new KustoConnectionStringBuilder(
//                         `Data Source=localhost ; Application Client Id=${expectedUuid}; Appkey =${expectedKey};authority=${expectedAuthorityId};AAD Federated Security=True`
//                     ),
//                     new KustoConnectionStringBuilder(
//                         ` Addr = localhost ; AppClientId = ${expectedUuid} ; AppKey =${expectedKey};tenantid=${expectedAuthorityId};AAD Federated Security=True`
//                     ),
//                     new KustoConnectionStringBuilder(
//                         `Network Address = localhost; AppClientId = ${expectedUuid} ; AppKey =${expectedKey};tid=${expectedAuthorityId};AAD Federated Security=True `
//                     ),
//                 ];

//                 const kcsb1 = new KustoConnectionStringBuilder("server=localhost");
//                 kcsb1.aadFederatedSecurity = true;
//                 kcsb1.applicationClientId = expectedUuid;
//                 kcsb1.applicationKey = expectedKey;
//                 kcsb1.authorityId = expectedAuthorityId;
//                 kcsbs.push(kcsb1);

//                 doComparsion(
//                     kcsbs,
//                     {
//                         dataSource: "localhost",
//                         applicationClientId: expectedUuid,
//                         applicationKey: expectedKey,
//                         aadFederatedSecurity: true,
//                     },
//                     `Data Source=localhost;AAD Federated Security=true;Initial Catalog=NetDefaultDB;Application Client Id=${expectedUuid};Application Key=****;Authority Id=${expectedAuthorityId}`,
//                     `Data Source=localhost;AAD Federated Security=true;Initial Catalog=NetDefaultDB;Application Client Id=${expectedUuid};Application Key=${expectedKey};Authority Id=${expectedAuthorityId}`
//                 );
//             });
//         });

//         describe("from certificate auth", () => {
//             const appId = uuidv4();
//             const privateKey = "some private key";
//             const thumbPrint = "thumbprint";
//             const expectedAuthorityId = "test-authority";
//             const cert5xc = "5xc";

//             it("with authority id", () => {
//                 const kcsbs = [
//                     new KustoConnectionStringBuilder(
//                         `localhost;Application client Id=${appId};application Certificate PrivateKey=${privateKey};application certificate thumbprint=${thumbPrint};Authority Id=${expectedAuthorityId};application certificate x5c=${cert5xc};AAD Federated Security=True`
//                     ),
//                     new KustoConnectionStringBuilder(
//                         `localhost;AppClientId=${appId};Application Certificate PrivateKey=${privateKey};appcert=${thumbPrint};Authority Id=${expectedAuthorityId};SendX5c=${cert5xc};AAD Federated Security=True`
//                     ),
//                 ];

//                 const kcsb1 = new KustoConnectionStringBuilder("server=localhost");
//                 kcsb1.aadFederatedSecurity = true;
//                 kcsb1.applicationClientId = appId;
//                 kcsb1.authorityId = expectedAuthorityId;
//                 kcsb1.applicationCertificatePrivateKey = privateKey;
//                 kcsb1.applicationCertificateThumbprint = thumbPrint;
//                 kcsb1.applicationCertificateX5c = cert5xc;
//                 kcsbs.push(kcsb1);

//                 doComparsion(
//                     kcsbs,
//                     {
//                         dataSource: "localhost",
//                         applicationClientId: appId,
//                         applicationCertificatePrivateKey: privateKey,
//                         applicationCertificateThumbprint: thumbPrint,
//                         authorityId: expectedAuthorityId,
//                         applicationCertificateX5c: cert5xc,
//                         aadFederatedSecurity: true,
//                     },
//                     `Data Source=localhost;AAD Federated Security=true;Initial Catalog=NetDefaultDB;Application Client Id=${appId};Application Certificate PrivateKey=****;Application Certificate Thumbprint=${thumbPrint};Application Certificate x5c=${cert5xc};Authority Id=${expectedAuthorityId}`,
//                     `Data Source=localhost;AAD Federated Security=true;Initial Catalog=NetDefaultDB;Application Client Id=${appId};Application Certificate PrivateKey=${privateKey};Application Certificate Thumbprint=${thumbPrint};Application Certificate x5c=${cert5xc};Authority Id=${expectedAuthorityId}`
//                 );
//             });

//             it("without authority id", () => {
//                 const kcsbs = [
//                     new KustoConnectionStringBuilder(
//                         `localhost;Application client Id=${appId};application Certificate PrivateKey=${privateKey};application certificate thumbprint=${thumbPrint};application certificate x5c=${cert5xc};AAD Federated Security=True`
//                     ),
//                     new KustoConnectionStringBuilder(
//                         `localhost;AppClientId=${appId};Application Certificate PrivateKey=${privateKey};appcert=${thumbPrint};SendX5c=${cert5xc};AAD Federated Security=True`
//                     ),
//                 ];

//                 const kcsb1 = new KustoConnectionStringBuilder("server=localhost");
//                 kcsb1.aadFederatedSecurity = true;
//                 kcsb1.applicationClientId = appId;
//                 kcsb1.applicationCertificatePrivateKey = privateKey;
//                 kcsb1.applicationCertificateThumbprint = thumbPrint;
//                 kcsb1.applicationCertificateX5c = cert5xc;
//                 kcsbs.push(kcsb1);

//                 doComparsion(
//                     kcsbs,
//                     {
//                         dataSource: "localhost",
//                         applicationClientId: appId,
//                         applicationCertificatePrivateKey: privateKey,
//                         applicationCertificateThumbprint: thumbPrint,
//                         authorityId: DEFAULT_AUTHORITY,
//                         applicationCertificateX5c: cert5xc,
//                         aadFederatedSecurity: true,
//                     },
//                     `Data Source=localhost;AAD Federated Security=true;Initial Catalog=NetDefaultDB;Application Client Id=${appId};Application Certificate PrivateKey=****;Application Certificate Thumbprint=${thumbPrint};Application Certificate x5c=${cert5xc};Authority Id=organizations`,
//                     `Data Source=localhost;AAD Federated Security=true;Initial Catalog=NetDefaultDB;Application Client Id=${appId};Application Certificate PrivateKey=${privateKey};Application Certificate Thumbprint=${thumbPrint};Application Certificate x5c=${cert5xc};Authority Id=organizations`
//                 );
//             });

//             it("without 3xc", () => {
//                 const kcsbs = [
//                     new KustoConnectionStringBuilder(
//                         `localhost;Application client Id=${appId};application Certificate PrivateKey=${privateKey};application certificate thumbprint=${thumbPrint};AAD Federated Security=True`
//                     ),
//                     new KustoConnectionStringBuilder(
//                         `localhost;AppClientId=${appId};Application Certificate PrivateKey=${privateKey};appcert=${thumbPrint};AAD Federated Security=True`
//                     ),
//                 ];

//                 const kcsb1 = new KustoConnectionStringBuilder("server=localhost");
//                 kcsb1.aadFederatedSecurity = true;
//                 kcsb1.applicationClientId = appId;
//                 kcsb1.applicationCertificatePrivateKey = privateKey;
//                 kcsb1.applicationCertificateThumbprint = thumbPrint;
//                 kcsbs.push(kcsb1);

//                 doComparsion(
//                     kcsbs,
//                     {
//                         dataSource: "localhost",
//                         applicationClientId: appId,
//                         applicationCertificatePrivateKey: privateKey,
//                         applicationCertificateThumbprint: thumbPrint,
//                         authorityId: DEFAULT_AUTHORITY,
//                         aadFederatedSecurity: true,
//                     },
//                     `Data Source=localhost;AAD Federated Security=true;Initial Catalog=NetDefaultDB;Application Client Id=${appId};Application Certificate PrivateKey=****;Application Certificate Thumbprint=${thumbPrint};Authority Id=organizations`,
//                     `Data Source=localhost;AAD Federated Security=true;Initial Catalog=NetDefaultDB;Application Client Id=${appId};Application Certificate PrivateKey=${privateKey};Application Certificate Thumbprint=${thumbPrint};Authority Id=organizations`
//                 );
//             });
//         });

//         describe("from access token", () => {
//             const token = "some_token";
//             const kcsbs = [KustoConnectionStringBuilder.withAccessToken("localhost", token)];

//             const kcsb1 = new KustoConnectionStringBuilder("server=localhost");
//             kcsb1.aadFederatedSecurity = true;
//             kcsb1.accessToken = token;

//             doComparsion(
//                 kcsbs,
//                 {
//                     dataSource: "localhost",
//                     aadFederatedSecurity: true,
//                     accessToken: token,
//                 },
//                 "Data Source=localhost;AAD Federated Security=true;Initial Catalog=NetDefaultDB;Authority Id=organizations",
//                 "Data Source=localhost;AAD Federated Security=true;Initial Catalog=NetDefaultDB;Authority Id=organizations"
//             );
//         });

//         describe("from token provider", () => {
//             const tokenProvider = () => Promise.resolve("some_token");
//             const kcsbs = [KustoConnectionStringBuilder.withTokenProvider("localhost", tokenProvider)];

//             const kcsb1 = new KustoConnectionStringBuilder("server=localhost");
//             kcsb1.aadFederatedSecurity = true;
//             kcsb1.tokenProvider = tokenProvider;

//             doComparsion(
//                 kcsbs,
//                 {
//                     dataSource: "localhost",
//                     aadFederatedSecurity: true,
//                     tokenProvider,
//                 },
//                 "Data Source=localhost;AAD Federated Security=true;Initial Catalog=NetDefaultDB;Authority Id=organizations",
//                 "Data Source=localhost;AAD Federated Security=true;Initial Catalog=NetDefaultDB;Authority Id=organizations"
//             );
//         });

//         describe("interactive login", () => {
//             it("without optional params", () => {
//                 const kcsbs = [KustoConnectionStringBuilder.withUserPrompt("localhost", DEFAULT_AUTHORITY)];

//                 const kcsb1 = new KustoConnectionStringBuilder("server=localhost");
//                 kcsb1.aadFederatedSecurity = true;
//                 kcsb1.useUserPromptAuth = true;

//                 doComparsion(
//                     kcsbs,
//                     {
//                         dataSource: "localhost",
//                         authorityId: DEFAULT_AUTHORITY,
//                         useUserPromptAuth: true,
//                         aadFederatedSecurity: true,
//                     },
//                     "Data Source=localhost;AAD Federated Security=true;Initial Catalog=NetDefaultDB;Authority Id=organizations",
//                     "Data Source=localhost;AAD Federated Security=true;Initial Catalog=NetDefaultDB;Authority Id=organizations"
//                 );
//             });

//             it("with optional params", () => {
//                 const clientId = "clientId";
//                 const loginHint = "myUser";
//                 const timeoutMs = 10;
//                 const kcsbs = [KustoConnectionStringBuilder.withUserPrompt("localhost", DEFAULT_AUTHORITY, clientId, timeoutMs, loginHint)];

//                 const kcsb1 = new KustoConnectionStringBuilder("server=localhost");
//                 kcsb1.aadFederatedSecurity = true;
//                 kcsb1.useUserPromptAuth = true;
//                 kcsb1.applicationClientId = clientId;
//                 kcsb1.timeoutMs = timeoutMs;
//                 kcsb1.loginHint = loginHint;

//                 doComparsion(
//                     kcsbs,
//                     {
//                         dataSource: "localhost",
//                         authorityId: DEFAULT_AUTHORITY,
//                         useUserPromptAuth: true,
//                         aadFederatedSecurity: true,
//                         applicationClientId: clientId,
//                         timeoutMs,
//                         loginHint,
//                     },
//                     `Data Source=localhost;AAD Federated Security=true;Initial Catalog=NetDefaultDB;Application Client Id=${clientId};Authority Id=organizations`,
//                     `Data Source=localhost;AAD Federated Security=true;Initial Catalog=NetDefaultDB;Application Client Id=${clientId};Authority Id=organizations`
//                 );
//             });
//         });
//     });
// });

const assert = require("assert");
const uuidv4 = require("uuid/v4");

const KustoConnectionStringBuilder = require("../source/connectionBuilder");
describe("KustoConnectionStringBuilder", function () {
    describe("#constructor(connectionString)", function () {
        it("from string with no creds", function () {
            let kcsbs = [
                new KustoConnectionStringBuilder("localhost"),
                new KustoConnectionStringBuilder("data Source=localhost"),
                new KustoConnectionStringBuilder("Addr=localhost"),
                new KustoConnectionStringBuilder("Addr = localhost"),
                KustoConnectionStringBuilder.withAadDeviceAuthentication("localhost", "common"),
            ];

            for (let kcsb of kcsbs) {
                assert.equal(kcsb.dataSource, "localhost");
                assert.equal(kcsb.authorityId, "common");
                let emptyFields = ["aadUserId", "password", "applicationClientId", "applicationKey"];
                for (let field of emptyFields) {
                    assert.equal(kcsb[field], null);
                }
            }
        });

        it("from string with username auth", function () {
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

            for (let kcsb of kcsbs) {
                assert.equal(kcsb.dataSource, "localhost");
                assert.equal(kcsb.aadUserId, expectedUser);
                assert.equal(kcsb.password, expectedPassword);
                assert.equal(kcsb.authorityId, "common");
                let emptyFields = ["applicationClientId", "applicationKey"];
                for (let field of emptyFields) {
                    assert.equal(kcsb[field], null);
                }
            }
        });

        it("from string with app auth", function () {

            const uuid = uuidv4();
            const key = "key of application";

            let kcsbs = [
                new KustoConnectionStringBuilder(`localhost;Application client Id=${uuid};application Key=${key}`),
                new KustoConnectionStringBuilder(`Data Source=localhost ; Application Client Id=${uuid}; Appkey =${key}`),
                new KustoConnectionStringBuilder(` Addr = localhost ; AppClientId = ${uuid} ; AppKey =${key}`),
                new KustoConnectionStringBuilder(`Network Address = localhost; AppClientId = ${uuid} ; AppKey =${key}`),
                KustoConnectionStringBuilder.withAadApplicationKeyAuthentication("localhost", uuid, key)
            ];

            let kcsb1 = new KustoConnectionStringBuilder("server=localhost");
            kcsb1.applicationClientId = uuid;
            kcsb1.applicationKey = key;
            kcsbs.push(kcsb1);

            for (let kcsb of kcsbs) {
                assert.equal(kcsb.dataSource, "localhost");
                assert.equal(kcsb.applicationClientId, uuid);
                assert.equal(kcsb.applicationKey, key);
                assert.equal(kcsb.authorityId, "common");
                let emptyFields = ["aadUserId", "password"];
                for (let field of emptyFields) {
                    assert.equal(kcsb[field], null);
                }
            }
        });

        it("from string with managed identity", function () {    
            const kcsb1 = KustoConnectionStringBuilder.withAadManagedIdentities("https://dadubovs1.westus.kusto.windows.net");

            assert.equal(kcsb1.msiEndpoint, "http://169.254.169.254/metadata/identity/oauth2/token");

            process.env.MSI_ENDPOINT = "http://localhost";
            process.env.MSI_SECRET = "123";

            const kcsb2 = KustoConnectionStringBuilder.withAadManagedIdentities("https://dadubovs1.westus.kusto.windows.net");

            assert.equal(kcsb2.msiEndpoint, process.env.MSI_ENDPOINT);
            assert.equal(kcsb2.msiSecret, process.env.MSI_SECRET);
        });
    });
});



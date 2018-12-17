const assert = require("assert");
const uuidv4 = require("uuid/v4");

const KustoConnectionStringBuilder = require("../source/connectionBuilder");
describe("KustoConnectionStringBuilder", function () {
    describe("#constructor(connectionString)", function () {
        it("url validation", function () {
            let kcsb1 = new KustoConnectionStringBuilder("http://cluster.region.kusto.windows.net");
            assert.equal(kcsb1.dataSource, "http://cluster.region.kusto.windows.net");
            let kcsb2 = new KustoConnectionStringBuilder("https://cluster.region.kusto.windows.net:443/");
            assert.equal(kcsb2.dataSource, "https://cluster.region.kusto.windows.net:443");
            let kcsb3 = new KustoConnectionStringBuilder("https://cluster.region.kusto.windows.net/");
            assert.equal(kcsb3.dataSource, "https://cluster.region.kusto.windows.net");
        });
        
        it("from string with no creds", function () {
            let kcsbs = [
                new KustoConnectionStringBuilder("localhost"),
                new KustoConnectionStringBuilder("data Source=localhost"),
                new KustoConnectionStringBuilder("Addr=localhost"),
                new KustoConnectionStringBuilder("Addr = localhost"),
                KustoConnectionStringBuilder.withAadDeviceAuthentication("localhost"),
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
    });
});


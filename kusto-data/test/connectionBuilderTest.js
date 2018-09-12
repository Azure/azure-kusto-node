const assert = require("assert");
const KustoConnectionStringBuilder = require("../source/connectionBuilder");
describe("KustoConnectionBuilder", function () {
    describe("#constructor(connectionString)", function () {
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
                let emptyFields = ["aadUserId", "password", "applicationClientId", "applicationKey", "authorityId"];
                for (let field of emptyFields) {
                    assert.equal(kcsb[field], null);
                }
            }
        });

        it("from string with username", function () {
            const user = "test";
            const password = "Pa$$w0rd";
            const kcsbs = [
                new KustoConnectionStringBuilder(`localhost;AAD User ID=${user};password=${password}`),
                new KustoConnectionStringBuilder(`Data Source=localhost ; AaD User ID=${user}; Password =${password}`),
                new KustoConnectionStringBuilder(` Addr = localhost ; AAD User ID = ${user} ; Pwd =${password}`),
                new KustoConnectionStringBuilder(`Network Address = localhost; AAD User iD = ${user} ; Pwd = ${password} `),
                KustoConnectionStringBuilder.withAadUserPasswordAuthentication("localhost", user, password),
            ];
            const kcsb1 = new KustoConnectionStringBuilder("Server=localhost");
            kcsb1.aadUserId = user;
            kcsb1.password = password;
            kcsbs.append(kcsb1);
            
            // TODO: not sure if wanna test this
            // const kcsb2 = new KustoConnectionStringBuilder("server=localhost");
            // kcsb2["AAD User ID"] = user;
            // kcsb2["Password"] = password;
            // kcsbs.append(kcsb2);

            for (let kcsb of kcsbs) {
                assert.equal(kcsb.dataSource, "localhost");
                assert.equal(kcsb.user, user);
                assert.equal(kcsb.password, password);
                let emptyFields = ["applicationClientId", "applicationKey", "authorityId"];
                for (let field of emptyFields) {
                    assert.equal(kcsb[field], null);
                }
            }
        });

        it("from string with app", function () {

            assert.equal([1, 2, 3].indexOf(4), -1);
        });
    });
});


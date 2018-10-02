const assert = require("assert");
const ResourceManager = require("../source/resourceManager").ResourceManager;
const ResourceURI = require("../source/resourceManager").ResourceURI;

describe("ResourceURI", function () {
    describe("#fromUri()", function () {
        it("valid input", function () {
            const accountName = "account";
            const objectType = "blob";
            const objectName = "container";
            const sas = "sas";

            let uri = `https://${accountName}.${objectType}.core.windows.net/${objectName}?${sas}`;
            const storageUrl = ResourceURI.fromURI(uri);
            
            assert.equal(storageUrl.accountName, accountName);
            assert.equal(storageUrl.objectType, objectType);
            assert.equal(storageUrl.objectName, objectName);
            assert.equal(storageUrl.sas, sas);
        });
    });

    describe("#toURI()", function () {
        it("valid input", function () {
            const accountName = "account";
            const objectType = "blob";
            const objectName = "container";
            const sas = "sas";

            
            const storageUrl = new StorageUrl(accountName,objectType,objectName,sas);
            
            assert.equal(storageUrl.toURI(), `https://${accountName}.${objectType}.core.windows.net/${objectName}?${sas}`);
        });
    });
});

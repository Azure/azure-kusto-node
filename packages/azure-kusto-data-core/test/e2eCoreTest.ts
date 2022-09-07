// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/* eslint-disable no-console */
 import assert from "assert";
 import { Client , KustoConnectionStringBuilder} from "..";
import { CloudSettings } from "../source/cloudSettings";
// const databaseName = process.env.TEST_DATABASE!;
// const tenantId = process.env.TENANT_ID ;
// const engineCsb = process.env.ENGINE_CONNECTION_STRING!;
const databaseName = "fast";
const tenantId = "microsoft.com";
const engineCsb = "https://devdevon.westeurope.dev.kusto.windows.net";

const main = () => {
    const tableName = `NodeTest${Date.now()}`;
    const engineKcsb = KustoConnectionStringBuilder.withUserPrompt(engineCsb, tenantId);
    const queryClient = new Client(engineKcsb);
    const tableColumns =
        "(rownumber:int, rowguid:string, xdouble:real, xfloat:real, xbool:bool, xint16:int, xint32:int, xint64:long, xuint8:long, xuint16:long, xuint32:long, xuint64:long, xdate:datetime, xsmalltext:string, xtext:string, xnumberAsText:string, xtime:timespan, xtextWithNulls:string, xdynamicWithNulls:dynamic)";
    describe(`E2E Tests`, () => {
        after(async () => {
            try {
                await queryClient.execute(databaseName, `.drop table ${tableName} ifexists`);
            } catch (err) {
                assert.fail("Failed to drop table");
            }
        });

        before("SetUp", async () => {
            try {
                await queryClient.execute(databaseName, `.create table ${tableName} ${tableColumns}`);
            } catch (err) {
                console.log(`Creating table ${tableName}, with columns ${tableColumns}`);

                assert.fail(`Failed to create table ${tableName} ${err} ${databaseName}, error: ${JSON.stringify(err)}`);
            }
        });

        describe("cloud info", () => {
            it("Cached cloud info", () => {
                const cloudInfo = CloudSettings.getInstance().cloudCache[engineCsb]; // it should be already in the cache at this point
                const s = CloudSettings.getInstance();
                console.log(s)
                assert.strictEqual(cloudInfo?.KustoClientAppId, CloudSettings.getInstance().defaultCloudInfo.KustoClientAppId);
            });

            it("cloud info 404", async () => {
                const cloudInfo = await CloudSettings.getInstance().getCloudInfoForCluster("https://www.microsoft.com");
                assert.strictEqual(cloudInfo, CloudSettings.getInstance().defaultCloudInfo);
            });
        });
    });
}

main();
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "assert";
import { RankedStorageAccountSet } from "../src/rankedStorageAccountSet.js";

describe("RankedStorageAccountSet", () => {
    describe("Input validation.", () => {
        it("Validate registerStorageAccount().", () => {
            const accounts = new RankedStorageAccountSet();
            // Register accounts
            for (let i = 0; i < 10; i++) {
                accounts.registerStorageAccount("account_" + i.toString());
            }
            // Validate accounts
            for (let i = 0; i < 10; i++) {
                assert.equal(accounts.getStorageAccount("account_" + i.toString()).getAccountName(), "account_" + i.toString());
            }
        });

        it("Validate logResultToAccount().", () => {
            const accounts = new RankedStorageAccountSet();
            // Register accounts
            accounts.registerStorageAccount("account_1");
            // Should work
            accounts.logResultToAccount("account_1", true);
            // Should throw
            assert.throws(() => accounts.logResultToAccount("account_2", true), Error);
        });

        it("Validate getStorageAccount().", () => {
            const accounts = new RankedStorageAccountSet();
            // Register accounts
            accounts.registerStorageAccount("account_1");
            // Should work
            assert.equal(accounts.getStorageAccount("account_1").getAccountName(), "account_1");
            // Should throw
            assert.throws(() => accounts.getStorageAccount("account_2"), Error);
        });
    });

    describe("Check rank using getRankedShuffledAccounts.", () => {
        it("Validate rank when no data.", () => {
            const accounts = new RankedStorageAccountSet();
            // Register accounts
            for (let i = 0; i < 10; i++) {
                accounts.registerStorageAccount("account_" + i.toString());
            }
            // get shuffeled accounts
            const rankedAccounts = accounts.getRankedShuffledAccounts();
            // validate rank
            for (const account of rankedAccounts) {
                // All accounts should have rank 1 (highest rank)
                assert.equal(account.getRank(), 1);
            }
        });

        it("Verify that getRankedShuffledAccounts returns shuffled accounts in each call.", () => {
            const accounts = new RankedStorageAccountSet();
            // Register accounts
            for (let i = 0; i < 100; i++) {
                accounts.registerStorageAccount("account_" + i.toString());
            }
            // get shuffeled accounts
            const shuffledAccounts1 = accounts.getRankedShuffledAccounts();
            const shuffledAccounts2 = accounts.getRankedShuffledAccounts();
            // make sure buth list has the same accounts
            const set1 = new Set(shuffledAccounts1);
            const set2 = new Set(shuffledAccounts2);
            // check intersection
            const intersection = new Set([...set1].filter((x) => !set2.has(x)));
            assert.equal(intersection.size, 0);
            // Check that the order is different
            assert.notDeepEqual(shuffledAccounts1, shuffledAccounts2);
        });

        it("Validate rank when success rate is different.", () => {
            let time = 0;
            const accounts = new RankedStorageAccountSet(undefined, undefined, undefined, () => {
                return time;
            });
            // Register accounts
            for (let i = 1; i <= 5; i++) {
                accounts.registerStorageAccount("account_" + i.toString());
            }
            // log results for 60 seconds
            for (time = 0; time < 60; time++) {
                accounts.logResultToAccount("account_1", true); // 100% success
                accounts.logResultToAccount("account_2", time % 10 !== 0); // ~90% success
                accounts.logResultToAccount("account_3", time % 2 === 0); // 50% success
                accounts.logResultToAccount("account_4", time % 3 === 0); // ~33% success
                accounts.logResultToAccount("account_5", false); // 0% success
            }
            // get shuffeled accounts and validate order
            const rankedAccounts = accounts.getRankedShuffledAccounts();
            assert.equal(rankedAccounts[0].getAccountName(), "account_1");
            assert.equal(rankedAccounts[1].getAccountName(), "account_2");
            expect(["account_3", "account_4"]).toContain(rankedAccounts[2].getAccountName());
            expect(["account_3", "account_4"]).toContain(rankedAccounts[3].getAccountName());
            assert.equal(rankedAccounts[4].getAccountName(), "account_5");
            // validate rank
            assert.equal(accounts.getStorageAccount("account_1").getRank(), 1);
            expect(accounts.getStorageAccount("account_2").getRank()).toBeCloseTo(0.9);
            assert.equal(accounts.getStorageAccount("account_3").getRank(), 0.5);
            expect(accounts.getStorageAccount("account_4").getRank()).toBeCloseTo(0.32);
            assert.equal(accounts.getStorageAccount("account_5").getRank(), 0);
        });

        it("Validate that newer results have more weight.", () => {
            let time = 0;
            const accounts = new RankedStorageAccountSet(undefined, 1, undefined, () => {
                return time;
            });
            // Register accounts
            accounts.registerStorageAccount("account_1");
            // log results
            accounts.logResultToAccount("account_1", true);
            time++;
            accounts.logResultToAccount("account_1", true);
            time++;
            accounts.logResultToAccount("account_1", true);
            time++;
            accounts.logResultToAccount("account_1", false);
            time++;
            accounts.logResultToAccount("account_1", false);
            time++;
            accounts.logResultToAccount("account_1", false);
            expect(accounts.getStorageAccount("account_1").getRank()).toBeLessThan(0.5);
        });
    });
});

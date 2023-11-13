// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { RankedStorageAccount } from "./rankedStorageAccount";

export class RankedStorageAccountSet {
    public static readonly DefaultNumberOfBuckets: number = 6;
    public static readonly DefaultBucketDurationInSeconds: number = 10;
    public static readonly DefaultTiers: number[] = [90, 70, 30, 0];
    public static readonly DefaultTimeProviderInSeconds: () => number = () => {
        return new Date().getTime() / 1000;
    };

    private accounts: Map<string, RankedStorageAccount>;
    private numberOfBuckets: number;
    private bucketDuration: number;
    private tiers: number[];
    private timeProvider: () => number;

    constructor(
        numberOfBuckets: number = RankedStorageAccountSet.DefaultNumberOfBuckets,
        bucketDuration: number = RankedStorageAccountSet.DefaultBucketDurationInSeconds,
        tiers: number[] = RankedStorageAccountSet.DefaultTiers,
        timeProvider: () => number = RankedStorageAccountSet.DefaultTimeProviderInSeconds
    ) {
        this.accounts = new Map<string, RankedStorageAccount>();
        this.numberOfBuckets = numberOfBuckets;
        this.bucketDuration = bucketDuration;
        this.tiers = tiers;
        this.timeProvider = timeProvider;
    }

    logResultToAccount(accountName: string, result: boolean) {
        if (!this.accounts.has(accountName)) {
            throw new Error("Storage account name is not part of the set.");
        }
        this.accounts.get(accountName)?.logResult(result);
    }

    registerStorageAccount(accountName: string) {
        if (this.accounts.has(accountName)) {
            return;
        }
        this.accounts.set(accountName, new RankedStorageAccount(accountName, this.numberOfBuckets, this.bucketDuration, this.timeProvider));
    }

    getStorageAccount(accountName: string): RankedStorageAccount {
        const account = this.accounts.get(accountName);
        if (account) {
            return account;
        }
        throw new Error("Storage account name is not part of the set.");
    }

    getRankedShuffledAccounts(): RankedStorageAccount[] {
        const accountsByTier: RankedStorageAccount[][] = new Array<RankedStorageAccount[]>(this.tiers.length);

        // Group accounts by tier and rank
        this.accounts.forEach((account: RankedStorageAccount) => {
            const rank = account.getRank() * 100;
            for (let i = 0; i < this.tiers.length; i++) {
                if (rank >= this.tiers[i]) {
                    if (!accountsByTier[i]) {
                        accountsByTier[i] = [];
                    }
                    accountsByTier[i].push(account);
                    break;
                }
            }
        });

        // Shuffle each tier
        for (let i = 0; i < this.tiers.length; i++) {
            if (accountsByTier[i]) {
                accountsByTier[i].sort(() => Math.random() - 0.5);
            }
        }

        // Flatten the array
        return accountsByTier.flat();
    }
}

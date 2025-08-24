// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { RankedStorageAccount } from "./rankedStorageAccount.js";

export class RankedStorageAccountSet {
    public static readonly DefaultNumberOfBuckets: number = 6;
    public static readonly DefaultBucketDurationInSeconds: number = 10;
    public static readonly DefaultTiers: number[] = [90, 70, 30, 0];
    public static readonly DefaultTimeProviderInSeconds: () => number = () => {
        return Date.now() / 1000;
    };

    private accounts: Map<string, RankedStorageAccount>;

    constructor(
        private numberOfBuckets: number = RankedStorageAccountSet.DefaultNumberOfBuckets,
        private bucketDuration: number = RankedStorageAccountSet.DefaultBucketDurationInSeconds,
        private tiers: number[] = RankedStorageAccountSet.DefaultTiers,
        private timeProvider: () => number = RankedStorageAccountSet.DefaultTimeProviderInSeconds,
    ) {
        this.accounts = new Map<string, RankedStorageAccount>();
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
        for (const account of this.accounts.values()) {
            const rank = account.getRank() * 100;
            const tierInedx = this.tiers.findIndex((tier) => rank >= tier);
            accountsByTier[tierInedx] = accountsByTier[tierInedx] || [];
            accountsByTier[tierInedx].push(account);
        }

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

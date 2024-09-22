// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
class StorageAccountStats {
    public successCount: number;
    public totalCount: number;

    constructor() {
        this.successCount = 0;
        this.totalCount = 0;
    }

    logResult(success: boolean): void {
        this.totalCount += 1;
        if (success) {
            this.successCount += 1;
        }
    }

    reset(): void {
        this.successCount = 0;
        this.totalCount = 0;
    }
}

export class RankedStorageAccount {
    private buckets: StorageAccountStats[];
    private lastUpdateTime: number;
    private currentBucketIndex: number;

    constructor(
        private accountName: string,
        private numberOfBuckets: number,
        private bucketDuration: number,
        private timeProvider: () => number,
    ) {
        this.buckets = new Array<StorageAccountStats>(numberOfBuckets).fill(new StorageAccountStats()).map(() => new StorageAccountStats());
        this.lastUpdateTime = this.timeProvider();
        this.currentBucketIndex = 0;
    }

    logResult(success: boolean): void {
        this.currentBucketIndex = this.adjustForTimePassed();
        this.buckets[this.currentBucketIndex].logResult(success);
    }

    getAccountName(): string {
        return this.accountName;
    }

    adjustForTimePassed(): number {
        const currentTime = this.timeProvider();
        const timeDelta = currentTime - this.lastUpdateTime;
        let window_size = 0;

        if (timeDelta >= this.bucketDuration) {
            this.lastUpdateTime = currentTime;
            window_size = Math.min(Math.floor(timeDelta / this.bucketDuration), this.numberOfBuckets);
            for (let i = 1; i < window_size + 1; i++) {
                const indexToReset = (this.currentBucketIndex + i) % this.numberOfBuckets;
                this.buckets[indexToReset].reset();
            }
        }

        return (this.currentBucketIndex + window_size) % this.numberOfBuckets;
    }

    getRank(): number {
        let rank: number = 0;
        let totalWeight: number = 0;

        for (let i = 1; i <= this.numberOfBuckets; i++) {
            const bucketIndex: number = (this.currentBucketIndex + i) % this.numberOfBuckets;
            const bucket: StorageAccountStats = this.buckets[bucketIndex];
            if (bucket.totalCount === 0) {
                continue;
            }
            const successRate: number = bucket.successCount / bucket.totalCount;
            rank += successRate * i;
            totalWeight += i;
        }

        if (totalWeight === 0) {
            return 1;
        }
        return rank / totalWeight;
    }
}

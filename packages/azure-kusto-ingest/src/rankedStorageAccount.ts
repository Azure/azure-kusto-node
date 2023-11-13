// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
class StorageAccountStats {
    public SuccessCount: number;
    public TotalCount: number;

    constructor() {
        this.SuccessCount = 0;
        this.TotalCount = 0;
    }

    log_result(success: boolean): void {
        this.TotalCount += 1;
        if (success) {
            this.SuccessCount += 1;
        }
    }

    reset(): void {
        this.SuccessCount = 0;
        this.TotalCount = 0;
    }
}

export class RankedStorageAccount {
    private accountName: string;
    private numberOfBuckets: number;
    private bucketDuration: number;
    private timeProvider: () => number;
    private buckets: StorageAccountStats[];
    private lastUpdateTime: number;
    private currentBucketIndex: number;

    constructor(accountName: string, numberOfBuckets: number, bucketDuration: number, timeProvider: () => number) {
        this.accountName = accountName;
        this.numberOfBuckets = numberOfBuckets;
        this.bucketDuration = bucketDuration;
        this.timeProvider = timeProvider;
        this.buckets = new Array<StorageAccountStats>(numberOfBuckets).fill(new StorageAccountStats()).map(() => new StorageAccountStats());
        this.lastUpdateTime = this.timeProvider();
        this.currentBucketIndex = 0;
    }

    logResult(success: boolean): void {
        this.currentBucketIndex = this.adjustForTimePassed();
        this.buckets[this.currentBucketIndex].log_result(success);
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
            if (bucket.TotalCount === 0) {
                continue;
            }
            const successRate: number = bucket.SuccessCount / bucket.TotalCount;
            rank += successRate * i;
            totalWeight += i;
        }

        if (totalWeight === 0) {
            return 1;
        }
        return rank / totalWeight;
    }
}

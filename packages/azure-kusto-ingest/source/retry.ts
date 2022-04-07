// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export const sleep = (ms: number): Promise<void> => {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};

export class ExponentialRetry {
    public currentAttempt: number;

    constructor(public attemptCount: number, public sleepBaseSecs: number, public maxJitterSecs: number) {
        this.currentAttempt = 0;
    }

    public async backoff(): Promise<void> {
        if (!this.shouldTry()) {
            throw new Error("Max retries exceeded");
        }

        const base = this.sleepBaseSecs * Math.pow(2, this.currentAttempt);
        const jitter = Math.floor(this.maxJitterSecs * Math.random());
        await sleep(1000 * (base + jitter));
        this.currentAttempt++;
    }

    public shouldTry(): boolean {
        return this.currentAttempt < this.attemptCount;
    }
}

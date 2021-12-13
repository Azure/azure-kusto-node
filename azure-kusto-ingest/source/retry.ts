export const sleep = (ms: number): Promise<void> => {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

export class ExponentialRetry {
    public retries: number;

    constructor(public maxRetries: number, public sleepBaseSecs: number, public maxJitterSecs: number) {
        this.retries = 0;
    }

    public async backoff(): Promise<void> {
        if (!this.shouldTry()) {
            throw new Error("Max retries exceeded");
        }

        const base = this.sleepBaseSecs * Math.pow(2, this.retries)
        const jitter = Math.floor(this.maxJitterSecs * Math.random())
        await sleep(1000 * (base + jitter));
        this.retries++;
    }

    public shouldTry(): boolean {
        return this.retries < this.maxRetries;
    }
}
export class KustoAuthenticationError extends Error {
    constructor(message: string, public inner: Error | undefined, public tokenProviderName: string, public context: Record<string, any>) {
        super(message);
        this.name = "KustoAuthenticationError";
    }
}


export class IngestionPropertiesValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "IngestionPropertiesValidationError";
    }
}
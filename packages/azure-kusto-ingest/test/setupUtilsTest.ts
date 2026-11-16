// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "assert";
import { AxiosError, AxiosHeaders } from "axios";
import { KustoDataErrors } from "azure-kusto-data";
import sinon from "sinon";
import { retryManagementCommand, runSetupTasks } from "./setupUtils.js";

const deferred = () => {
    let resolve!: () => void;
    const promise = new Promise<void>((complete) => {
        resolve = complete;
    });
    return { promise, resolve };
};

const httpError = (status: number) =>
    new AxiosError(`HTTP ${status}`, undefined, undefined, undefined, {
        status,
        statusText: "",
        data: {},
        headers: {},
        config: { headers: new AxiosHeaders() },
    });

describe("runSetupTasks", () => {
    it("bounds parallel setup and initializes every item", async () => {
        const gate = deferred();
        const items = Array.from({ length: 9 }, (_, i) => i);
        const started: number[] = [];
        let active = 0;
        let maxActive = 0;
        const setup = runSetupTasks(items, async (item) => {
            started.push(item);
            active++;
            maxActive = Math.max(maxActive, active);
            await gate.promise;
            active--;
        });

        assert.deepStrictEqual(started, items.slice(0, 4));
        gate.resolve();
        await setup;
        assert.deepStrictEqual(started, items);
        assert.strictEqual(maxActive, 4);
        assert.strictEqual(active, 0);
    });

    it("drains the current batch before rejecting and does not start another batch", async () => {
        const gate = deferred();
        const failure = new Error("Table setup failed");
        const started: number[] = [];
        let settled = false;
        const setup = runSetupTasks([0, 1, 2, 3, 4], (item) => {
            started.push(item);
            if (item === 0) {
                throw failure;
            }
            return gate.promise.then(() => {
                if (item === 1) {
                    throw new Error("Another table setup failed");
                }
            });
        });
        const rejection = assert
            .rejects(setup, (error) => error === failure)
            .then(() => {
                settled = true;
            });

        await new Promise<void>((resolve) => setImmediate(resolve));
        assert.strictEqual(settled, false);
        assert.deepStrictEqual(started, [0, 1, 2, 3]);
        gate.resolve();
        await rejection;
        assert.deepStrictEqual(started, [0, 1, 2, 3]);
    });
});

describe("retryManagementCommand", () => {
    const sandbox = sinon.createSandbox();
    let clock: sinon.SinonFakeTimers;

    beforeEach(() => {
        clock = sandbox.useFakeTimers();
        sandbox.stub(Math, "random").returns(0);
    });

    afterEach(() => {
        sandbox.restore();
    });

    it.each([
        { description: "a connection reset", error: new AxiosError("Connection reset", "ECONNRESET") },
        { description: "throttling", error: new KustoDataErrors.ThrottlingError("Throttled", undefined) },
        { description: "HTTP 503", error: httpError(503) },
        {
            description: "a transient Kusto service error",
            error: new KustoDataErrors.KustoApiError({ code: "ServiceUnavailable", message: "Try again", "@permanent": false }, httpError(503)),
        },
    ])("returns successfully after retrying $description", async ({ error }) => {
        const operation = sinon.stub<[], Promise<string>>();
        operation.onFirstCall().rejects(error);
        operation.onSecondCall().resolves("created");

        const result = retryManagementCommand(operation);
        await clock.runAllAsync();

        assert.strictEqual(await result, "created");
        assert.strictEqual(operation.callCount, 2);
    });

    it("backs off between attempts and preserves the final failure when retries are exhausted", async () => {
        const failure = new AxiosError("Still resetting", "ECONNRESET");
        const operation = sinon.stub<[], Promise<void>>();
        operation.onFirstCall().rejects(new AxiosError("Connection reset", "ECONNRESET"));
        operation.onSecondCall().rejects(new AxiosError("Request timed out", "ETIMEDOUT"));
        operation.onThirdCall().rejects(failure);
        const rejection = assert.rejects(retryManagementCommand(operation), (error) => error === failure);

        await clock.tickAsync(999);
        assert.strictEqual(operation.callCount, 1);
        await clock.tickAsync(1);
        assert.strictEqual(operation.callCount, 2);
        await clock.tickAsync(1999);
        assert.strictEqual(operation.callCount, 2);
        await clock.tickAsync(1);
        await rejection;
        assert.strictEqual(operation.callCount, 3);
    });

    it.each([
        { description: "invalid configuration", error: new Error("Invalid configuration") },
        { description: "HTTP 401", error: httpError(401) },
        { description: "HTTP 403", error: httpError(403) },
        { description: "cancellation", error: new AxiosError("Request canceled", "ERR_CANCELED") },
        {
            description: "a permanent Kusto service error",
            error: new KustoDataErrors.KustoApiError({ code: "PermanentFailure", message: "Invalid command", "@permanent": true }, httpError(503)),
        },
    ])("does not retry $description", async ({ error }) => {
        const operation = sinon.stub<[], Promise<void>>().rejects(error);
        const rejection = assert.rejects(retryManagementCommand(operation), (actual) => actual === error);

        await clock.runAllAsync();
        await rejection;

        assert.strictEqual(operation.callCount, 1);
    });
});

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "assert";
import { jest } from "@jest/globals";

// Simulate a non-Node runtime without `window`, such as a Web Worker.
jest.unstable_mockModule("@azure/core-util", () => ({ isNodeLike: false }));
const { ClientDetails } = await import("../src/clientDetails.js");

const setGlobal = (name: string, value: unknown): (() => void) => {
    const original = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
    return () => {
        if (original) {
            Object.defineProperty(globalThis, name, original);
        } else {
            delete (globalThis as Record<string, unknown>)[name];
        }
    };
};

describe("ClientDetails in a browser runtime without window", () => {
    it("Should not throw when window is undefined", () => {
        assert.strictEqual(typeof window, "undefined");
        const restoreLocation = setGlobal("location", undefined);
        const restoreNavigator = setGlobal("navigator", undefined);
        try {
            const headers = new ClientDetails(null, null).getHeaders();
            assert.strictEqual(headers["x-ms-app"], "[none]");
            assert.strictEqual(headers["x-ms-user"], "[none]");
            assert.strictEqual(headers["x-ms-client-version"]?.endsWith("|Runtime.Browser:{_none_}"), true);
        } finally {
            restoreLocation();
            restoreNavigator();
        }
    });

    it("Should use the worker's location and navigator", () => {
        const restoreLocation = setGlobal("location", { href: "https://example.com/worker.js" });
        const restoreNavigator = setGlobal("navigator", { userAgent: "TestAgent/1.0" });
        try {
            const headers = new ClientDetails(null, null).getHeaders();
            assert.strictEqual(headers["x-ms-app"], "https://example.com/worker.js");
            assert.strictEqual(headers["x-ms-client-version"]?.endsWith("|Runtime.Browser:{TestAgent_1.0}"), true);
        } finally {
            restoreLocation();
            restoreNavigator();
        }
    });
});

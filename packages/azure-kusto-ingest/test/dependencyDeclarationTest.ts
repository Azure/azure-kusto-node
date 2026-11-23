// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "assert";
import path from "path";
import { fileURLToPath } from "url";
import { findUndeclaredDependencies } from "../../../test/dependencyDeclarations.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, "..");

describe("Dependency declarations", () => {
    it("all imported packages should be declared in package.json", () => {
        const missing = Object.entries(findUndeclaredDependencies(pkgRoot)).map(
            ([pkg, files]) => `"${pkg}" imported by ${files.map((f) => path.relative(pkgRoot, f)).join(", ")}`,
        );
        assert.strictEqual(missing.length, 0, `Undeclared dependencies found:\n${missing.join("\n")}`);
    });
});

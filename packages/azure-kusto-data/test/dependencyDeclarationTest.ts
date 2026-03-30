// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "assert";
import depcheck from "depcheck";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, "..");

describe("Dependency declarations", () => {
    it("all imported packages should be declared in package.json", async () => {
        const options: depcheck.Options = {
            ignoreDirs: ["test", "dist-esm", "types", "node_modules"],
            ignorePatterns: ["example*"],
            ignoreMatches: ["@types/*"],
        };
        const result = await depcheck(pkgRoot, options);
        const missing = Object.entries(result.missing).map(
            ([pkg, files]) => `"${pkg}" imported by ${files.map((f) => path.relative(pkgRoot, f)).join(", ")}`,
        );
        assert.strictEqual(missing.length, 0, `Undeclared dependencies found:\n${missing.join("\n")}`);
    });
});

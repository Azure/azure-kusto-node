// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { LoadConfigurationError } from "./resultRowsLoad.js";
import type { Variant } from "./resultRowsLoad.js";

const execFile = promisify(execFileCallback);
export const sdkDirectory = (root: string): string => join(root, "packages", "azure-kusto-data", "dist-esm", "src");
export const hash = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex");
export const display = (value: number | null): string => (value === null ? "n/a" : value.toFixed(2));

export const assertNewOutputs = async (paths: string[]): Promise<void> => {
    for (const path of paths) {
        try {
            await access(path);
        } catch (error: unknown) {
            if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
                continue;
            }
            throw error;
        }
        throw new LoadConfigurationError("An output file already exists; choose a new --output path");
    }
};

export const target = (): { cluster: string; database: string } => {
    const cluster = process.env.ENGINE_CONNECTION_STRING?.trim();
    const database = process.env.TEST_DATABASE?.trim();
    if (!cluster || !database) {
        throw new LoadConfigurationError("Set ENGINE_CONNECTION_STRING and TEST_DATABASE to an approved live test cluster/database");
    }
    let url: URL;
    try {
        url = new URL(cluster);
    } catch (error: unknown) {
        if (!(error instanceof TypeError)) {
            throw error;
        }
        throw new LoadConfigurationError("ENGINE_CONNECTION_STRING must be a credential-free HTTPS cluster URL");
    }
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/" || !/^[a-z0-9.-]+$/i.test(url.hostname)) {
        throw new LoadConfigurationError("ENGINE_CONNECTION_STRING must be a credential-free HTTPS cluster URL, not a connection string");
    }
    return { cluster: url.origin, database };
};

export const identifyAndBuild = async (root: string, variant: Variant) => {
    const build = await execFile(
        process.execPath,
        [join(root, "node_modules", "typescript", "bin", "tsc"), "--build", join(root, "packages", "azure-kusto-data"), "--force"],
        { timeout: 120000, maxBuffer: 8 * 1024 * 1024 },
    ).catch((error: unknown): never => {
        if (typeof error === "object" && error !== null) {
            for (const key of ["stdout", "stderr"]) {
                const output: unknown = Reflect.get(error, key);
                if (typeof output === "string" && output) {
                    process.stderr.write(output);
                }
            }
        }
        throw new LoadConfigurationError(`Building the ${variant} SDK failed; run npm ci in that checkout and fix any compiler errors`);
    });
    if (build.stderr) {
        process.stderr.write(build.stderr);
    }
    const directory = sdkDirectory(root);
    const source = createHash("sha256");
    for (const name of (await readdir(directory)).filter((entry) => /\.(js|json)$/.test(entry)).sort()) {
        source.update(name).update(await readFile(join(directory, name)));
    }
    const revision = await execFile("git", ["-C", root, "rev-parse", "HEAD"]);
    const dirty = await execFile("git", [
        "-C",
        root,
        "status",
        "--porcelain",
        "--untracked-files=normal",
        "--",
        "packages/azure-kusto-data/src",
        "packages/azure-kusto-data/package.json",
        "package-lock.json",
    ]);
    return {
        revision: revision.stdout.trim(),
        sdkSourcesDirty: dirty.stdout.trim().length > 0,
        compiledSdkSha256: source.digest("hex"),
        lockfileSha256: hash(await readFile(join(root, "package-lock.json"))),
    };
};

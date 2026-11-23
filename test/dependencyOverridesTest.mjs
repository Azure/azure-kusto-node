// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const require = createRequire(import.meta.url);
const { findMatchingProjects, getMatchingStringsWithCache } = require("nx/src/utils/find-matching-projects");
/** @type {{ prepare: (directory: string) => Promise<{ content: { readme?: string, bin?: Record<string, string> } }> }} */
const PackageJson = require(require.resolve("@npmcli/package-json"));
/** @type {(options: { cwd: string, pkg: { workspaces: string[] } }) => Promise<Map<string, string>>} */
const mapWorkspaces = require(require.resolve("@npmcli/map-workspaces"));
const { t: listTar } = require("tar");
const execute = promisify(execFile);

test("Nx matches project and file globs with the overridden minimatch", () => {
    /** @type {import("nx/src/config/project-graph").ProjectGraph["nodes"]} */
    const projects = {
        core: { name: "core", type: "lib", data: { root: "packages/core", tags: ["scope:sdk"] } },
        client: { name: "client", type: "lib", data: { root: "packages/client", tags: ["scope:sdk"] } },
        sample: { name: "sample", type: "app", data: { root: "packages/sample", tags: ["scope:sample"] } },
        hidden: { name: "hidden", type: "app", data: { root: "packages/.hidden", tags: ["scope:sample"] } },
    };
    const cases = [
        { patterns: ["name:{core,client}"], expected: ["client", "core"] },
        { patterns: ["directory:packages/**", "!tag:scope:sample"], expected: ["client", "core"] },
        { patterns: ["directory:packages/@(core|client)"], expected: ["client", "core"] },
        { patterns: ["tag:scope:s*"], expected: ["client", "core", "hidden", "sample"] },
        { patterns: ["directory:packages/*"], expected: ["client", "core", "hidden", "sample"] },
    ];
    for (const { patterns, expected } of cases) {
        assert.deepEqual(findMatchingProjects([...patterns], projects).sort(), expected, patterns.join(", "));
    }
    assert.deepEqual(getMatchingStringsWithCache("src/**/*.{ts,tsx}", ["src/index.ts", "src/nested/view.tsx", "src/.hidden.ts", "src/index.js"]), [
        "src/index.ts",
        "src/nested/view.tsx",
        "src/.hidden.ts",
    ]);
});

test("Lerna versions and publishes linked workspaces using the overridden dependencies", { timeout: 120_000 }, async (t) => {
    const fixture = await mkdtemp(path.join(tmpdir(), "kusto-dependency-overrides-"));
    t.after(() => rm(fixture, { recursive: true, force: true }));
    /** @type {Array<{ path: string, body: string }>} */
    const publications = [];
    /** @type {string[]} */
    const unexpectedRequests = [];
    const server = createServer((request, response) => {
        /** @type {Buffer[]} */
        const chunks = [];
        request.on("data", (chunk) => chunks.push(chunk));
        request.on("end", () => {
            const requestPath = request.url ?? "";
            response.setHeader("content-type", "application/json");
            if (request.method === "PUT" && requestPath.startsWith("/kusto-override-fixture-")) {
                publications.push({ path: requestPath, body: Buffer.concat(chunks).toString("utf8") });
                response.writeHead(201).end('{"ok":true}');
            } else if (request.method === "GET" && requestPath.startsWith("/kusto-override-fixture-")) {
                response.writeHead(404).end('{"error":"not found"}');
            } else {
                unexpectedRequests.push(`${request.method} ${requestPath}`);
                response.writeHead(500).end('{"error":"unexpected fixture request"}');
            }
        });
        request.on("error", (error) => {
            unexpectedRequests.push(error.message);
            response.writeHead(500).end('{"error":"fixture request failed"}');
        });
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    t.after(async () => {
        server.closeAllConnections();
        await promisify(server.close.bind(server))();
    });
    const address = server.address();
    assert(address && typeof address !== "string");
    const registry = `http://127.0.0.1:${address.port}/`;
    const manifest = { name: "kusto-override-fixture-root", private: true, workspaces: ["packages/{core,client,sample}"] };
    await writeJson(path.join(fixture, "package.json"), manifest);
    await writeJson(path.join(fixture, "lerna.json"), { version: "1.0.0" });
    await writeFile(path.join(fixture, ".gitignore"), ".nx/\nnode_modules/\n.npmrc\nnpm-user-config\nnpm-global-config\n");
    await writeFile(path.join(fixture, "npm-user-config"), "");
    await writeFile(path.join(fixture, "npm-global-config"), "");
    await writeFile(path.join(fixture, ".npmrc"), `registry=${registry}\n//127.0.0.1:${address.port}/:_authToken=fixture-token\n`);
    for (const name of ["core", "client", "sample"]) {
        const directory = path.join(fixture, "packages", name);
        await mkdir(path.join(directory, "dist"), { recursive: true });
        await writeFile(path.join(directory, "dist", "index.js"), `module.exports = "${name}";\n`);
        await writeFile(path.join(directory, "README.md"), `# Fixture ${name}\n`);
        await writeJson(path.join(directory, "package.json"), {
            name: `kusto-override-fixture-${name}`,
            version: "1.0.0",
            license: "MIT",
            private: name === "sample",
            files: ["dist", "bin"],
            directories: name === "core" ? { bin: "bin" } : undefined,
            dependencies: name === "core" ? undefined : { "kusto-override-fixture-core": "^1.0.0" },
            publishConfig: { registry, provenance: false },
        });
    }
    /** @type {Record<string, object>} */
    const lockPackages = { "": manifest };
    for (const name of ["core", "client", "sample"]) {
        const workspace = await readJson(path.join(fixture, "packages", name, "package.json"));
        lockPackages[`packages/${name}`] = {
            name: workspace.name,
            version: workspace.version,
            dependencies: workspace.dependencies,
        };
        lockPackages[`node_modules/${workspace.name}`] = { resolved: `packages/${name}`, link: true };
    }
    await writeJson(path.join(fixture, "package-lock.json"), { name: manifest.name, lockfileVersion: 3, requires: true, packages: lockPackages });
    const core = path.join(fixture, "packages", "core");
    await mkdir(path.join(core, "bin"));
    await writeFile(path.join(core, "bin", "fixture.js"), "#!/usr/bin/env node\n");
    const prepared = await PackageJson.prepare(core);
    assert.equal(prepared.content.readme, "# Fixture core\n");
    assert.deepEqual(prepared.content.bin, { "fixture.js": "bin/fixture.js" });
    assert.deepEqual([...(await mapWorkspaces({ cwd: fixture, pkg: manifest }))].map(([name]) => name).sort(), [
        "kusto-override-fixture-client",
        "kusto-override-fixture-core",
        "kusto-override-fixture-sample",
    ]);

    // Do not inherit npm credentials or configuration from the developer or CI runner.
    const env = {
        ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^npm_/i.test(key))),
        NPM_CONFIG_USERCONFIG: path.join(fixture, "npm-user-config"),
        NPM_CONFIG_GLOBALCONFIG: path.join(fixture, "npm-global-config"),
        NPM_CONFIG_REGISTRY: registry,
        NPM_CONFIG_AUDIT: "false",
        NPM_CONFIG_FUND: "false",
        NPM_CONFIG_UPDATE_NOTIFIER: "false",
        NX_DAEMON: "false",
        NX_TUI: "false",
    };
    /** @param {string} command @param {string[]} args */
    const run = (command, args) => execute(command, args, { cwd: fixture, env, timeout: 60_000, maxBuffer: 2 * 1024 * 1024 });
    const commit = async () => {
        await run("git", ["add", "."]);
        await run("git", [
            "-c",
            "user.name=Dependency override fixture",
            "-c",
            "user.email=fixture@example.invalid",
            "-c",
            "commit.gpgSign=false",
            "-c",
            `core.hooksPath=${fixture}`,
            "commit",
            "-m",
            "Update fixture",
        ]);
    };
    await run("git", ["init", "--initial-branch=fixture"]);
    await commit();
    const lerna = require.resolve("lerna/cli");
    await run(process.execPath, [lerna, "version", "1.0.1", "--force-publish", "--no-git-tag-version", "--no-push", "--yes", "--ignore-scripts"]);
    assert.equal((await readJson(path.join(fixture, "lerna.json"))).version, "1.0.1");
    const updatedLock = await readJson(path.join(fixture, "package-lock.json"));
    for (const name of ["core", "client", "sample"]) {
        const updated = await readJson(path.join(fixture, "packages", name, "package.json"));
        assert.equal(updated.version, "1.0.1");
        assert.equal(updatedLock.packages[`packages/${name}`].version, "1.0.1");
        if (name !== "core") {
            assert.equal(updated.dependencies["kusto-override-fixture-core"], "^1.0.1");
            assert.equal(updatedLock.packages[`packages/${name}`].dependencies["kusto-override-fixture-core"], "^1.0.1");
        }
    }
    await commit();
    await run(process.execPath, [lerna, "publish", "from-package", "--registry", registry, "--ignore-scripts", "--no-git-reset", "--yes"]);
    assert.deepEqual(unexpectedRequests, []);
    assert.deepEqual(publications.map(({ path: requestPath }) => requestPath).sort(), ["/kusto-override-fixture-client", "/kusto-override-fixture-core"]);
    for (const publication of publications) {
        const payload = JSON.parse(publication.body);
        const published = payload.versions["1.0.1"];
        assert.equal(published.name, publication.path.slice(1));
        assert.equal(published.version, "1.0.1");
        assert.equal(payload["dist-tags"].latest, "1.0.1");
        const attachments = Object.values(payload._attachments);
        assert.equal(attachments.length, 1);
        const files = await readTar(Buffer.from(attachments[0].data, "base64"));
        assert(files.has("package/README.md"));
        assert(files.has("package/dist/index.js"));
        const packedManifest = files.get("package/package.json");
        assert(packedManifest);
        const packed = JSON.parse(packedManifest);
        assert.equal(packed.name, published.name);
        assert.equal(packed.version, "1.0.1");
        if (packed.name.endsWith("-client")) {
            assert.equal(published.dependencies["kusto-override-fixture-core"], "^1.0.1");
            assert.equal(packed.dependencies["kusto-override-fixture-core"], "^1.0.1");
        } else {
            assert(files.has("package/bin/fixture.js"));
        }
    }
});

/** @param {string} filename @param {object} data */
async function writeJson(filename, data) {
    await writeFile(filename, `${JSON.stringify(data, null, 2)}\n`);
}

/** @param {string} filename */
async function readJson(filename) {
    return JSON.parse(await readFile(filename, "utf8"));
}

/** @param {Buffer} archive */
async function readTar(archive) {
    /** @type {Map<string, string>} */
    const files = new Map();
    const parser = listTar({
        onReadEntry(entry) {
            /** @type {Buffer[]} */
            const chunks = [];
            entry.on("data", (chunk) => chunks.push(chunk));
            entry.on("end", () => files.set(entry.path, Buffer.concat(chunks).toString("utf8")));
        },
    });
    const complete = once(parser, "end");
    parser.end(archive);
    await complete;
    return files;
}

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [7.0.0-alpha.4] - 2025-01-23

### Fixed

-   Fixed error when doing streaming ingestion with a blob url
-   Updated azure storage deps

## [7.0.0-alpha.3] - 2024-09-29

### Fixed

-   Don't include json files in the package

## [7.0.0-alpha.2] - 2024-09-22

### Fixed

-   Added default export for the SDK

## [7.0.0-alpha.1] - 2024-09-22

### Fixed

-   Added azure/core-utils as an official dependency
-   Added "main" field back to package.json

## [7.0.0-alpha.0] - 2024-09-16

### Changed

-   Changed type of projects to be "module" to support EcmaScript modules. It shouldn't affect the usage of the SDK, if it does please open an issue.
-   Types are now properly exported using "export type"
-   CloudInfo is now exported

### Fixed

-   Server timeout was with accuracy of tenth of a second.
-   Updated default endpoint urls

### Security

-   Updated dependencies to fix security vulnerabilities

## [6.0.2] - 2024-04-11

### Changed

-   Take `process.argv[1]` as an app identifier instead of `process.title`
-   More strict header escaping, limit the length to 100 characters per field

## [6.0.1] - 2024-04-07

### Fixed

-   Version number fix

## [6.0.0] - 2024-04-07

### Changed

-   [BREAKING] - Minimal node version is now 18
-   [BREAKING] - The default converters for DateTime and TimeSpan will now return null if the value is null or an empty string. This is to align with the behavior of the service.
-   [BREAKING] - IngestClient returns `Promise<IngestionResult>` instead of `Promise<QueueSendMessageResponse>`
-   Added condition on file extension for binary file compression

### Added

-   Support table status reporting like explained here https://learn.microsoft.com/en-us/azure/data-explorer/kusto/api/netfx/kusto-ingest-client-status
-   When working with storage resources, use success/failure statistics and retry mechanism to improve ingestion stability

### Fixed

-   process.env can be undefined
-   Headers are now escaped better

## [5.2.3] - 2023-11-07

### Fixed

-   Bump @azure/identity to 3.3.2
-   Fix nx on CI build

## [5.2.2] - 2023-10-30

### Added

-   Support new playfab domain

### Fixed

-   Fix browser support for proxy clusters (with no metadata)

## [5.2.1] - 2023-08-22

### Fixed

-   Avoid node headers in browser (Accept-Encoding, Connection)
-   Remove dependency on crypto browserify

### Added

-   sample app for browser auth and run from react vite
-   Export from index.ts more classes that are exposed to user

## [5.2.0] - 2023-07-18

### Added

-   Streaming from blob url is now supported (in ManagedStreamingIngest too)

### Fixed

-   Some internal types exposed as they are retuned to the user.
-   Remove streamify from browser flow
-   Default tenant of user prompt was nullified if options were given

## [5.1.0] - 2023-06-13

### Added

-   Streaming from blob url is now supported (in ManagedStreamingIngest too)

### Fixed

-   More robust handling of errors in queued ingestion (resource manager improvements)
-   Fixed exports using the wrong types

## [5.0.4] - 2023-05-09

### Fixed

-   `IgnoreFirstRecord` ingestion option is now supported
-   Edge case in getting the username on azure functions environments is now handled by @Apokalypt

## [5.0.3] - 2023-04-30

### Added

-   ConnectionStringBuilder now accepts certificate path
-   ConnectionStringBuilder now accepts a TokenCredential

### Fixed

-   Fixed parsing of certain commands

## [5.0.2] - 2023-04-18

### Fixed

-   Remove authorization header from errors
-   Escape non-ascii headers to align with the service

### Added

-   Internal devops improvements

## [5.0.1] - 2023-02-23

### Fixed

-   Fixed issue with metadata endpoint in browsers by @sagivf

## [5.0.0] - 2023-02-14

### Changed

-   [BREAKING] - the minimal version for NodeJS is now 16
-   [BREAKING] - removed moment.js from project and fixed timespan parsing:
    -   By default, Timespan will now be parsed into a number of milliseconds by default, matching Date substraction
    -   By default, Datetime fields will now be parsed into a native Date object
    -   To change the default, use KustoResultTable.timeSpanParser and KustoResultTable.dateTimeParser
-   Browser compatible package
-   The SDK now supports being run in a browser
-   See README.md for details
-   Added Security.MD
-   Overall bugs fixes
-   Use azure identity instead of Msal for authentication

### Removed

-   moment.js

## [4.0.5] - 2022-01-18

### Changed

-   Upgrade MSAL dependency
-   Fix lockfile error

## [4.0.4] - 2022-01-15

### Fixed

-   Fix vulnerability - jsonwebtoken (again)

## [4.0.3] - 2021-12-29

### Fixed

-   Fix vulnerability - jsonwebtoken

## [4.0.2] - 2021-12-15

### Changed

-   Add trident endpoint by @AsafMah in #227

## [4.0.1] - 2021-11-28

### Fixed

-   Fixed #221 - include missing file

## [4.0.0] - 2021-11-23

### Changed

-   [Breaking] Trusted endpoints - by default kusto will only connect to trusted endpoints
-   Closeable clients, you can now free resources when you are done with a client
-   Added Ignorefirstrecord ingestion property
-   Quick start improvements
-   Bump parse-url from 7.0.2 to 8.1.0

## [3.4.2] - 2022-08-25

### Fixed

-   Fixed bug with using the moment library that caused ingestion resources not to refresh.

## [3.4.1] - 2022-08-21

### Fixed

-   Version 3.4.0 introduced a bug that caused the wrong client id to be sent in Managed Identity scenarios. This version fixes it, and the old version is
    deprecated.

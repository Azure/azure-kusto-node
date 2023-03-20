# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [5.0.2] - 2023-03-20

### Added

- Better support for browser packaging
- Generating independent browser js files

## [5.0.1] - 2023-02-23

### Fixed

- Fixed issue with metadata endpoint in browsers by @sagivf

## [5.0.0] - 2023-02-14

### Changed

- [BREAKING] - removed moment.js from project and fixed timespan parsing:
    - By default, Timespan will now be parsed into a number of milliseconds by default, matching Date substraction
    - By default, Datetime fields will now be parsed into a native Date object
    - To change the default, use KustoResultTable.timeSpanParser and KustoResultTable.dateTimeParser
- Browser compatible package
- The SDK now supports being run in a browser
- See README.md for details
- Added Security.MD
- Minor fixes

### Removed

- moment.js

## [4.0.5] - 2022-01-18

### Changed

- Upgrade MSAL dependency
- Fix lockfile error

## [4.0.4] - 2022-01-15

### Fixed

- Fix vulnerability - jsonwebtoken (again)

## [4.0.3] - 2021-12-29

### Fixed

- Fix vulnerability - jsonwebtoken

## [4.0.2] - 2021-12-15

### Changed

- Add trident endpoint by @AsafMah in #227

## [4.0.1] - 2021-11-28

### Fixed

- Fixed #221 - include missing file

## [4.0.0] - 2021-11-23

### Changed

- [Breaking] Trusted endpoints - by default kusto will only connect to trusted endpoints
- Closeable clients, you can now free resources when you are done with a client
- Added Ignorefirstrecord ingestion property
- Quick start improvements
- Bump parse-url from 7.0.2 to 8.1.0

## [3.4.2] - 2022-08-25

### Fixed

- Fixed bug with using the moment library that caused ingestion resources not to refresh.

## [3.4.1] - 2022-08-21

### Fixed

- Version 3.4.0 introduced a bug that caused the wrong client id to be sent in Managed Identity scenarios. This version fixes it, and the old version is
  deprecated.

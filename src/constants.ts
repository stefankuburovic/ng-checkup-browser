/**
 * The newest Angular major this release knows. A test keeps it equal to the
 * CLI's BUNDLED_LATEST_ANGULAR_MAJOR, so both say "N majors behind" alike.
 * Updated with each Angular major, like the CLI (docs/new-angular-major.md).
 */
export const LATEST_ANGULAR_MAJOR = 22;

/** Initial JavaScript above this is a finding: the `maximumError` budget a new Angular CLI project starts with (1 MB). */
export const INITIAL_JS_BUDGET = 1_000_000;

declare const __VERSION__: string;
/** The extension's version, from package.json at build time. */
export const VERSION: string = typeof __VERSION__ === 'string' ? __VERSION__ : '0.0.0';

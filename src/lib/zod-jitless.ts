/**
 * Zod 4 probes `new Function("")` the first time a schema is built, to see if
 * it may compile a parser. The call is caught, but a strict script-src still
 * reports it as eval. `jitless` skips that probe. Set the flag before zod loads.
 */
const scope = globalThis as typeof globalThis & { __zod_globalConfig?: { jitless?: boolean } };
scope.__zod_globalConfig = { ...scope.__zod_globalConfig, jitless: true };

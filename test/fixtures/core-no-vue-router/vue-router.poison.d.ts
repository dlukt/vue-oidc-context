/**
 * Poison target for the tsconfig `paths` mapping of "vue-router": an empty
 * module. If the core entry's declarations reference anything from vue-router,
 * the import resolves here, finds no exported member, and the fixture compile
 * fails — exactly the regression this fixture guards against (SPEC §3).
 */
export {};

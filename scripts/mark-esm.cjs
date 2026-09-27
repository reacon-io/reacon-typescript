// Copyright Reacon contributors. Licensed under Apache-2.0.
// The ESM output needs its own package boundary while the root remains CommonJS.
require('node:fs').writeFileSync(require('node:path').join(__dirname, '../dist/esm/package.json'), '{"type":"module"}\n');

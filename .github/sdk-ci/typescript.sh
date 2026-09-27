set -eu
npm install --ignore-scripts --no-audit --no-fund --cache /cache/npm
npm run build
node /suite/node-package.mjs
mkdir /cache/retained-npm
cp /results/artifacts/*.tgz /cache/retained-npm/
REACON_REUSE_ARTIFACTS=/cache/retained-npm REACON_TEST_URL="$REACON_RECORDINGS_URL/typescript-esm" REACON_RESULTS_FILE=/results/typescript-esm.json node /suite/node-package.mjs --esm

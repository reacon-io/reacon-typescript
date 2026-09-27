set -eu
test ! -e /work
node /ci/stream-node-package.mjs

#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
NODE=$(command -v node || true)
if [ -n "$NODE" ] && "$NODE" -e 'process.exit(Number(process.versions.node.split(".")[0])>=22?0:1)' 2>/dev/null; then
    exec "$NODE" "$ROOT/scripts/quickstart.mjs" "$@"
fi
VERSION=22.23.4
case "$(uname -s):$(uname -m)" in
    Darwin:arm64) PLATFORM=darwin-arm64; SHA=c9e1dbc748b33ed2d14f42445191ecaf14c56259c7a9a26d0042c49ec2b66428 ;;
    Darwin:x86_64) PLATFORM=darwin-x64; SHA=efcc2b0db6f94bf53eddb038fe2b370277a042bd29e4f19b8f8e23598795b819 ;;
    Linux:aarch64|Linux:arm64) PLATFORM=linux-arm64; SHA=f7a1e486dbc8b286847815b477d4fb5e9fb963ed4489c3e1588853d685f589f9 ;;
    Linux:x86_64) PLATFORM=linux-x64; SHA=b8492284c76a54baf58d61668dd0e41ee0fc98adabf9503d30f05d08f55b4406 ;;
    *) echo 'Install Node.js 22+ from https://nodejs.org/download, then run npm run quickstart.'; exit 1 ;;
esac
FOLDER="$ROOT/runtime/bootstrap/node-v$VERSION-$PLATFORM"
NODE="$FOLDER/bin/node"
if [ ! -x "$NODE" ]; then
    case " $* " in *' --stop '*) echo 'No private runtime exists. Nothing was downloaded or stopped.'; exit 1 ;; esac
    echo 'Preparing Frameforge with a verified private Node runtime. No sudo or system installation.'
    mkdir -p "$ROOT/runtime/bootstrap"
    ARCHIVE="$ROOT/runtime/bootstrap/node-v$VERSION-$PLATFORM.tar.gz"
    if [ ! -f "$ARCHIVE" ]; then
        curl --fail --location --proto '=https' --tlsv1.2 --retry 2 "https://nodejs.org/dist/v$VERSION/node-v$VERSION-$PLATFORM.tar.gz" -o "$ARCHIVE.part"
        FILE="$ARCHIVE.part"
    else FILE="$ARCHIVE"; fi
    if command -v sha256sum >/dev/null 2>&1; then ACTUAL=$(sha256sum "$FILE" | cut -d ' ' -f 1); else ACTUAL=$(shasum -a 256 "$FILE" | cut -d ' ' -f 1); fi
    if [ "$ACTUAL" != "$SHA" ]; then echo 'Runtime checksum did not match. No downloaded program was executed.'; exit 1; fi
    if [ "$FILE" != "$ARCHIVE" ]; then mv "$FILE" "$ARCHIVE"; fi
    STAGE=$(mktemp -d "$ROOT/runtime/bootstrap/unpack-XXXXXXXX")
    tar -xzf "$ARCHIVE" -C "$STAGE"
    if [ -e "$FOLDER" ]; then echo 'Runtime folder exists but is incomplete. Inspect it before retrying.'; exit 1; fi
    mv "$STAGE/node-v$VERSION-$PLATFORM" "$FOLDER"
fi
exec "$NODE" "$ROOT/scripts/quickstart.mjs" "$@"

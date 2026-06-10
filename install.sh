#!/usr/bin/env bash
# zefleet installer — downloads the standalone binary (Bun runtime embedded,
# no dependencies). macOS only for now; elsewhere, Bun + bunx is the route.
#
#   curl -fsSL https://raw.githubusercontent.com/0xMoaz/zefleet/main/install.sh | bash
set -euo pipefail

REPO="0xMoaz/zefleet"
INSTALL_DIR="${ZEFLEET_INSTALL_DIR:-$HOME/.zefleet/bin}"

case "$(uname -s)" in
  Darwin) os="darwin" ;;
  *)
    echo "zefleet binaries currently ship for macOS only."
    echo "On other platforms, install Bun (https://bun.sh) and run:  bunx zefleet"
    exit 1
    ;;
esac

case "$(uname -m)" in
  arm64 | aarch64) arch="arm64" ;;
  x86_64) arch="x64" ;;
  *)
    echo "unsupported architecture: $(uname -m)"
    exit 1
    ;;
esac

asset="zefleet-${os}-${arch}.zip"
url="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | grep -o "https://[^\"]*${asset}" | head -1 || true)"

if [ -z "${url}" ]; then
  echo "no published release found for ${asset} yet."
  echo "Bun route in the meantime:  curl -fsSL https://bun.sh/install | bash  &&  bunx zefleet"
  exit 1
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "↓ ${asset}"
curl -fsSL "$url" -o "$tmp/$asset"
mkdir -p "$INSTALL_DIR"
unzip -oq "$tmp/$asset" -d "$INSTALL_DIR"
chmod +x "$INSTALL_DIR/zefleet"

echo "✓ installed  $INSTALL_DIR/zefleet  ($("$INSTALL_DIR/zefleet" --version))"

case ":$PATH:" in
  *":$INSTALL_DIR:"*) ;;
  *)
    echo
    echo "add it to your PATH:"
    echo "  export PATH=\"$INSTALL_DIR:\$PATH\""
    ;;
esac

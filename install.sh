#!/usr/bin/env bash
# zadar installer — downloads the standalone binary (Bun runtime embedded,
# no dependencies). macOS only for now; elsewhere, Bun + bunx is the route.
#
#   curl -fsSL https://raw.githubusercontent.com/0xMoaz/zadar/main/install.sh | bash
set -euo pipefail

REPO="0xMoaz/zadar"
INSTALL_DIR="${ZADAR_INSTALL_DIR:-$HOME/.zadar/bin}"

case "$(uname -s)" in
  Darwin) os="darwin" ;;
  *)
    echo "zadar binaries currently ship for macOS only."
    echo "On other platforms, install Bun (https://bun.sh) and run:  bunx zadar"
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

asset="zadar-${os}-${arch}.zip"
url="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | grep -o "https://[^\"]*${asset}" | head -1 || true)"

if [ -z "${url}" ]; then
  echo "no published release found for ${asset} yet."
  echo "Bun route in the meantime:  curl -fsSL https://bun.sh/install | bash  &&  bunx zadar"
  exit 1
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "↓ ${asset}"
curl -fsSL "$url" -o "$tmp/$asset"
mkdir -p "$INSTALL_DIR"
unzip -oq "$tmp/$asset" -d "$INSTALL_DIR"
chmod +x "$INSTALL_DIR/zadar"

echo "✓ installed  $INSTALL_DIR/zadar  ($("$INSTALL_DIR/zadar" --version))"

case ":$PATH:" in
  *":$INSTALL_DIR:"*)
    echo "→ run it:  zadar"
    ;;
  *)
    line="export PATH=\"$INSTALL_DIR:\$PATH\""
    rc=""
    case "${SHELL:-}" in
      */zsh) rc="$HOME/.zshrc" ;;
      */bash) rc="$HOME/.bashrc" ;;
    esac
    if [ -n "$rc" ] && ! grep -qsF "$line" "$rc"; then
      printf '\n# zadar\n%s\n' "$line" >>"$rc"
      echo "✓ PATH updated in ${rc/#"$HOME"/\~}"
      echo
      echo "→ open a new terminal (or: source ${rc/#"$HOME"/\~}) and run:  zadar"
    else
      echo
      echo "add it to your PATH, then run \`zadar\`:"
      echo "  $line"
    fi
    ;;
esac

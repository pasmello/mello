#!/usr/bin/env sh
# mello CLI installer — served from https://get.pasmello.com/install.sh
#
# Usage:
#   curl -fsSL https://get.pasmello.com | sh
#   MELLO_VERSION=v0.1.0 curl -fsSL https://get.pasmello.com | sh
#   MELLO_INSTALL_DIR=~/bin curl -fsSL https://get.pasmello.com | sh
#
# Binaries are pulled from GitHub Releases and verified against manifest.sha256.

set -eu

REPO="pasmello/mello"
INSTALL_DIR="${MELLO_INSTALL_DIR:-$HOME/.local/bin}"
REQUESTED_VERSION="${MELLO_VERSION:-latest}"

have() { command -v "$1" >/dev/null 2>&1; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

if ! have curl; then die "curl is required"; fi
if ! have tar && ! have unzip; then die "tar or unzip is required"; fi

os="$(uname -s | tr '[:upper:]' '[:lower:]')"
arch="$(uname -m)"
case "$arch" in
  x86_64|amd64) arch="x64" ;;
  aarch64|arm64) arch="arm64" ;;
  *) die "unsupported arch: $arch" ;;
esac

case "$os" in
  linux)  asset="mello-linux-${arch}.tar.gz"; archive=tar ;;
  darwin) asset="mello-darwin-${arch}.tar.gz"; archive=tar ;;
  msys*|mingw*|cygwin*) asset="mello-windows-x64.zip"; archive=zip ;;
  *) die "unsupported os: $os" ;;
esac

if [ "$REQUESTED_VERSION" = "latest" ]; then
  base="https://github.com/${REPO}/releases/latest/download"
else
  base="https://github.com/${REPO}/releases/download/${REQUESTED_VERSION}"
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

printf 'Downloading %s…\n' "$asset"
curl -fSL --progress-bar -o "$tmp/$asset" "$base/$asset"
curl -fSL -o "$tmp/manifest.sha256" "$base/manifest.sha256"

printf 'Verifying sha256…\n'
expected=$(grep " $asset\$" "$tmp/manifest.sha256" | awk '{print $1}')
if [ -z "${expected:-}" ]; then die "no sha256 entry for $asset in manifest.sha256"; fi

actual=$(
  if have sha256sum; then sha256sum "$tmp/$asset" | awk '{print $1}';
  elif have shasum; then shasum -a 256 "$tmp/$asset" | awk '{print $1}';
  else die "no sha256 tool"
  fi
)
[ "$expected" = "$actual" ] || die "sha256 mismatch (expected $expected, got $actual)"

mkdir -p "$INSTALL_DIR"
case "$archive" in
  tar) tar -xzf "$tmp/$asset" -C "$tmp" ;;
  zip) unzip -q "$tmp/$asset" -d "$tmp" ;;
esac

bin_src="$tmp/mello"
[ -f "$bin_src" ] || bin_src="$tmp/mello.exe"
[ -f "$bin_src" ] || die "binary not found inside archive"

install_path="$INSTALL_DIR/$(basename "$bin_src")"
cp "$bin_src" "$install_path"
chmod +x "$install_path"

printf '\nInstalled %s\n' "$install_path"
case ":$PATH:" in
  *":$INSTALL_DIR:"*) ;;
  *) printf '\nAdd %s to your PATH. For example:\n  echo "export PATH=\\"%s:\\$PATH\\"" >> ~/.bashrc\n' "$INSTALL_DIR" "$INSTALL_DIR" ;;
esac

printf '\nNext:\n  mello login\n  mello init tool\n  mello publish\n'

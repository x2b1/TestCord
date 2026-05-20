#!/bin/bash

set -e -o pipefail

outfile="$(mktemp)"
outdir="$(mktemp -d)"
trap 'rm -rf "$outfile" "$outdir"' EXIT

url="$(npm view electron dist.tarball)"

curl -sSL --fail "$url" -o "$outfile"

tar -xf "$outfile" -C "$outdir"

oldVersion="$(jq .version package.json)"
version="$(jq .version "$outdir/package/package.json")"

if [[ "$oldVersion" = "$version" ]]; then
	echo "Already up to date!"
	exit
fi

cp "$outdir/package/electron.d.ts" . 

jq ".version = $version" package.json > package.json.new
mv package.json.new package.json

echo "Updated $oldVersion -> $version"

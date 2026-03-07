{ pkgs ? import <nixpkgs> {} }:
pkgs.mkShell {
  packages = with pkgs; [
    nodejs_22
    jq
    curl
    wrangler
    sqlite
  ];

  shellHook = ''
    export PATH="$PWD/frontend/node_modules/.bin:$PATH"
    echo "Teenarazzi dev shell ready."
    echo "Run: cd frontend && npm ci"
    echo "Then: npx wrangler dev --config ../backend/wrangler.toml --local --port 8787"
  '';
}

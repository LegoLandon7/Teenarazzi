{
  description = "Teenarazzi dev shell with frontend dependencies managed by node2nix";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
        frontendPkg = pkgs.callPackage ./frontend/nix/default.nix { };
        frontendNodeDeps = frontendPkg.nodeDependencies.overrideAttrs (_: {
          NODE2NIX_SKIP_REBUILD = "1";
        });
        frontendTestPkg = pkgs.callPackage ./frontend/nix/testing/default.nix { };
        frontendTestNodeDeps = frontendTestPkg.nodeDependencies.overrideAttrs (_: {
          dontCheckForBrokenSymlinks = true;
          NODE2NIX_SKIP_REBUILD = "1";
        });
        backendPkg = pkgs.callPackage ./backend/nix/default.nix { };
        backendNodeDeps = backendPkg.nodeDependencies.overrideAttrs (_: {
          dontCheckForBrokenSymlinks = true;
          NODE2NIX_SKIP_REBUILD = "1";
        });
        frontendNodeModules = "${frontendNodeDeps}/lib/node_modules";
        frontendTestNodeModules = "${frontendTestNodeDeps}/lib/node_modules";
        backendNodeModules = "${backendNodeDeps}/lib/node_modules";
      in
      {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs
            jq
            curl
            wrangler
            sqlite
            frontendNodeDeps
            frontendTestNodeDeps
            backendNodeDeps
          ];

          shellHook = ''
            export FRONTEND_NODE_MODULES="${frontendNodeModules}"
            export FRONTEND_TEST_NODE_MODULES="${frontendTestNodeModules}"
            export BACKEND_NODE_MODULES="${backendNodeModules}"
            export FRONTEND_NODE_BIN="${frontendNodeDeps}/bin"
            export FRONTEND_TEST_NODE_BIN="${frontendTestNodeDeps}/bin"
            export BACKEND_NODE_BIN="${backendNodeDeps}/bin"
            export PATH="$PATH:$PWD/frontend/node_modules/.bin"
            export PATH="$PATH:$PWD/backend/node_modules/.bin"
            export PATH="$PATH:$FRONTEND_NODE_BIN:$FRONTEND_TEST_NODE_BIN:$BACKEND_NODE_BIN"
            export NODE_PATH="$PWD/frontend/node_modules:$PWD/backend/node_modules''${NODE_PATH:+:$NODE_PATH}"

            link_modules() {
              local target="$1"
              shift
              local src
              local name
              local dst
              local current_target

              if [ -L "$target" ]; then
                rm -f "$target"
              elif [ -e "$target" ]; then
                rm -rf "$target"
              fi
              mkdir -p "$target"

              for modules_dir in "$@"; do
                [ -d "$modules_dir" ] || continue
                for src in "$modules_dir"/* "$modules_dir"/.*; do
                  name="$(basename "$src")"
                  if [ "$name" = "." ] || [ "$name" = ".." ]; then
                    continue
                  fi

                  dst="$target/$name"
                  if [ -L "$dst" ]; then
                    current_target="$(readlink "$dst")"
                    if [ "$current_target" = "$src" ]; then
                      continue
                    fi
                    rm -f "$dst"
                  elif [ -e "$dst" ]; then
                    continue
                  fi

                  ln -s "$src" "$dst"
                done
              done
            }

            # Keep generated node2nix output stable and layer optional/custom deps here.
            link_modules "$PWD/frontend/node_modules" \
              "$FRONTEND_TEST_NODE_MODULES" \
              "$FRONTEND_NODE_MODULES"

            link_modules "$PWD/backend/node_modules" \
              "$BACKEND_NODE_MODULES"

            if [ -e "$PWD/node_modules" ] && [ ! -L "$PWD/node_modules" ]; then
              rm -rf "$PWD/node_modules"
            fi
            ln -sfn "$PWD/frontend/node_modules" "$PWD/node_modules"

            echo "Teenarazzi flake shell ready."
            echo "Backend: wrangler dev --config backend/wrangler.toml --local --port 8787"
            echo "Frontend: npm --prefix frontend run dev"
          '';
        };
      });
}

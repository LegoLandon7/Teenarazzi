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
        frontendNodeModules = "${frontendPkg.nodeDependencies}/lib/node_modules";
      in
      {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs
            jq
            curl
            wrangler
            sqlite
            frontendPkg.nodeDependencies
          ];

          shellHook = ''
            export FRONTEND_NODE_MODULES="${frontendNodeModules}"
            export PATH="$PATH:$PWD/frontend/node_modules/.bin"

            if [ -L "$PWD/frontend/node_modules" ]; then
              rm -f "$PWD/frontend/node_modules"
            fi
            mkdir -p "$PWD/frontend/node_modules"

            for src in "$FRONTEND_NODE_MODULES"/* "$FRONTEND_NODE_MODULES"/.*; do
              name="$(basename "$src")"
              if [ "$name" = "." ] || [ "$name" = ".." ]; then
                continue
              fi

              dst="$PWD/frontend/node_modules/$name"
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

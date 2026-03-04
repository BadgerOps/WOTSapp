{
  description = "WOTS App development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_22
          ];

          shellHook = ''
            export PATH="$PWD/node_modules/.bin:$PATH"

            echo "Node.js $(node --version)"
            echo "npm $(npm --version)"

            # Git prompt function
            __git_prompt() {
              local branch=$(git symbolic-ref --short HEAD 2>/dev/null)
              if [ -n "$branch" ]; then
                local status=""
                if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
                  status="*"
                fi
                if [ -n "$(git ls-files --others --exclude-standard 2>/dev/null)" ]; then
                  status="$status?"
                fi
                echo " ($branch$status)"
              fi
            }

            export PS1='\[\033[1;34m\]\w\[\033[0;33m\]$(__git_prompt)\[\033[0m\] $ '
          '';
        };
      }
    );
}

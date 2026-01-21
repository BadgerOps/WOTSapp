{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    nodejs_22
  ];

  shellHook = ''
    export PATH="$PWD/node_modules/.bin:$PATH"
    echo "Node.js $(node --version)"
    echo "npm $(npm --version)"
  '';
}

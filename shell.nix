{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    nodejs_22
    ffmpeg
  ];

  shellHook = ''
    export PATH="$PWD/node_modules/.bin:$PATH"

    # Initialize nvm if using it
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

    echo "Node.js $(node --version)"
    echo "npm $(npm --version)"
    echo "nvm available - use 'nvm use <version>' to switch Node versions"

    # Git prompt function
    __git_prompt() {
      local branch=$(git symbolic-ref --short HEAD 2>/dev/null)
      if [ -n "$branch" ]; then
        local status=""
        # Check for uncommitted changes
        if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
          status="*"
        fi
        # Check for untracked files
        if [ -n "$(git ls-files --others --exclude-standard 2>/dev/null)" ]; then
          status="$status?"
        fi
        echo " ($branch$status)"
      fi
    }

    export PS1='\[\033[1;34m\]\w\[\033[0;33m\]$(__git_prompt)\[\033[0m\] $ '
  '';
}

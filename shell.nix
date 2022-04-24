with (import (fetchTarball https://github.com/NixOS/nixpkgs/archive/refs/tags/21.11.tar.gz) {});

let session = writeText "session.tmuxp.yaml" ''
  session_name: nextool
  windows:
    - layout: even-vertical
      panes:
        - npm run watch
        - npm run watch-tests
        - rg -F '## Development' -A 999 README.md
''; in

# We need to use FHS, since Selenium otherwise doesn't work if the host system
# already has a Chromium installed.

(buildFHSUserEnv {
  name = "fhs";
  targetPkgs = pkgs: with pkgs; [
    # Web and Electron
    nodejs
    zlib

    # Screenshot
    chromium
    chromedriver
    ruby
    bundler

    # Utilities
    nomacs
    tmux tmuxp
    git
    ripgrep
    which

    (runCommand "tmuxp-session" { session = session; } ''
      #!/usr/bin/env bash
      mkdir -p $out/opt/nextool
      cp $session $out/opt/nextool/session.tmuxp.yaml
    '')

    # Copy font configuration from host system, otherwise screenshots will look
    # bad. I don't know how to fix Nix' own font rendering.
    (runCommand "fonts-config" { fonts = /etc/fonts; fontconfig = /usr/share/fontconfig; } ''
      #!/usr/bin/env bash
      mkdir -p $out/etc/fonts
      mkdir -p $out/share
      cp -r $fontconfig $out/share/fontconfig
      cp -r $fonts/* $out/etc/fonts
    '')
  ];
  runScript = ''
    #!/usr/bin/env bash
    npm ci
    bundle install
    tmuxp load /opt/nextool/session.tmuxp.yaml
  '';
}).env


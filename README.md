# Nextool

I'm working on this GTD-oriented task manager with support for nested tasks and
a focus on helping the user make tasks actionable and surfacing next tasks. It's
inspired by [MyLifeOrganized](https://www.mylifeorganized.net/),
[OmniFocus](https://www.omnigroup.com/omnifocus/), [Amazing
Marvin](https://amazingmarvin.com/) and [Everdo](https://everdo.net/).

![Screenshot](/screenshot.png?raw=true)

This project is a work-in-progress. Expect bugs, and make sure to manually back
up your work with the buttons on the top bar. The Electron application saves
data in `~/.config/gtdtool/tasks.json`, and the web client uses local storage.

Nextool is licensed under the terms of the GNU AGPLv3 or any later version as
described in the file `LICENSE.md`.

**[Download the latest release here.](https://github.com/c2d7fa/nextool/releases/latest)**
On Windows and macOS, you may need to do something special to convince them to
run the program, since we don't sign the file. On Linux, just run `chmod +x <filename>.AppImage`
to make it executable.

## Development

Run the client on a local development server:

    $ npx parcel index.html

Watch unit tests:

    $ npx jest --watch-all --verbose

Run unit tests with coverage:

    $ npx jest --verbose --coverage=true --collectCoverageFrom=*.ts
    $ open ./coverage/lcov-report/index.html

Generate screenshot above:

    $ npx parcel index.html &
    $ gem install bundler
    $ bundle install
    $ ruby screenshot.rb

Watch Electron application:

    $ npx webpack -wc webpack-electron.config.js
    $ npx electron dist/electron/main.bundle.js
    [Press F12 to show dev tools, F5 to reload.]

Build Electron application:

    $ npm run build-linux # or build-macos, build-windows
    $ cp dist/Nextool-*.AppImage ~/bin/nextool # or dist/Nextool-*.dmg, dist/Nextool-*.exe

Release new version:

1. Update version number in `package.json`
2. Run `git tag vX.X.X` and `git push --tags`
3. Write description for release on GitHub

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

## Development

Run the client on a local development server:

    $ yarn parcel index.html

Watch unit tests:

    $ yarn jest --watch-all --verbose

Run unit tests with coverage:

    $ yarn jest --verbose --coverage=true --collectCoverageFrom=*.ts
    $ open ./coverage/lcov-report/index.html

Generate screenshot above:

    $ yarn parcel index.html &
    $ gem install bundler
    $ bundle install
    $ ruby screenshot.rb

Build Electron application:

    $ yarn build
    $ cp dist/gtdtool-*.AppImage ~/bin/nextool

Release new version:

1. Update version number in `package.json`
2. Run `git tag vX.X.X` and `git push --tags`
3. Check that GitHub Actions workflow has created new release on GitHub

# Nextool

I'm working on this GTD-oriented task manager with support for nested tasks and
a focus on helping the user make tasks actionable and surfacing next tasks. It's
inspired by [MyLifeOrganized](https://www.mylifeorganized.net/),
[OmniFocus](https://www.omnigroup.com/omnifocus/), [Amazing
Marvin](https://amazingmarvin.com/) and [Everdo](https://everdo.net/).

![Screenshot](/screenshot.png?raw=true)

This project is a work-in-progress. Expect bugs, and make sure to manually back
up your work with the buttons on the top bar. The Electron application saves
data in `~/.config/nextool/tasks.json`, and the web client uses local storage.

Nextool is licensed under the terms of the GNU AGPLv3 or any later version as
described in the file `LICENSE.md`.

**[Download the latest release here.](https://github.com/c2d7fa/nextool/releases/latest)**
On Windows and macOS, you may need to do something special to convince them to
run the program, since we don't sign the file. On Linux, just run `chmod +x <filename>.AppImage`
to make it executable.

## Development

### Package structure

Nextool has two clients, an Electron-based desktop application, and a website
which contains a web-based version of the application. These clients share most
of their code, but they plug in different platform-specefic functions, and they
each have their own build process.

The shared code is its own NPM package, which resides in the `app/` directory.
The Electron client is in the `electron/` directory. The code for the website is
in `website/`.

Unfortunately, working on a project that consists of multiple NPM packages can
be a bit painful. In theory, NPM will let you add a local dependency with `npm
install ../app` (for example). However, the problem with this is that it just
adds a symbolic link.

When the bundler for the Electron client (for example) tries to look up
dependencies, it will find the `node_modules` folder of the package for the
shared code. However, when we build the shared code package in production, it
builds a clean package that consists of just `package.json` and the output
that's built into `dist/` (see the `package.json`). This gives different results
in development and production.

Instead, we use a somewhat hacky approach where we have configured the Electron
package to build a clean release (using `npm pack`) of the shared code package,
and then install that at runtime. The disadvantage of this approach is that we
have to rebuild the entire thing each time we make a change.

### Working on the shared code

This is the main way of doing development on Nextool. To watch for changes and
continually generate an example of the app (according to `dev.tsx`) in
`dist/index.html`, run:

    $ cd app
    $ npx webpack -wc dev.config.js

Then, run a server in the `dist/` directory:

    $ cd app/dist
    $ python -m http.server 3000

### Working on the Electron client

To get around the fact that we need to rebuild the entire `app` package each
time we make a change, we can add yet another hack on top of this build process,
where we manually symlink `node_modules/nextool/dist` to the true `dist/`
directory inside the shared code package, but without symlinking anything else.

Thus, to work on the Electron client in development, while seeing updates made
in the shared code package, we first build the dependencies (which automatically
runs `npm pack` on the shared code package), and then we symlink `dist/` inside
the package:

    $ cd electron
    $ npm ci
    $ ln -sf $PWD/../app/dist node_modules/nextool/dist

Then, we run `webpack -w` in the shared code package to continually rebuild
changes:

    $ cd app
    $ npx webpack -w

And then we also watch for changes in the Electron client package:

    $ cd electron
    $ npx webpack -w

Finally, we can open the Electron application:

    $ cd electron
    $ npx electron dist/main.js

To refresh, press F5, and to show the developer tools, press F12.

### Working on the website

The website is automatically deployed to https://nextool.app/ from
[Vercel](https://vercel.com/) whenever this repository is updated.

To serve the website locally, run:

    $ cd website
    $ npm run dev

Apparently, Next.js doesn't like the approach described above for linking the
shared code package, so you just have to recompile the `app` package whenever
you change it.

### Running tests

Run test suite:

    $ cd app
    $ npx jest --verbose

Watch unit tests:

    $ cd app
    $ npx jest --watch-all --verbose

Run unit tests with coverage:

    $ cd app
    $ npx jest --verbose --coverage=true --collectCoverageFrom=*.ts
    $ open ./coverage/lcov-report/index.html

### Take screenshot

The screenshot above can be generated automatically. First, start the
application on `localhost:3000` as described in *Working on the shared code*
above. Then run:

    $ gem install bundler
    $ bundle install
    $ ruby screenshot.rb

### Build Electron application

To build a production release of the Electron application, run:

    $ cd electron
    $ npm ci
    $ npm run build-linux # or build-macos, build-windows
    $ cp dist/Nextool-*.AppImage ~/bin/nextool # or dist/Nextool-*.dmg, dist/Nextool-*.exe

### Release new version

1. Update version number in `app/package.json` and `electron/package.json`
2. Run `git tag vX.X.X` and `git push --tags`
3. Write description for release on GitHub

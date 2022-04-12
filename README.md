# Nextool

I'm working on this GTD-oriented task manager with support for nested tasks and
a focus on helping the user make tasks actionable and surfacing next tasks. It's
inspired by [MyLifeOrganized](https://www.mylifeorganized.net/),
[OmniFocus](https://www.omnigroup.com/omnifocus/), [Amazing
Marvin](https://amazingmarvin.com/) and [Everdo](https://everdo.net/).

**This project isn't in a usable state yet.**

It'll most likely be licensed in a similar way to
[Thinktool](https://github.com/c2d7fa/thinktool) (i.e. AGPL).

![Screenshot](/screenshot.png?raw=true)

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

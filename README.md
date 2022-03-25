# `gtdtool`

**WIP.** This is a project I'm working on. It's a GTD-oriented task manager with
support for nested tasks, inspired by [MyLifeOrganized](https://www.mylifeorganized.net/), [OmniFocus](https://www.omnigroup.com/omnifocus/), [Amazing Marvin](https://amazingmarvin.com/) and [Everdo](https://everdo.net/). It's not in a usable state currently.

![Screenshot](/screenshot.png?raw=true)

The name will be
changed soon to avoid infringing on any trademarks. It'll most likely be licensed in a similar way to
[Thinktool](https://github.com/c2d7fa/thinktool). Currently it has no license.

## Development

Run the client on a local development server:

    $ yarn parcel index.html

Watch unit tests:

    $ yarn jest --watch-all --verbose

Generate screenshot above:

    $ yarn parcel index.html &
    $ gem install selenium-webdriver
    $ ruby screenshot.rb

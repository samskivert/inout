# Input/Output

A simple mobile-friendly webapp for keeping a daily journal, and tracking of things you want to put
into your head: books to read, games to play, movies to watch, etc.

## Building

Building involves the usual rigamarole:

```
yarn
yarn build
```

Running a test server is done like so:

```
yarn start
```

This will start a server that serves up the app on `http://localhost:3000` and which recompiles the
code and reloads the reloads the page when it detects changes to the source files.

Deploying is simple (if you're me, since I own the Firebase app):

```
firebase deploy
```

## Using

If you just want to use the app, you can use the instance I operate at:

[https://inputoutput.app/](https://inputoutput.app/)

## License

The I/O code is released under the New BSD License. See the [LICENSE](blob/master/LICENSE) file for
details. The most recent version of the code is available at http://github.com/samskivert/inout

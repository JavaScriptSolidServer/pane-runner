# Pane runner

Run one SolidOS pane full-window, as an app. Give it a pane and a resource, and it loads the pane, provides what it expects (an rdflib store and fetcher, a small outliner shim) and shows it on its own, without the rest of the SolidOS browser. Your browser can install each pane as an app.

    https://jss.live/pane-runner/?pane=<pane module URL>&uri=<resource URL>

## Try it

- Chess, the Opera Game: https://jss.live/pane-runner/?pane=https%3A%2F%2Fsolid-panes.github.io%2Fchess%2Fchess-pane.js&uri=https%3A%2F%2Fsolid-panes.github.io%2Fchess%2Fgames%2Fopera.ttl
- Notes: https://jss.live/pane-runner/?pane=https%3A%2F%2Fsolid-panes.github.io%2Fnotes%2Fnotes-pane.js&uri=https%3A%2F%2Fsolid-panes.github.io%2Fnotes%2Fnotes%2Fwelcome.md
- A form to paste any pane and resource: https://jss.live/pane-runner/

## What it provides to a pane

- `context.dom` and `context.session.store`: an rdflib store with a fetcher and an updater
- `getOutliner(dom).GotoSubject(node)`: reopens the runner on the new resource, so Back works
- `$rdf` and `SolidLogic.store` as globals, for panes that use them
- A short-Accept retry, so data on static hosts such as GitHub Pages loads
- A manifest per pane, built from its name and icon, so the browser offers "Install app"
- A pane from another site asks once before it runs

The runner is about 11 KB. It bundles rdflib 2.4.1 (MIT) in `vendor/`, so nothing is fetched from a CDN.

## Early days

Version 0.0.1. It runs panes on public data only: no login yet. Panes that depend on solid-ui widgets or other SolidOS internals may need more shims.

## Licence

MIT, copyright Melvin Carvalho. rdflib is MIT, by its authors (see `vendor/`).

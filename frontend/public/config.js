// Fallback baked into every build (EN-176). A site whose chart doesn't yet
// mount the real /config.js ConfigMap gets this file served instead of
// falling through to index.html — valid, empty JS (analytics off, same as
// today) rather than HTML served at a .js URL, which throws a syntax error
// in the browser. A site with the ConfigMap mount wired up always gets the
// real file instead: the volume mount replaces this path in the container,
// it doesn't merge with it.
window.__CONFIG__ = {};

/**
 * Browser runtime for Layer C server-island ("hole") lazy loading.
 *
 * Self-contained ES module — no dependencies, no TypeScript. The publisher
 * injects a `<script type="module" src="/_pb/hole-runtime.js" defer>` tag
 * into pages that contain at least one `<pb-hole>` placeholder.
 *
 * On load, the runtime uses `IntersectionObserver` with a 200 px root margin
 * to begin fetching each hole's rendered fragment just before it enters the
 * viewport. Holes already in view on initial paint begin fetching immediately.
 *
 * IMPORTANT: the `<pb-hole>` element itself is `display:contents` (so it adds
 * no wrapper box), which means it has NO layout box for IntersectionObserver
 * to observe — observing it directly never fires. We therefore observe the
 * hole's baked placeholder CHILD (which DOES have a box) and swap the whole
 * `<pb-hole>` when it intersects. A hole with no placeholder child has nothing
 * to lazily reveal, so it is fetched eagerly on load.
 *
 * The fragment fetch URL is
 * `/_pb/hole/<nodeId>?v=<publishVersion>&u=<originating-page-url>`. The
 * version parameter lets the hole endpoint detect stale placeholders after a
 * re-publish and return a lightweight sentinel instead of cached stale HTML.
 * The `u` parameter carries the visitor's actual page path + query string so
 * the endpoint can rebuild the route frame (`route.query.*`) and key the cache
 * per query. Cookies ride along automatically (same-origin fetch) and are read
 * by the endpoint only for `perVisitor` holes.
 *
 * When the fetch resolves, `el.outerHTML = html` swaps the placeholder with
 * the server-rendered fragment in-place. No morphdom / idiomorph dependency.
 * A fetch failure is silently swallowed — the author's skeleton content in the
 * placeholder continues to show as a meaningful fallback.
 */

export const HOLE_RUNTIME_JS = `function pbFetchHole(el) {
  var id = el.dataset.pbHole;
  var version = el.dataset.pbVersion || '';
  var u = location.pathname + location.search;
  fetch('/_pb/hole/' + encodeURIComponent(id) + '?v=' + encodeURIComponent(version) + '&u=' + encodeURIComponent(u))
    .then(function(r) { return r.text(); })
    .then(function(html) { el.outerHTML = html; })
    .catch(function() {});
}
var io = new IntersectionObserver(function(entries) {
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i];
    if (!e.isIntersecting) continue;
    io.unobserve(e.target);
    var hole = e.target.closest('pb-hole[data-pb-hole]');
    if (hole) pbFetchHole(hole);
  }
}, { rootMargin: '200px 0px' });
var holes = document.querySelectorAll('pb-hole[data-pb-hole]');
for (var i = 0; i < holes.length; i++) {
  var el = holes[i];
  // <pb-hole> is display:contents (no box) — observe its placeholder child,
  // which has a box. Holes without a placeholder are fetched eagerly.
  var box = el.firstElementChild;
  if (box) { io.observe(box); } else { pbFetchHole(el); }
}
`

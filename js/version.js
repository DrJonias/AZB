// Site version in every footer: the commit timestamp of the last push/merge,
// rendered as DDMMYYYYHHMM in the visitor's local time. The webhook container
// on the NAS writes it to js/build.js (just the epoch in ms) after every git
// pull; until that file is fetched — or where it doesn't exist, e.g. in local
// dev — the page's own Last-Modified header serves as fallback.
(function () {
  function render(d) {
    if (isNaN(d)) return;
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    var s = p(d.getDate()) + p(d.getMonth() + 1) + d.getFullYear() + p(d.getHours()) + p(d.getMinutes());
    document.querySelectorAll('[data-version]').forEach(function (el) {
      el.textContent = 'Version ' + s;
    });
  }

  render(new Date(document.lastModified));

  var basePath = location.pathname.indexOf('/dev/') === 0 ? '/dev' : '';
  fetch(basePath + '/js/build.js')
    .then(function (r) { return r.ok ? r.text() : null; })
    .then(function (t) {
      var ts = parseInt(t, 10);
      if (ts) render(new Date(ts));
    })
    .catch(function () { /* fallback already rendered */ });
})();

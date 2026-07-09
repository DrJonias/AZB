// Site version in every footer: the timestamp of the last site update,
// rendered as DDMMYYYYHHMM in the visitor's local time. Comes from
// /api/version (when the checkout last got a git pull); until that
// answers, the page's own Last-Modified header is shown as a fallback.
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
  var apiBase = location.protocol.indexOf('http') === 0 ? location.origin + basePath : 'http://localhost:8787';
  fetch(apiBase + '/api/version')
    .then(function (r) { return r.json(); })
    .then(function (d) { if (d && d.ts) render(new Date(d.ts)); })
    .catch(function () { /* fallback already rendered */ });
})();

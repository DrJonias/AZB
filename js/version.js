// Central site version — bump it here, every footer picks it up automatically.
(function () {
  var SITE_VERSION = '1.3';
  document.querySelectorAll('[data-version]').forEach(function (el) {
    el.textContent = 'Version ' + SITE_VERSION;
  });
})();

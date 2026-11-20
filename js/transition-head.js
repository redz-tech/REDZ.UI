// REDZ.UI, the change of pages from the head: a plain script, not a module, that tools/build.php puts into
// js/floor.min.js after the floor's tests, so it runs before the stylesheets come. It opts the page into the
// cross-document view transition at once, the rule of css/components/app.css in a sheet of its own, so a page whose
// stylesheet comes late - a first visit - is opted in when the browser asks; it catches the promises of a transition and
// skips it under data-transition="none", as js/transition.js does once the module runs. Plain ES5 in a try of its own,
// and only where the browser changes pages so: an error or an old browser here never reaches the floor's verdict.
(function () {
	try {
		if (!('onpagereveal' in window) || typeof CSSStyleSheet !== 'function' || !('adoptedStyleSheets' in document)) {
			return;
		}
		var sheet = new CSSStyleSheet();
		sheet.replaceSync('@layer components { @media (prefers-reduced-motion: no-preference) { @view-transition { navigation: auto; } } }');
		document.adoptedStyleSheets.push(sheet);
		var settle = function (event) {
			var transition = event.viewTransition;
			if (!transition) {
				return;
			}
			var promises = [transition.ready, transition.finished, transition.updateCallbackDone];
			for (var i = 0; i < promises.length; i++) {
				if (promises[i]) {
					promises[i].then(null, function () {});
				}
			}
			if (document.documentElement.getAttribute('data-transition') === 'none') {
				transition.skipTransition();
			}
		};
		addEventListener('pageswap', settle);
		addEventListener('pagereveal', settle);
	} catch (error) {
	}
})();

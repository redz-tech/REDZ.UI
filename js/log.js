// REDZ.UI, log: a pre.log with data-follow keeps its end in view while lines come in, as a terminal does - unless the
// reader scrolled up to read an earlier line; scrolled back to the end, it follows again. Logs on the page, added
// later or given data-follow later are followed the same.
const FOLLOWED = 'pre.log[data-follow]';
const following = new WeakMap();

/** Whether the log shows its end, within a line's height. */
const atEnd = (log) => log.scrollHeight - log.scrollTop - log.clientHeight < 8;

/** Keeps the end of the log in view while it follows. */
const follow = (log) => {
	if (following.get(log) && log.hasAttribute('data-follow')) {
		log.scrollTop = log.scrollHeight;
	}
};

/** Starts following a log once. */
const watch = (log) => {
	if (following.has(log)) {
		follow(log);
		return;
	}
	following.set(log, true);
	log.addEventListener('scroll', () => following.set(log, atEnd(log)), {passive: true});
	new MutationObserver(() => follow(log)).observe(log, {childList: true, characterData: true, subtree: true});
	follow(log);
};

document.querySelectorAll(FOLLOWED).forEach(watch);

new MutationObserver((records) => {
	for (const record of records) {
		for (const node of record.type === 'attributes' ? [record.target] : record.addedNodes) {
			if (node instanceof Element) {
				(node.matches(FOLLOWED) ? [node] : [...node.querySelectorAll(FOLLOWED)]).forEach(watch);
			}
		}
	}
}).observe(document.documentElement, {childList: true, subtree: true, attributes: true, attributeFilter: ['data-follow']});

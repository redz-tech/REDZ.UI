// REDZ.UI, texts: the library has no words of its own — every word it shows comes from the page's island
// <script type="application/json" id="redz-ui-text">; a missing one is named in the console and shown as its key.
let texts = null;

/** The page's text for the key. */
export const text = (key) => {
	if (texts === null) {
		try {
			texts = JSON.parse(document.getElementById('redz-ui-text')?.textContent || '{}');
		} catch {
			texts = {};
		}
	}
	if (typeof texts[key] === 'string') {
		return texts[key];
	}
	console.error('REDZ.UI: no text "' + key + '" in #redz-ui-text');
	return key;
};

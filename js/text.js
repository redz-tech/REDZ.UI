// REDZ.UI, texts: the library has no words of its own — every word it shows comes from the page's island
// <script type="application/json" id="redz-ui-text">; a missing one is named in the console and shown as its key. A text
// fills its {names} from the arguments; a count picks the form its language's plural rules name — KEY.one, KEY.few,
// KEY.other — and falls back to KEY.other.
let texts = null;

/** The island's texts, read once. */
const island = () => {
	if (texts === null) {
		try {
			texts = JSON.parse(document.getElementById('redz-ui-text')?.textContent || '{}');
		} catch {
			texts = {};
		}
	}
	return texts;
};

/** The page's text for the key, its {names} filled from the arguments. */
export const text = (key, args = {}) => {
	const found = island()[key];
	if (typeof found === 'string') {
		return found.replace(/\{(\w+)\}/g, (whole, name) => name in args ? String(args[name]) : whole);
	}
	console.error('REDZ.UI: no text "' + key + '" in #redz-ui-text');
	return key;
};

/** The page's text for a count: the form of the key its language's plural rules pick, {count} in its digits. */
export const textCount = (key, count) => {
	const lang = document.documentElement.lang || 'en';
	const form = key + '.' + new Intl.PluralRules(lang).select(count);
	return text(typeof island()[form] === 'string' ? form : key + '.other', {count: new Intl.NumberFormat(lang).format(count)});
};

// REDZ.UI, ticking times: a time element with a datetime - ISO, with its zone - and data-elapsed shows the time since
// then as a clock, m:ss under an hour and h:mm:ss after; one with data-ago says how long ago it was, or how soon it
// comes, in the page's language ("5 minutes ago"), its full moment in its title. One ticker serves them all: each second
// while an elapsed time is on the page, else every 30 seconds, still while the page is hidden. They are never read out.
const UNITS = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]];
let timer = 0;

/** Seconds from the element's moment to now; NaN when it has none. */
const since = (time) => (Date.now() - Date.parse(time.dateTime)) / 1000;

/** The clock of so many seconds: m:ss, or h:mm:ss from an hour. */
const clock = (seconds) => {
	const whole = Math.max(0, Math.floor(seconds));
	const pad = (n) => String(n).padStart(2, '0');
	const hours = Math.floor(whole / 3600);
	return (hours > 0 ? hours + ':' + pad(Math.floor(whole / 60) % 60) : Math.floor(whole / 60)) + ':' + pad(whole % 60);
};

/** Words for so many seconds ago, or ahead when negative, in the page's language. */
const ago = (seconds, lang) => {
	const [unit, size] = UNITS.find(([, length]) => Math.abs(seconds) >= length) ?? UNITS.at(-1);
	return new Intl.RelativeTimeFormat(lang, {numeric: 'auto'}).format(-Math.round(seconds / size), unit);
};

/** Writes every ticking time and plans the next tick. */
const tick = () => {
	clearTimeout(timer);
	const lang = document.documentElement.lang || 'en';
	let next = 30000;
	for (const time of document.querySelectorAll('time[data-elapsed], time[data-ago]')) {
		const seconds = since(time);
		if (Number.isNaN(seconds)) {
			continue;
		}
		if (time.hasAttribute('data-elapsed')) {
			time.textContent = clock(seconds);
			next = Math.min(next, 1010 - (Math.max(0, seconds) * 1000) % 1000);
		} else {
			time.textContent = ago(seconds, lang);
			time.title ||= new Intl.DateTimeFormat(lang, {dateStyle: 'medium', timeStyle: 'short'}).format(new Date(time.dateTime));
		}
	}
	if (!document.hidden) {
		timer = setTimeout(tick, next);
	}
};

document.addEventListener('visibilitychange', tick);
new MutationObserver((records) => {
	if (records.some((record) => record.type === 'attributes' || [...record.addedNodes].some((node) => node instanceof Element && (node.matches('time[data-elapsed], time[data-ago]') || node.querySelector('time[data-elapsed], time[data-ago]'))))) {
		tick();
	}
}).observe(document.documentElement, {subtree: true, childList: true, attributes: true, attributeFilter: ['datetime', 'data-elapsed', 'data-ago']});
tick();

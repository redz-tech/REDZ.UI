// REDZ.UI, themes: a button with command="--theme" and the value light, dark or system sets the page's theme - data-theme
// on html, removed for system - and aria-pressed says which of them shows; one button with the value toggle flips the
// theme shown, the system's read from prefers-color-scheme, between light and dark, pressed while dark. The page hears
// redz:theme (detail.theme) and keeps the choice - the library stores nothing; the page writes data-theme on html on its
// server, so the page paints in its theme at once. Like --toggle, the button has no commandfor.
const root = document.documentElement;
const dark = matchMedia('(prefers-color-scheme: dark)');

/** The theme the page shows: its data-theme, or the system's. */
const shown = () => root.dataset.theme || (dark.matches ? 'dark' : 'light');

/** Presses the theme buttons that say the theme the page shows. */
const mark = () => {
	for (const button of document.querySelectorAll('button[command="--theme"]')) {
		button.setAttribute('aria-pressed', String(button.value === 'toggle' ? shown() === 'dark' : button.value === (root.dataset.theme || 'system')));
	}
};

document.addEventListener('click', (event) => {
	const button = event.target instanceof Element ? event.target.closest('button[command="--theme"]') : null;
	if (button === null || button.disabled || button.getAttribute('aria-disabled') === 'true') {
		return;
	}
	const theme = button.value === 'toggle' ? (shown() === 'dark' ? 'light' : 'dark') : button.value;
	if (theme === 'system') {
		delete root.dataset.theme;
	} else {
		root.dataset.theme = theme;
	}
	button.dispatchEvent(new CustomEvent('redz:theme', {bubbles: true, detail: {theme}}));
});

mark();
dark.addEventListener('change', mark);
new MutationObserver(mark).observe(root, {attributes: true, attributeFilter: ['data-theme']});

// REDZ.UI editor, the lens: the width, the theme, the site and the language of the page under the text, changed while it stays editable. The frame
// is a real page, so its media queries answer to its width and the site's own stylesheets draw it.
import {say} from './words.js';

const WIDTHS = [['full', '', 'laptop'], ['tablet', '48rem', 'tablet'], ['phone', '24.375rem', 'phone']];
const THEMES = [['auto', 'circle-half'], ['light', 'sun'], ['dark', 'moon-stars']];

/** Gives the editor its lens. */
export const lensOf = (ed) => {
	const strip = Object.assign(document.createElement('div'), {className: 'editor-lens'});
	strip.setAttribute('role', 'group');
	strip.setAttribute('aria-label', say('lens'));
	let theme = 'auto';

	const group = (key, items) => {
		const one = Object.assign(document.createElement('div'), {className: 'editor-choice'});
		one.setAttribute('role', 'group');
		one.setAttribute('aria-label', say(key));
		one.innerHTML = items.map(([value, words, glyph], index) => '<button type="button" data-value="' + value + '" aria-pressed="' + (index === 0) + '"' + (glyph === undefined ? '>' + words : ' aria-label="' + words + '" title="' + words + '"><i class="bi bi-' + glyph + '" aria-hidden="true"></i>') + '</button>').join('');
		const press = (button) => {
			for (const each of one.querySelectorAll('button')) {
				each.setAttribute('aria-pressed', String(each === button));
			}
		};
		strip.append(one);
		return {one, press};
	};

	ed.applyTheme = () => {
		const wanted = theme === 'auto' ? document.documentElement.dataset.theme : theme;
		if (wanted === undefined) {
			delete ed.doc.documentElement.dataset.theme;
		} else {
			ed.doc.documentElement.dataset.theme = wanted;
		}
	};

	ed.buildLens = () => {
		if (ed.config.lens === false) {
			return;
		}
		const languages = ed.config.languages ?? [];
		if (languages.length > 1) {
			const language = group('lens.language', languages.map((one) => [one.code, one.label ?? one.code.toUpperCase()]));
			language.press(language.one.querySelector('[data-value="' + CSS.escape(ed.config.lang) + '"]'));
			language.one.addEventListener('click', async (event) => {
				const button = event.target.closest('button');
				if (button !== null) {
					language.press(button);
					await ed.setLanguage(button.dataset.value);
				}
			});
		}
		const width = group('lens.width', WIDTHS.map(([key, , glyph]) => ['' + key, say('lens.' + key), glyph]));
		width.one.addEventListener('click', (event) => {
			const button = event.target.closest('button');
			if (button !== null) {
				width.press(button);
				ed.frame.style.inlineSize = WIDTHS.find(([key]) => key === button.dataset.value)[1];
				ed.layer.hideParts();
				ed.paintPick();
			}
		});
		const looks = group('lens.theme', THEMES.map(([key, glyph]) => [key, say('lens.' + key), glyph]));
		looks.one.addEventListener('click', (event) => {
			const button = event.target.closest('button');
			if (button !== null) {
				looks.press(button);
				theme = button.dataset.value;
				ed.applyTheme();
			}
		});
		const sites = ed.config.sites ?? [];
		if (sites.length > 1) {
			const site = group('lens.site', sites.map((one) => [one.id, one.label]));
			site.one.addEventListener('click', (event) => {
				const button = event.target.closest('button');
				if (button !== null) {
					site.press(button);
					ed.setStyles(sites.find((one) => one.id === button.dataset.value).styles ?? []);
				}
			});
		}
		ed.toolbar.after(strip);
	};
};

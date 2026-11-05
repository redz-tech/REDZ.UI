// REDZ.UI editor, the lock on what an AI writes: the model answers flat blocks, one shape held by the grammar at decoding, and this turns each into
// REDZ.UI markup by the catalog. A kind it does not know is left out, a tone or a size the element does not have falls to its default, so no class
// the library lacks can come out of a model. Facts travel as tokens; one the page does not know is dropped.
import {CATALOG} from './catalog.js';
import {escape, safe} from './clean.js';
import {blockId} from './marks.js';
import {marks} from './paste.js';

const ICONS = {info: 'info-circle', success: 'check-circle', warning: 'exclamation-triangle', danger: 'x-octagon', primary: 'stars', '': 'info-circle'};

const propOf = (id, key) => CATALOG.find((one) => one.id === id).props.find((one) => one.key === key);

/** The class of a value of a property, or none when the element does not have it. */
const pick = (id, key, prefix, value) => (propOf(id, key).family.includes(prefix + value) ? prefix + value : '');

/** Gives a page's facts to words: inline marks read as Markdown, then every token a fact the page knows. */
const wordsOf = (value, facts) => marks(String(value ?? '')).replace(/⟦([\w.-]+)⟧/g, (token, key) => (facts.has(key) ? '<data value="' + escape(key) + '">' + escape(facts.get(key).text) + '</data>' : ''));

const classes = (...names) => names.filter(Boolean).join(' ');

/** Writes the kinds of the catalog's write section. */
const WRITERS = {
	paragraph: (one, words) => '<p>' + words(one.text) + '</p>',
	heading: (one, words) => {
		const tag = 'h' + ([2, 3, 4].includes(one.level) ? one.level : 2);
		return '<' + tag + '>' + words(one.text) + '</' + tag + '>';
	},
	quote: (one, words) => '<blockquote>' + words(one.text) + '</blockquote>',
	bullets: (one, words) => '<ul>' + one.items.map((item) => '<li>' + words(item.title === '' ? item.text : '**' + item.title + '** ' + item.text) + '</li>').join('') + '</ul>',
	numbers: (one, words) => '<ol>' + one.items.map((item) => '<li>' + words(item.title === '' ? item.text : '**' + item.title + '** ' + item.text) + '</li>').join('') + '</ol>',
	alert: (one, words) => {
		const tone = pick('alert', 'tone', 'alert-', one.tone);
		return '<div class="' + classes('alert', tone, pick('alert', 'size', 'alert-', one.size)) + '"><i class="bi bi-' + (ICONS[one.tone] ?? ICONS['']) + '" aria-hidden="true"></i><div>' + words(one.text) + '</div></div>';
	},
	table: (one, words) => {
		const width = Math.max(one.head.length, ...one.rows.map((row) => row.length));
		const row = (cells, tag, extra) => Array.from({length: width}, (_, index) => '<' + tag + extra + '>' + words(cells[index] ?? '') + '</' + tag + '>').join('');
		return '<table class="table">' + (one.head.length > 0 ? '<thead><tr>' + row(one.head, 'th', ' scope="col"') + '</tr></thead>' : '') + '<tbody>' + one.rows.map((cells) => '<tr>' + row(cells, 'td', '') + '</tr>').join('') + '</tbody></table>';
	},
	accordion: (one, words) => {
		const name = 'redz-block-' + blockId();
		return '<div class="accordion">' + one.items.map((item) => '<details class="accordion-item" name="' + name + '"><summary class="accordion-header">' + words(item.title) + '<i class="bi bi-chevron-down accordion-icon" aria-hidden="true"></i></summary><div class="accordion-body">' + words(item.text) + '</div></details>').join('') + '</div>';
	},
	tabs: (one, words) => {
		const id = 'redz-block-' + blockId();
		return '<div class="vstack gap-12"><div class="nav nav-underline" role="tablist" aria-label="' + escape(one.text) + '">' + one.items.map((item, n) => '<button class="nav-link" type="button" role="tab" id="' + id + '-' + n + '" aria-selected="' + (n === 0) + '" aria-controls="' + id + '-panel-' + n + '">' + words(item.title) + '</button>').join('') + '</div>' + one.items.map((item, n) => '<div id="' + id + '-panel-' + n + '" role="tabpanel" aria-labelledby="' + id + '-' + n + '" tabindex="0"' + (n === 0 ? '' : ' hidden') + '><p>' + words(item.text) + '</p></div>').join('') + '</div>';
	},
	listgroup: (one, words) => '<ul class="list-group">' + one.items.map((item) => '<li class="list-group-item">' + words(item.title === '' ? item.text : '**' + item.title + '** ' + item.text) + '</li>').join('') + '</ul>',
	steps: (one, words) => '<ol class="stepper">' + one.items.map((item) => '<li class="stepper-item">' + words(item.title === '' ? item.text : '**' + item.title + '** ' + item.text) + '</li>').join('') + '</ol>',
	cards: (one, words) => '<div class="grid md:cols-' + Math.min(3, Math.max(2, one.items.length)) + ' gap-16">' + one.items.map((item) => '<div class="card"><div class="card-body vstack gap-8"><h3>' + words(item.title) + '</h3><p>' + words(item.text) + '</p></div></div>').join('') + '</div>',
	stat: (one, words) => '<div class="' + classes('stat', pick('stat', 'tone', 'stat-', one.tone)) + '"><div class="stat-label">' + words(one.items[0]?.title ?? '') + '</div><div class="stat-value">' + words(one.text) + '</div></div>',
	button: (one, words) => {
		const tone = propOf('button', 'tone').family.includes(one.tone) ? one.tone : 'primary';
		return '<p><a class="' + classes('btn', 'btn-' + tone, pick('button', 'size', 'btn-', one.size)) + '" href="' + escape(safe(one.href) && one.href !== '' ? one.href : '#') + '">' + words(one.text) + '</a></p>';
	},
};

const EMPTY = {text: '', href: '', tone: '', size: '', level: 0, head: [], rows: [], items: []};
const NEEDS_ITEMS = new Set(['bullets', 'numbers', 'accordion', 'tabs', 'listgroup', 'steps', 'cards']);

/** REDZ.UI's markup of an AI's flat blocks: what does not fit is left out in silence. */
export const fromFlat = (blocks, facts) => (Array.isArray(blocks) ? blocks : []).map((given) => {
	const one = {...EMPTY, ...given};
	const write = Object.hasOwn(WRITERS, one.kind) ? WRITERS[one.kind] : null;
	const lists = [one.items, one.head, one.rows].every(Array.isArray) && one.items.every((item) => typeof item?.title === 'string' && typeof item.text === 'string');
	if (write === null || !lists || (NEEDS_ITEMS.has(one.kind) && one.items.length === 0) || (one.kind === 'table' && one.rows.length === 0) || (!NEEDS_ITEMS.has(one.kind) && one.kind !== 'table' && String(one.text).trim() === '')) {
		return '';
	}
	return write(one, (value) => wordsOf(value, facts));
}).filter(Boolean);

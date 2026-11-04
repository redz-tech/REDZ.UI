// REDZ.UI, the editor (a package of the release, linked apart): REDZ.ui.editor(host, options) edits REDZ.UI markup in
// a frame of its own. The frame's document holds REDZ.UI's stylesheet, the theme's (options.styles) and the editor's
// marks, and its own Content-Security-Policy runs no script at all, so nothing in a body or on the clipboard ever runs;
// the editor's code works on it from the page. Every value is parsed inert and cleaned first. Prose - paragraphs,
// headings 2-4, lists, quotes, code - is edited in place; any other top-level element is a block, kept as the string
// it came as and drawn with its tools (move, edit its HTML, preview, delete; a grid's columns); a block that moves is
// drawn open - every <details> open, every tab's panel shown under its tab's words - and its Preview runs it alive in
// a dialog's frame of REDZ.UI's own CSS and JS, again with no script of the content. The toolbar is one tab stop with
// the arrow keys (Alt+F10 reaches it from the text); undo and redo are the editor's own. Every word comes from the
// page's texts, editor.*.
import {text} from '../js/text.js';

const BASE = new URL('..', import.meta.url);
const LIBRARY = {css: [new URL('dist/redz-ui.min.css', BASE).href, new URL('css/icons.css', BASE).href], js: new URL('dist/redz-ui.min.js', BASE).href, surface: new URL('editor/surface.css', BASE).href};
const PROSE = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'BLOCKQUOTE', 'PRE', 'HR']);
const INLINE = new Set(['A', 'ABBR', 'B', 'BR', 'CITE', 'CODE', 'DEL', 'EM', 'I', 'IMG', 'INS', 'KBD', 'MARK', 'PICTURE', 'Q', 'S', 'SMALL', 'SPAN', 'STRONG', 'SUB', 'SUP', 'TIME', 'U']);
const PROSE_CLASS = /^(text-(start|center|end|muted|primary|secondary|success|danger|warning|info)|bg-(primary|secondary|success|danger|warning|info)-subtle)$/;
const DROP = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'BASE', 'OBJECT', 'EMBED', 'NOSCRIPT', 'TEMPLATE', 'FRAME', 'FRAMESET', 'APPLET']);
const URLS = new Set(['href', 'src', 'action', 'poster', 'cite', 'data', 'xlink:href', 'background']);
const PASTE = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'A', 'UL', 'OL', 'LI', 'H2', 'H3', 'H4', 'BLOCKQUOTE', 'CODE', 'PRE']);
const ALIGN = ['text-start', 'text-center', 'text-end'];
const CSP = "script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
let made = 0;

/** The words of an island text of the editor. */
const say = (key, args) => text('editor.' + key, args);

/** Escapes text for an attribute or an element's words. */
const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);

/** Whether a URL may stay: a path, a fragment, or http(s), mailto, tel. */
const safe = (value) => !/^\s*[a-z][a-z0-9+.-]*:/i.test(value) || /^\s*(https?|mailto|tel):/i.test(value);

/** The HTML with nothing that runs or reaches away; for a paste, prose only, links' addresses only. */
export const clean = (html, paste = false) => {
	const doc = new DOMParser().parseFromString('<!doctype html><body>' + html, 'text/html');
	const walk = (node) => {
		for (const child of [...node.childNodes]) {
			if (child.nodeType === Node.COMMENT_NODE) {
				child.remove();
				continue;
			}
			if (child.nodeType !== Node.ELEMENT_NODE) {
				continue;
			}
			if (DROP.has(child.tagName) || (child.tagName === 'IFRAME' && (paste || !/^\s*https:/i.test(child.getAttribute('src') || '')))) {
				child.remove();
				continue;
			}
			for (const attribute of [...child.attributes]) {
				const name = attribute.name.toLowerCase();
				if (name.startsWith('on') || name === 'srcdoc' || name === 'formaction' || (URLS.has(name) && !safe(attribute.value)) || (paste && !(child.tagName === 'A' && name === 'href'))) {
					child.removeAttribute(attribute.name);
				}
			}
			walk(child);
			if (paste && !PASTE.has(child.tagName)) {
				child.replaceWith(...child.childNodes);
			}
		}
	};
	walk(doc.body);
	return doc.body.innerHTML;
};

/** Whether a top-level element is prose, edited in place, rather than a block. */
const prose = (element) => PROSE.has(element.tagName) && [...element.classList].every((name) => PROSE_CLASS.test(name));

/** The package's blocks of REDZ.UI markup, their sample words from the page's texts; {id} becomes a fresh id. */
const blocks = () => {
	const title = say('sample.title');
	const words = say('sample.text');
	const item = (n) => say('sample.item', {n});
	const tones = [['info', 'block.alert-info'], ['success', 'block.alert-success'], ['warning', 'block.alert-warning'], ['danger', 'block.alert-danger']].map(([tone, key]) => ({id: 'alert-' + tone, group: 'content', label: say(key), html:'<div class="alert alert-' + tone + '"><i class="bi bi-info-circle" aria-hidden="true"></i><div>' + words + '</div></div>'}));
	return [
		...tones,
		{id: 'card', group: 'content', label: say('block.card'), html: '<div class="card"><div class="card-body vstack gap-8"><h3>' + title + '</h3><p>' + words + '</p></div></div>'},
		{id: 'accordion', group: 'content', label: say('block.accordion'), html: '<div class="accordion">' + [1, 2, 3].map((n) => '<details class="accordion-item" name="{id}"><summary class="accordion-header">' + item(n) + '<i class="bi bi-chevron-down accordion-icon" aria-hidden="true"></i></summary><div class="accordion-body">' + words + '</div></details>').join('') + '</div>'},
		{id: 'tabs', group: 'content', label: say('block.tabs'), html: '<div class="vstack gap-12"><div class="nav nav-underline" role="tablist" aria-label="' + title + '">' + [1, 2, 3].map((n) => '<button class="nav-link" type="button" role="tab" id="{id}-' + n + '" aria-selected="' + (n === 1) + '" aria-controls="{id}-panel-' + n + '">' + item(n) + '</button>').join('') + '</div>' + [1, 2, 3].map((n) => '<div id="{id}-panel-' + n + '" role="tabpanel" aria-labelledby="{id}-' + n + '" tabindex="0"' + (n === 1 ? '' : ' hidden') + '><p>' + words + '</p></div>').join('') + '</div>'},
		{id: 'list-group', group: 'content', label: say('block.list-group'), html: '<ul class="list-group">' + [1, 2, 3].map((n) => '<li class="list-group-item">' + item(n) + '</li>').join('') + '</ul>'},
		{id: 'table', group: 'content', label: say('block.table'), html: '<table class="table"><thead><tr><th scope="col">' + item(1) + '</th><th scope="col">' + item(2) + '</th></tr></thead><tbody><tr><td>' + words + '</td><td>' + words + '</td></tr></tbody></table>'},
		{id: 'carousel', group: 'content', label: say('block.carousel'), html: '<div class="carousel" id="{id}" role="region" aria-label="' + title + '"><div class="carousel-inner" tabindex="0" aria-label="' + title + '">' + [1, 2, 3].map((n) => '<div class="carousel-item"><div class="p-24 bg-primary-subtle"><strong>' + item(n) + '</strong></div></div>').join('') + '</div><div class="hstack gap-8 justify-content-between"><button class="btn btn-icon" type="button" command="--prev" aria-controls="{id}" aria-label="' + say('sample.previous') + '"><i class="bi bi-chevron-left" aria-hidden="true"></i></button><div class="carousel-indicators"></div><button class="btn btn-icon" type="button" command="--next" aria-controls="{id}" aria-label="' + say('sample.next') + '"><i class="bi bi-chevron-right" aria-hidden="true"></i></button></div></div>'},
		{id: 'badges', group: 'inline', label: say('block.badges'), html: '<p class="hstack flex-wrap gap-8"><span class="badge badge-primary">' + item(1) + '</span><span class="badge badge-subtle-success">' + item(2) + '</span><span class="badge">' + item(3) + '</span></p>'},
		{id: 'buttons', group: 'inline', label: say('block.buttons'), html: '<p class="hstack flex-wrap gap-8"><a class="btn btn-primary" href="#">' + item(1) + '</a><a class="btn" href="#">' + item(2) + '</a></p>'},
		{id: 'button-group', group: 'inline', label: say('block.button-group'), html: '<div class="btn-group" role="group" aria-label="' + title + '">' + [1, 2, 3].map((n) => '<a class="btn" href="#">' + item(n) + '</a>').join('') + '</div>'},
		{id: 'progress', group: 'inline', label: say('block.progress'), html: '<p class="vstack gap-4"><span>' + title + '</span><progress class="progress" value="40" max="100" aria-label="' + title + '">40%</progress></p>'},
		{id: 'grid-2', group: 'layout', label: say('block.grid-2'), html: '<div class="grid md:cols-2 gap-16"><div><p>' + words + '</p></div><div><p>' + words + '</p></div></div>'},
		{id: 'grid-3', group: 'layout', label: say('block.grid-3'), html: '<div class="grid md:cols-3 gap-16"><div><p>' + words + '</p></div><div><p>' + words + '</p></div><div><p>' + words + '</p></div></div>'},
	];
};

/** A video address as the address of its player, or null: YouTube and Vimeo. */
const player = (address) => {
	const youtube = address.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/);
	if (youtube !== null) {
		return 'https://www.youtube-nocookie.com/embed/' + youtube[1];
	}
	const vimeo = address.match(/vimeo\.com\/(?:video\/)?(\d+)/);
	return vimeo === null ? null : 'https://player.vimeo.com/video/' + vimeo[1];
};

/** Makes the editor in the host; answers its calls. */
export const editor = (host, options = {}) => {
	const root = typeof host === 'string' ? document.querySelector(host) : host;
	if (!(root instanceof HTMLElement)) {
		throw new TypeError('REDZ.ui.editor: no host ' + String(host));
	}
	const id = 'redz-editor-' + ++made;
	const config = {styles: [], scripts: [], blocks: [], images: [], embed: true, grid: true, placeholder: '', lang: document.documentElement.lang || 'en', dir: document.documentElement.dir || 'ltr', ...options};
	const catalog = [...blocks(), ...config.blocks];
	const sources = new Map();
	const history = [];
	let at = -1;
	let changed = 0;
	let doc = null;
	let source = false;
	let sized = null;
	const listeners = [];

	/** Listens on a target, and forgets it on destroy. */
	const on = (target, type, handler, extra) => {
		target.addEventListener(type, handler, extra);
		listeners.push(() => target.removeEventListener(type, handler, extra));
	};

	root.replaceChildren();
	const box = Object.assign(document.createElement('div'), {className: 'editor', id});
	const toolbar = Object.assign(document.createElement('div'), {className: 'editor-toolbar'});
	toolbar.setAttribute('role', 'toolbar');
	toolbar.setAttribute('aria-label', say('toolbar'));
	toolbar.setAttribute('aria-controls', id + '-frame');
	const frame = Object.assign(document.createElement('iframe'), {className: 'editor-frame', id: id + '-frame', title: config.placeholder || say('body')});
	const area = Object.assign(document.createElement('textarea'), {className: 'editor-source', hidden: true, spellcheck: false});
	area.setAttribute('aria-label', say('source'));
	box.append(toolbar, frame, area);
	root.append(box);

	/** A toolbar button: an icon, its name, its action; toggles report aria-pressed. */
	const button = (icon, key, act, toggle = false) => {
		const one = Object.assign(document.createElement('button'), {type: 'button', className: 'btn btn-text btn-sm btn-icon', tabIndex: -1});
		one.setAttribute('aria-label', say(key));
		one.title = say(key);
		one.dataset.editor = key;
		one.innerHTML = '<i class="bi bi-' + icon + '" aria-hidden="true"></i>';
		if (toggle) {
			one.setAttribute('aria-pressed', 'false');
		}
		one.addEventListener('click', act);
		toolbar.append(one);
		return one;
	};

	/** A toolbar menu: a button that opens a REDZ.UI menu of items, each with its action. */
	const menu = (icon, key, items) => {
		const list = Object.assign(document.createElement('div'), {className: 'menu', id: id + '-' + key.replace(/\W/g, '-')});
		list.popover = 'auto';
		list.setAttribute('role', 'menu');
		list.setAttribute('aria-label', say(key));
		for (const [label, act, group] of items) {
			if (group !== undefined) {
				const header = Object.assign(document.createElement('div'), {className: 'menu-header', textContent: group});
				list.append(header);
			}
			const item = Object.assign(document.createElement('button'), {type: 'button', className: 'menu-item', textContent: label});
			item.setAttribute('role', 'menuitem');
			item.addEventListener('click', () => {
				list.hidePopover();
				act();
			});
			list.append(item);
		}
		const one = button(icon, key, () => {});
		one.setAttribute('commandfor', list.id);
		one.setAttribute('command', 'toggle-popover');
		one.setAttribute('aria-haspopup', 'menu');
		one.innerHTML += '<i class="bi bi-chevron-down fs-12" aria-hidden="true"></i>';
		toolbar.append(list);
		return one;
	};

	const divider = () => toolbar.append(Object.assign(document.createElement('span'), {className: 'vr'}));

	/** Puts cleaned HTML at the caret by the browser, then takes off the styles WebKit writes on what it puts. */
	const put = (html) => {
		const styled = new Set(doc.body.querySelectorAll('[style]'));
		doc.body.focus();
		doc.execCommand('insertHTML', false, html);
		for (const one of doc.body.querySelectorAll('[style]')) {
			if (!styled.has(one) && one.closest('.editor-island') === null) {
				one.removeAttribute('style');
				if (one.tagName === 'SPAN' && one.attributes.length === 0) {
					one.replaceWith(...one.childNodes);
				}
			}
		}
		commit();
	};

	/** Runs a browser editing command on the frame's document and records it. */
	const exec = (command, value = null) => {
		doc.body.focus();
		doc.execCommand(command, false, value);
		commit();
	};

	/** The top-level element of the frame's body that holds the selection, or null. */
	const blockAt = () => {
		const selection = doc.getSelection();
		let node = selection.rangeCount > 0 ? selection.getRangeAt(0).startContainer : null;
		while (node !== null && node.parentNode !== doc.body) {
			node = node.parentNode;
		}
		return node instanceof doc.defaultView.Element ? node : null;
	};

	/** Inserts a block after the one holding the selection, or at the end. */
	const insert = (html) => {
		const block = blockAt();
		const fresh = 'redz-block-' + ++made;
		const one = island(clean(html.replaceAll('{id}', fresh)));
		if (block === null) {
			doc.body.append(one);
		} else {
			block.after(one);
		}
		settle();
		commit();
	};

	/** The block's drawing in the frame: its source drawn, moving parts open, its tools over it. */
	const island = (html) => {
		const wrap = doc.createElement('div');
		wrap.className = 'editor-island';
		wrap.contentEditable = 'false';
		const view = doc.createElement('div');
		view.innerHTML = html;
		for (const details of view.querySelectorAll('details')) {
			details.removeAttribute('name');
			details.open = true;
		}
		for (const panel of view.querySelectorAll('[role="tabpanel"]')) {
			panel.hidden = false;
			const tab = view.querySelector('#' + CSS.escape(panel.getAttribute('aria-labelledby') || ''));
			if (tab !== null) {
				panel.dataset.editorTab = tab.textContent.trim();
			}
		}
		const name = doc.createElement('span');
		name.className = 'editor-island-name';
		name.textContent = say('block');
		const tools = doc.createElement('div');
		tools.className = 'editor-island-tools';
		const grid = view.firstElementChild?.classList.contains('grid') ?? false;
		for (const [icon, key] of [['arrow-up', 'block.up'], ['arrow-down', 'block.down'], ['code-slash', 'block.edit'], ...(grid && config.grid ? [['layout-three-columns', 'block.columns']] : []), ['eye', 'block.preview'], ['trash3', 'block.delete']]) {
			const one = doc.createElement('button');
			one.type = 'button';
			one.className = 'btn btn-text btn-xs btn-icon';
			one.dataset.editorBlock = key;
			one.setAttribute('aria-label', say(key));
			one.title = say(key);
			one.innerHTML = '<i class="bi bi-' + icon + '" aria-hidden="true"></i>';
			tools.append(one);
		}
		wrap.append(name, tools, view);
		sources.set(wrap, html);
		return wrap;
	};

	/** Fills the frame's body with a value: prose as it is, every other top-level element a block. */
	const fill = (html) => {
		sources.clear();
		const holder = new DOMParser().parseFromString('<!doctype html><body>' + clean(html), 'text/html').body;
		doc.body.replaceChildren();
		let run = null;
		for (const node of [...holder.childNodes]) {
			const inline = node.nodeType === Node.TEXT_NODE || (node.nodeType === Node.ELEMENT_NODE && INLINE.has(node.tagName));
			if (inline) {
				if (run === null && node.textContent.trim() === '' && node.nodeType === Node.TEXT_NODE) {
					continue;
				}
				run ??= doc.body.appendChild(doc.createElement('p'));
				run.append(doc.importNode(node, true));
				continue;
			}
			run = null;
			if (node.nodeType !== Node.ELEMENT_NODE) {
				continue;
			}
			doc.body.append(prose(node) ? doc.importNode(node, true) : island(node.outerHTML));
		}
		settle();
	};

	/** Keeps a paragraph to type in between blocks and after the last one, and marks an empty body. */
	const settle = () => {
		const body = doc.body;
		const empty = () => {
			const p = doc.createElement('p');
			p.append(doc.createElement('br'));
			return p;
		};
		for (const wrap of [...body.querySelectorAll(':scope > .editor-island')]) {
			if (wrap.nextElementSibling === null || wrap.nextElementSibling.classList.contains('editor-island')) {
				wrap.after(empty());
			}
		}
		if (body.firstElementChild === null) {
			body.append(empty());
		}
		body.classList.toggle('editor-empty', body.textContent.trim() === '' && sources.size === 0);
	};

	/** The value: prose as written, blocks as their sources; empty paragraphs and the editor's marks left out. */
	const value = () => {
		if (source) {
			return clean(area.value);
		}
		const parts = [];
		for (const node of [...doc.body.childNodes]) {
			if (node.nodeType === Node.ELEMENT_NODE && sources.has(node)) {
				parts.push(sources.get(node));
			} else if (node.nodeType === Node.ELEMENT_NODE) {
				if (node.textContent.trim() === '' && node.querySelector('img, iframe, hr, br:not(:only-child)') === null && node.tagName !== 'HR') {
					continue;
				}
				const copy = node.cloneNode(true);
				for (const one of copy.querySelectorAll('[contenteditable]')) {
					one.removeAttribute('contenteditable');
				}
				parts.push(copy.outerHTML);
			} else if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '') {
				parts.push('<p>' + escape(node.textContent) + '</p>');
			}
		}
		return clean(parts.join('\n'));
	};

	/** Records the value in the history and tells the page, after a pause in typing or at once after a command. */
	const commit = (later = false) => {
		clearTimeout(changed);
		const now = () => {
			const html = value();
			if (history[at] !== html) {
				history.splice(at + 1);
				history.push(html);
				at = history.length - 1;
				config.onChange?.(html);
			}
			doc.body.classList.toggle('editor-empty', doc.body.textContent.trim() === '' && sources.size === 0);
			mark();
		};
		if (later) {
			changed = setTimeout(now, 300);
		} else {
			now();
		}
	};

	/** Steps the history back or on: the value restored, the caret at the end of the text. */
	const step = (by) => {
		if (history[at + by] === undefined) {
			return;
		}
		at += by;
		fill(history[at]);
		const selection = doc.getSelection();
		selection.selectAllChildren(doc.body);
		selection.collapseToEnd();
		config.onChange?.(history[at]);
		mark();
	};

	/** The toolbar's pressed states by the selection. */
	const mark = () => {
		for (const [key, command] of [['bold', 'bold'], ['italic', 'italic'], ['underline', 'underline']]) {
			toolbar.querySelector('[data-editor="' + key + '"]')?.setAttribute('aria-pressed', String(!source && doc.queryCommandState(command)));
		}
		toolbar.querySelector('[data-editor="source"]')?.setAttribute('aria-pressed', String(source));
		for (const one of toolbar.querySelectorAll('button[data-editor]')) {
			if (one.dataset.editor !== 'source') {
				one.disabled = source;
			}
		}
	};

	/** A REDZ.UI dialog with a form: its fields, OK and Cancel; answers the form's values, or null. */
	const ask = (title, fields) => new Promise((answer) => {
		const dialog = Object.assign(document.createElement('dialog'), {className: 'dialog'});
		const titled = id + '-dialog-' + ++made;
		dialog.setAttribute('aria-labelledby', titled);
		dialog.innerHTML = '<form method="dialog" class="vstack"><div class="dialog-header"><h2 class="dialog-title" id="' + titled + '">' + escape(title) + '</h2></div><div class="dialog-body vstack gap-12">' + fields + '</div><div class="dialog-footer"><button class="btn" type="submit" value="cancel" formnovalidate>' + escape(text('confirm.cancel')) + '</button><button class="btn btn-primary" type="submit" value="ok">' + escape(text('confirm.ok')) + '</button></div></form>';
		dialog.addEventListener('close', () => {
			const form = dialog.querySelector('form');
			answer(dialog.returnValue === 'ok' ? Object.fromEntries(new FormData(form)) : null);
			dialog.remove();
			doc.body.focus();
		});
		document.body.append(dialog);
		dialog.showModal();
	});

	/** A text field of a dialog. */
	const field = (name, key, value = '', type = 'text') => '<div class="vstack gap-4"><label class="form-label" for="' + id + '-' + name + '">' + escape(say(key)) + '</label><input class="form-control" id="' + id + '-' + name + '" name="' + name + '" type="' + type + '" value="' + escape(value) + '"></div>';

	/** A check of a dialog. */
	const check = (name, key, on = false) => '<label class="form-check"><input class="check" type="checkbox" name="' + name + '"' + (on ? ' checked' : '') + '>' + escape(say(key)) + '</label>';

	/** The link dialog: the address, the words, a new tab, nofollow; the link written or changed in place. */
	const link = async () => {
		const selection = doc.getSelection();
		const range = selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;
		const old = range?.startContainer.parentElement?.closest('a') ?? null;
		const rel = (old?.getAttribute('rel') || '').split(/\s+/);
		const values = await ask(say('link'), field('href', 'link.href', old?.getAttribute('href') || '', 'url') + field('words', 'link.words', old?.textContent || range?.toString() || '') + check('blank', 'link.blank', old?.target === '_blank') + check('nofollow', 'link.nofollow', rel.includes('nofollow')));
		if (values === null || range === null) {
			return;
		}
		const href = values.href.trim();
		if (href === '' || !safe(href)) {
			return;
		}
		const a = old ?? doc.createElement('a');
		a.href = href;
		a.textContent = values.words.trim() || href;
		if (values.blank) {
			a.target = '_blank';
		} else {
			a.removeAttribute('target');
		}
		const kinds = [...(values.blank ? ['noopener'] : []), ...(values.nofollow ? ['nofollow'] : [])];
		if (kinds.length > 0) {
			a.rel = kinds.join(' ');
		} else {
			a.removeAttribute('rel');
		}
		if (old === null) {
			range.deleteContents();
			range.insertNode(a);
		}
		commit();
	};

	/** The embed dialog: a YouTube or Vimeo address and a title; a block of its player at the ratio chosen. */
	const embed = async () => {
		const values = await ask(say('embed'), field('url', 'embed.url', '', 'url') + field('title', 'embed.title'));
		const src = values === null ? null : player(values.url.trim());
		if (src !== null) {
			insert('<iframe class="w-100 ratio-16x9 rounded-8" src="' + escape(src) + '" title="' + escape(values.title.trim() || say('embed')) + '" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>');
		}
	};

	/** The grid dialog: how many columns, from which width, how far apart; only those classes change. */
	const columns = async (wrap) => {
		const html = sources.get(wrap);
		const holder = doc.createElement('div');
		holder.innerHTML = html;
		const grid = holder.firstElementChild;
		const classes = [...grid.classList];
		const now = classes.find((name) => /^(?:(?:sm|md|lg):)?cols-\d+$/.test(name)) ?? 'md:cols-2';
		const [, from = '', count = '2'] = now.match(/^(?:(sm|md|lg):)?cols-(\d+)$/) ?? [];
		const gap = (classes.find((name) => /^gap-\d+$/.test(name)) ?? 'gap-16').slice(4);
		const pick = (name, key, options, chosen) => '<div class="vstack gap-4"><label class="form-label" for="' + id + '-' + name + '">' + escape(say(key)) + '</label><select class="form-select" id="' + id + '-' + name + '" name="' + name + '">' + options.map(([option, label]) => '<option value="' + option + '"' + (option === chosen ? ' selected' : '') + '>' + escape(label) + '</option>').join('') + '</select></div>';
		const values = await ask(say('block.columns'), pick('count', 'columns.count', ['2', '3', '4'].map((n) => [n, n]), count) + pick('from', 'columns.from', [['', say('columns.always')], ['sm', 'sm'], ['md', 'md'], ['lg', 'lg']], from) + pick('gap', 'columns.gap', ['8', '16', '24'].map((n) => [n, n + ' px']), gap));
		if (values === null) {
			return;
		}
		for (const name of classes.filter((one) => /^(?:(?:sm|md|lg):)?cols-\d+$|^gap-\d+$/.test(one))) {
			grid.classList.remove(name);
		}
		grid.classList.add((values.from === '' ? '' : values.from + ':') + 'cols-' + values.count, 'gap-' + values.gap);
		replace(wrap, holder.innerHTML);
	};

	/** Puts a block's new source in the place of its drawing. */
	const replace = (wrap, html) => {
		const fresh = island(clean(html));
		wrap.replaceWith(fresh);
		sources.delete(wrap);
		settle();
		commit();
	};

	/** The Preview dialog: the block alive in a frame of REDZ.UI's own CSS and JS, where the content runs no script. */
	const preview = (wrap) => {
		const dialog = Object.assign(document.createElement('dialog'), {className: 'dialog dialog-lg'});
		const titled = id + '-preview-' + ++made;
		dialog.setAttribute('aria-labelledby', titled);
		dialog.setAttribute('closedby', 'any');
		const texts = document.getElementById('redz-ui-text')?.textContent || '{}';
		const head = '<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="script-src \'self\'; object-src \'none\'; base-uri \'none\'; form-action \'none\'">' + [...LIBRARY.css, ...config.styles].map((href) => '<link rel="stylesheet" href="' + escape(href) + '">').join('') + '<script type="application/json" id="redz-ui-text">' + texts.replace(/</g, '\\u003c') + '</script><script type="module" src="' + escape(LIBRARY.js) + '"></script>' + config.scripts.map((src) => '<script type="module" src="' + escape(src) + '"></script>').join('');
		dialog.innerHTML = '<div class="dialog-header"><h2 class="dialog-title" id="' + titled + '">' + escape(say('block.preview')) + '</h2><button class="btn-close" type="button" commandfor="' + titled + '-dialog" command="close" aria-label="' + escape(text('close')) + '"></button></div><div class="dialog-body"><iframe class="editor-preview" title="' + escape(say('block.preview')) + '"></iframe></div>';
		dialog.id = titled + '-dialog';
		dialog.querySelector('iframe').srcdoc = '<!doctype html><html lang="' + escape(config.lang) + '" dir="' + escape(config.dir) + '"><head>' + head + '</head><body class="region p-16">' + clean(sources.get(wrap)) + '</body></html>';
		dialog.addEventListener('close', () => dialog.remove());
		document.body.append(dialog);
		dialog.showModal();
	};

	/** Opens the image source; its image goes in at the caret. */
	const image = (from) => {
		const api = {
			insert: (spec) => {
				const img = '<img src="' + escape(spec.src) + '" alt="' + escape(spec.alt ?? '') + '"' + (spec.width ? ' width="' + escape(spec.width) + '"' : '') + (spec.height ? ' height="' + escape(spec.height) + '"' : '') + (spec.srcset ? ' srcset="' + escape(spec.srcset) + '"' : '') + (spec.sizes ? ' sizes="' + escape(spec.sizes) + '"' : '') + ' loading="lazy" decoding="async">';
				const html = Array.isArray(spec.sources) && spec.sources.length > 0 ? '<picture>' + spec.sources.map((one) => '<source' + (one.media ? ' media="' + escape(one.media) + '"' : '') + (one.type ? ' type="' + escape(one.type) + '"' : '') + ' srcset="' + escape(one.srcset) + '">').join('') + img + '</picture>' : img;
				put(clean(html));
			},
		};
		from.open(api);
	};

	/** Shows the source view of the value, or the text again with the source's value. */
	const toggleSource = () => {
		if (source) {
			source = false;
			fill(area.value);
			area.hidden = true;
			frame.hidden = false;
			commit();
			doc.body.focus();
		} else {
			area.value = value();
			source = true;
			frame.hidden = true;
			area.hidden = false;
			area.focus();
		}
		mark();
	};

	/** Builds the toolbar. */
	const tools = () => {
		menu('type', 'format', [['format.paragraph', 'p'], ['format.heading2', 'h2'], ['format.heading3', 'h3'], ['format.heading4', 'h4'], ['format.quote', 'blockquote'], ['format.code', 'pre']].map(([key, tag]) => [say(key), () => exec('formatBlock', tag)]));
		divider();
		button('type-bold', 'bold', () => exec('bold'), true);
		button('type-italic', 'italic', () => exec('italic'), true);
		button('type-underline', 'underline', () => exec('underline'), true);
		button('link-45deg', 'link', link);
		menu('palette', 'color', [['color.primary', 'text-primary'], ['color.secondary', 'text-secondary'], ['color.success', 'text-success'], ['color.danger', 'text-danger'], ['color.warning', 'text-warning'], ['color.info', 'text-info'], ['color.none', '']].map(([key, name]) => [say(key), () => paint(name)]));
		divider();
		button('list-ul', 'bullets', () => exec('insertUnorderedList'));
		button('list-ol', 'numbers', () => exec('insertOrderedList'));
		menu('text-left', 'align', [['align.start', 'text-start'], ['align.center', 'text-center'], ['align.end', 'text-end']].map(([key, name]) => [say(key), () => align(name)]));
		divider();
		if (config.images.length === 1) {
			button('image', 'image', () => image(config.images[0]));
		} else if (config.images.length > 1) {
			menu('image', 'image', config.images.map((from) => [from.label, () => image(from)]));
		}
		if (config.embed) {
			button('play-btn', 'embed', embed);
		}
		const groups = {content: say('group.content'), inline: say('group.inline'), layout: say('group.layout')};
		const shown = new Set();
		menu('grid-1x2', 'blocks', catalog.filter((one) => config.grid || one.group !== 'layout').map((one) => {
			const group = shown.has(one.group) ? undefined : (shown.add(one.group), groups[one.group] ?? one.group);
			return [one.label, () => insert(one.html), group];
		}));
		divider();
		button('eraser', 'clear', () => exec('removeFormat'));
		button('arrow-counterclockwise', 'undo', () => step(-1));
		button('arrow-clockwise', 'redo', () => step(1));
		button('code-slash', 'source', toggleSource, true);
		const first = toolbar.querySelector('button');
		if (first !== null) {
			first.tabIndex = 0;
		}
	};

	/** Writes a tone on the selected words, or takes the tones off them. */
	const paint = (name) => {
		const selection = doc.getSelection();
		if (selection.rangeCount === 0 || selection.isCollapsed) {
			return;
		}
		const range = selection.getRangeAt(0);
		const span = doc.createElement('span');
		span.append(range.extractContents());
		for (const inner of span.querySelectorAll('span')) {
			if ([...inner.classList].every((one) => /^text-/.test(one))) {
				inner.replaceWith(...inner.childNodes);
			}
		}
		if (name === '') {
			range.insertNode(doc.createRange().createContextualFragment(span.innerHTML));
		} else {
			span.className = name;
			range.insertNode(span);
		}
		commit();
	};

	/** Aligns the paragraph holding the selection. */
	const align = (name) => {
		const block = blockAt();
		if (block !== null && !sources.has(block)) {
			block.classList.remove(...ALIGN);
			if (name !== 'text-start') {
				block.classList.add(name);
			}
			commit();
		}
	};

	/** The toolbar's keys: one tab stop, the arrows, Home and End. */
	on(toolbar, 'keydown', (event) => {
		const buttons = [...toolbar.querySelectorAll(':scope > button')];
		const at = buttons.indexOf(event.target);
		const rtl = getComputedStyle(toolbar).direction === 'rtl';
		const to = {ArrowRight: rtl ? at - 1 : at + 1, ArrowLeft: rtl ? at + 1 : at - 1, Home: 0, End: buttons.length - 1}[event.key];
		if (at === -1 || to === undefined) {
			return;
		}
		event.preventDefault();
		const next = buttons[(to + buttons.length) % buttons.length];
		for (const one of buttons) {
			one.tabIndex = one === next ? 0 : -1;
		}
		next.focus();
	});

	/** The frame: its document written, then the value put in and watched. */
	const ready = () => {
		doc = frame.contentDocument;
		const body = doc.body;
		body.className = 'prose';
		body.contentEditable = 'true';
		body.setAttribute('role', 'textbox');
		body.setAttribute('aria-multiline', 'true');
		body.setAttribute('aria-label', config.placeholder || say('body'));
		body.dataset.placeholder = config.placeholder;
		doc.execCommand('defaultParagraphSeparator', false, 'p');
		fill(config.value ?? '');
		history.push(value());
		at = 0;
		tools();
		mark();
		let frameAsked = 0;
		sized = new ResizeObserver(() => {
			frameAsked ||= requestAnimationFrame(() => {
				frameAsked = 0;
				const height = Math.max(192, Math.ceil(body.getBoundingClientRect().height)) + 'px';
				if (frame.style.blockSize !== height) {
					frame.style.blockSize = height;
				}
			});
		});
		sized.observe(body);
		on(doc, 'input', () => commit(true));
		on(doc, 'selectionchange', mark);
		on(doc, 'keydown', (event) => {
			const mod = event.metaKey || event.ctrlKey;
			if (event.altKey && event.key === 'F10') {
				event.preventDefault();
				(toolbar.querySelector('button[tabindex="0"]') ?? toolbar.querySelector('button'))?.focus();
			} else if (mod && event.key.toLowerCase() === 'z') {
				event.preventDefault();
				step(event.shiftKey ? 1 : -1);
			} else if (mod && event.key.toLowerCase() === 'y') {
				event.preventDefault();
				step(1);
			} else if (mod && event.key.toLowerCase() === 'k') {
				event.preventDefault();
				link();
			}
		});
		on(doc, 'beforeinput', (event) => {
			if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
				event.preventDefault();
				step(event.inputType === 'historyUndo' ? -1 : 1);
			}
		});
		on(doc, 'paste', (event) => {
			const html = event.clipboardData?.getData('text/html') || '';
			const plain = event.clipboardData?.getData('text/plain') || '';
			event.preventDefault();
			put(html !== '' ? clean(html, true) : escape(plain).replace(/\n/g, '<br>'));
		});
		on(doc, 'drop', (event) => event.preventDefault());
		on(doc, 'click', (event) => {
			const tool = event.target instanceof doc.defaultView.Element ? event.target.closest('[data-editor-block]') : null;
			const wrap = tool?.closest('.editor-island') ?? null;
			if (tool === null || wrap === null) {
				return;
			}
			const act = tool.dataset.editorBlock;
			if (act === 'block.up' || act === 'block.down') {
				const near = act === 'block.up' ? wrap.previousElementSibling?.previousElementSibling ?? wrap.previousElementSibling : wrap.nextElementSibling?.nextElementSibling ?? wrap.nextElementSibling;
				if (near !== null && near !== undefined) {
					if (act === 'block.up') {
						near.before(wrap);
					} else {
						near.after(wrap);
					}
					settle();
					commit();
				}
			} else if (act === 'block.edit') {
				ask(say('block.edit'), '<textarea class="form-control font-monospace fs-12" name="html" rows="12" aria-label="' + escape(say('block.edit')) + '">' + escape(sources.get(wrap)) + '</textarea>').then((values) => {
					if (values !== null) {
						replace(wrap, values.html);
					}
				});
			} else if (act === 'block.columns') {
				columns(wrap);
			} else if (act === 'block.preview') {
				preview(wrap);
			} else if (act === 'block.delete') {
				sources.delete(wrap);
				wrap.remove();
				settle();
				commit();
			}
		});
	};

	on(frame, 'load', ready, {once: true});
	frame.srcdoc = '<!doctype html><html lang="' + escape(config.lang) + '" dir="' + escape(config.dir) + '"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="' + CSP + '">' + [...LIBRARY.css, ...config.styles, LIBRARY.surface].map((href) => '<link rel="stylesheet" href="' + escape(href) + '">').join('') + '</head><body></body></html>';

	return {
		getHTML: () => (doc === null ? clean(config.value ?? '') : value()),
		setHTML: (html) => {
			if (doc === null) {
				config.value = html;
			} else if (source) {
				area.value = clean(html);
			} else {
				fill(html);
			}
			if (doc !== null) {
				commit();
			}
		},
		focus: () => (source ? area : doc?.body)?.focus(),
		destroy: () => {
			for (const off of listeners) {
				off();
			}
			sized?.disconnect();
			clearTimeout(changed);
			root.replaceChildren();
		},
	};
};

globalThis.REDZ = Object.assign(globalThis.REDZ ?? {}, {ui: {...globalThis.REDZ?.ui, editor}});

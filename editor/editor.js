// REDZ.UI, the editor (a package of the release, linked apart): REDZ.ui.editor(host, options) edits REDZ.UI markup in a frame of its own. The
// frame's document holds REDZ.UI's stylesheet, the theme's (options.styles) and the editor's marks, and its own Content-Security-Policy runs no
// script at all, so nothing in a body or on the clipboard ever runs; the editor's code works on it from the page. Prose is edited in place; any
// other top-level element is a block: closed to the browser, its words fields, its parts and properties changed through the catalog of
// tools/catalog.json, so a person without the right never sees HTML. A block keeps a stable id, data-block, in the value with options.ids.
// options.rights says what the person may do, and only the server's check on save makes that true. Every word comes from the page's texts.
import {say} from './words.js';
import {clean, escape, safe} from './clean.js';
import {drawTop, FIELDS, isInline, isProse, blockId, repeats, unmark} from './marks.js';
import {before, caretPut, caretTo, fieldAt, guard, topAt} from './caret.js';
import {pastOf} from './past.js';
import {partDo, rowDrop, rowsOf} from './parts.js';
import {barsOf} from './bars.js';
import {cardOf} from './card.js';
import {typingOf} from './typing.js';
import {pasteOf} from './paste.js';
import {toolbarOf} from './toolbar.js';
import {lensOf} from './lens.js';
import {checksOf} from './checks.js';
import {templates} from './templates.js';

const BASE = new URL('..', import.meta.url);
const LIBRARY = {css: new URL('css/redz-ui.min.css', BASE).href, js: new URL('js/redz-ui.min.js', BASE).href, surface: new URL('css/redz-ui-editor-surface.min.css', BASE).href, passport: new URL('redz-ui.json', BASE).href};
/** The stylesheets of a frame: the library's, and the icon masks at the address the page links them from now, whatever
 *  its host and query. */
const frameSheets = () => [LIBRARY.css, ...[...document.querySelectorAll('link[rel="stylesheet"]')].filter((link) => new URL(link.href, document.baseURI).pathname.endsWith('/icons.min.css')).map((link) => link.href)];
const CSP = "script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
const RIGHTS = ['html', 'ai', 'design', 'structure', 'facts', 'lock', 'review'];
let made = 0;

/** What the person may do: given, only what is said; not given, all but HTML and protection. */
const rightsOf = (given) => (given === undefined
	? {html: false, ai: true, design: true, structure: true, facts: true, lock: false, review: true, langs: '*'}
	: {...Object.fromEntries(RIGHTS.map((key) => [key, given[key] === true])), langs: given.langs ?? '*'});

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
	const listeners = [];
	const ed = {id, config, rights: rightsOf(options.rights), doc: null, sel: null, composing: false};
	let source = false;
	let sized = null;
	let watcher = null;
	let noteTimer = 0;
	let sheets = config.styles;

	/** Listens on a target, and forgets it on destroy. */
	ed.on = (target, type, handler, extra) => {
		target.addEventListener(type, handler, extra);
		listeners.push(() => target.removeEventListener(type, handler, extra));
	};
	ed.may = (key) => ed.rights[key] === true;
	const langOpen = () => ed.rights.langs === '*' || ed.rights.langs.includes(config.lang);
	const locked = (top) => top.hasAttribute('data-lock') && !ed.may('lock');
	ed.wordsOpen = (top) => langOpen() && !(locked(top) && top.getAttribute('data-lock') === 'all');
	ed.formOpen = (top) => ed.may('design') && !locked(top);
	ed.placeOpen = (top) => ed.may('structure') && !locked(top);
	ed.isSource = () => source;

	root.replaceChildren();
	const box = Object.assign(document.createElement('div'), {className: 'editor', id});
	box.setAttribute('data-tooltips', '');
	const stage = Object.assign(document.createElement('div'), {className: 'editor-stage'});
	const frame = Object.assign(document.createElement('iframe'), {className: 'editor-frame', id: id + '-frame', title: config.placeholder || say('body')});
	const area = Object.assign(document.createElement('textarea'), {className: 'editor-source', hidden: true, spellcheck: false});
	area.setAttribute('aria-label', say('source'));
	const note = Object.assign(document.createElement('div'), {className: 'visually-hidden'});
	note.setAttribute('role', 'status');
	Object.assign(ed, {box, stage, frame});
	toolbarOf(ed);
	ed.toolbar.setAttribute('aria-controls', id + '-frame');
	stage.append(frame);
	box.append(ed.toolbar, stage, area, note);
	root.append(box);
	pastOf(ed);
	barsOf(ed);
	cardOf(ed);
	typingOf(ed);
	pasteOf(ed);
	lensOf(ed);
	checksOf(ed);

	/** Says a thing that happened to the page's reader and on the screen for a moment. */
	ed.note = (words) => {
		note.textContent = words;
		box.dataset.editorNote = words;
		clearTimeout(noteTimer);
		noteTimer = setTimeout(() => delete box.dataset.editorNote, 4000);
	};

	/** The top elements of the text as stored: empty paragraphs and the editor's marks left out. */
	ed.read = (ids) => {
		const parts = [];
		for (const each of [...ed.doc.body.childNodes]) {
			const node = ed.kept(each);
			if (node.nodeType === Node.ELEMENT_NODE) {
				if (isProse(node) && node.textContent.trim() === '' && node.querySelector('img, iframe, hr, br:not(:only-child)') === null && node.tagName !== 'HR') {
					continue;
				}
				parts.push(unmark(node.cloneNode(true), ids).outerHTML.replace(/​/g, ''));
			} else if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '') {
				parts.push('<p>' + escape(node.textContent) + '</p>');
			}
		}
		return clean(parts.join('\n'));
	};
	ed.value = () => (source ? clean(fromSource()) : ed.read(config.ids === true));

	/** Fills the frame's body with a value: prose as it is, every other top-level element a block. */
	ed.fill = (html) => {
		const doc = ed.doc;
		const holder = new DOMParser().parseFromString('<!doctype html><body>' + clean(html), 'text/html').body;
		doc.body.replaceChildren();
		let run = null;
		for (const node of [...holder.childNodes]) {
			if (isInline(node)) {
				if (run === null && node.textContent.trim() === '' && node.nodeType === Node.TEXT_NODE) {
					continue;
				}
				run ??= doc.body.appendChild(doc.createElement('p'));
				run.append(doc.importNode(node, true));
				continue;
			}
			run = null;
			if (node.nodeType === Node.ELEMENT_NODE) {
				const top = doc.importNode(node, true);
				doc.body.append(drawTop(top, ed.wordsOpen(top)));
			}
		}
		ed.settle();
	};

	/** Keeps every top element an element with its own id, and a paragraph to type in between blocks. */
	ed.settle = () => {
		const doc = ed.doc;
		const body = doc.body;
		const empty = (gap) => {
			const p = doc.createElement('p');
			p.append(doc.createElement('br'));
			p.setAttribute('data-block', blockId());
			if (gap) {
				p.setAttribute('data-editor-gap', '');
			}
			return p;
		};
		for (const node of [...body.childNodes]) {
			if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '') {
				const p = doc.createElement('p');
				node.replaceWith(p);
				p.append(node);
			}
		}
		const seen = new Map();
		for (const top of body.children) {
			const own = top.getAttribute('data-block');
			const twin = seen.get(own);
			if (own === null) {
				top.setAttribute('data-block', blockId());
			} else if (twin !== undefined) {
				(twin.textContent.length < top.textContent.length ? twin : top).setAttribute('data-block', blockId());
			}
			seen.set(own, top);
			seen.set(top.getAttribute('data-block'), top);
		}
		for (const top of [...body.children]) {
			if (top.getAttribute('contenteditable') === 'false' && !isProse(top) && (top.nextElementSibling === null || top.nextElementSibling.getAttribute('contenteditable') === 'false')) {
				top.after(empty(true));
			}
		}
		if (body.firstElementChild === null || body.lastElementChild.tagName === 'PRE') {
			body.append(empty(body.firstElementChild !== null));
		}
		if (body.firstElementChild.getAttribute('contenteditable') === 'false') {
			body.prepend(empty(true));
		}
		for (const gap of body.querySelectorAll(':scope > [data-editor-gap]')) {
			if (gap.textContent !== '') {
				gap.removeAttribute('data-editor-gap');
			} else if (gap.previousElementSibling?.hasAttribute('data-editor-gap')) {
				gap.remove();
			}
		}
		body.classList.toggle('editor-empty', body.textContent.trim() === '' && body.querySelector('[contenteditable="false"]') === null);
		for (const top of body.querySelectorAll('[data-lock]')) {
			top.setAttribute('data-editor-lock', say('lock.' + top.getAttribute('data-lock')));
		}
	};

	/** Draws a block again from its own markup. */
	ed.redraw = (top) => {
		const keep = top.getAttribute('data-block');
		unmark(top, true);
		top.setAttribute('data-block', keep);
		drawTop(top, ed.wordsOpen(top));
	};

	/** Focuses an element of the frame, the frame first: Firefox leaves the focus in the page otherwise. */
	ed.focusIn = (element) => {
		frame.contentWindow.focus();
		element.focus();
	};

	/** Runs a browser editing command on the frame's document and records it. */
	ed.exec = (command, value = null) => {
		const top = topAt(ed.doc);
		if (top !== null && !ed.wordsOpen(top)) {
			return;
		}
		ed.focusIn(fieldAt(ed.doc) ?? ed.doc.body);
		const known = new Set(ed.doc.body.querySelectorAll('span[style], font'));
		ed.doc.execCommand(command, false, value);
		for (const one of ed.doc.body.querySelectorAll('span[style], font')) {
			if (!known.has(one)) {
				one.replaceWith(...one.childNodes);
			}
		}
		ed.commit();
	};

	/** A copy of an element under another tag, with its class and id; the caret stays where it was. */
	ed.retagged = (top, tag) => {
		const fresh = top.ownerDocument.createElement(tag);
		for (const attribute of top.attributes) {
			fresh.setAttribute(attribute.name, attribute.value);
		}
		fresh.append(...top.childNodes);
		if (fresh.textContent === '' && fresh.querySelector('br, img') === null) {
			fresh.replaceChildren(top.ownerDocument.createElement('br'));
		}
		top.replaceWith(fresh);
		return fresh;
	};
	ed.retag = (top, tag) => {
		const at = before(ed.doc, top).length;
		caretTo(ed.doc, ed.retagged(top, tag), at);
	};

	/** The top elements under the selection. */
	const tops = () => {
		const selection = ed.doc.getSelection();
		if (selection.rangeCount === 0) {
			return [];
		}
		const range = selection.getRangeAt(0);
		return selection.isCollapsed ? [topAt(ed.doc)].filter(Boolean) : [...ed.doc.body.children].filter((one) => range.intersectsNode(one));
	};

	/** Selects whole top elements after they were changed. */
	const holdLines = (first, last) => {
		const range = ed.doc.createRange();
		range.setStart(first, 0);
		range.setEnd(last, last.childNodes.length);
		const selection = ed.doc.getSelection();
		selection.removeAllRanges();
		selection.addRange(range);
	};

	/** A line of a list item, and the lists nested in it after the line. */
	const lineOf = (item) => {
		const line = ed.doc.createElement('p');
		const nested = [...item.children].filter((one) => one.matches('ul, ol'));
		line.append(...[...item.childNodes].filter((one) => !nested.includes(one)));
		if (line.textContent.trim() === '' && line.querySelector('br, img') === null) {
			line.replaceChildren(ed.doc.createElement('br'));
		}
		return [line, ...nested];
	};

	/** Takes the items under the selection out of a list: those before stay, those after become a list of their own. */
	const unlist = (list) => {
		const selection = ed.doc.getSelection();
		const range = selection.getRangeAt(0);
		const items = [...list.children].filter((one) => (selection.isCollapsed ? one.contains(range.startContainer) : range.intersectsNode(one)));
		const rest = [];
		for (let next = items.at(-1)?.nextElementSibling ?? null; next !== null; next = next.nextElementSibling) {
			rest.push(next);
		}
		const at = selection.isCollapsed ? before(ed.doc, items[0]).length : -1;
		const lines = items.map(lineOf);
		const tail = list.cloneNode(false);
		tail.removeAttribute('data-block');
		tail.append(...rest);
		list.after(...lines.flat(), ...(rest.length > 0 ? [tail] : []));
		for (const item of items) {
			item.remove();
		}
		if (list.children.length === 0) {
			if (list.hasAttribute('data-block')) {
				lines[0][0].setAttribute('data-block', list.getAttribute('data-block'));
			}
			list.remove();
		}
		if (at === -1) {
			holdLines(lines[0][0], lines.at(-1)[0]);
		} else {
			caretTo(ed.doc, lines[0][0], at);
		}
	};

	/** Makes the lines under the selection a list, takes a list's items out of it, or turns a list into the other kind. */
	ed.list = (tag) => {
		const doc = ed.doc;
		const lines = tops().filter((one) => /^(P|H[2-6]|BLOCKQUOTE|UL|OL)$/.test(one.tagName) && isProse(one) && ed.placeOpen(one));
		if (lines.length === 0 || fieldAt(doc) !== null) {
			return;
		}
		const name = tag.toUpperCase();
		const only = lines.length === 1 ? lines[0] : null;
		if (only?.tagName === name) {
			const start = doc.getSelection().getRangeAt(0).startContainer;
			const item = (start.nodeType === Node.ELEMENT_NODE ? start : start.parentElement).closest('li');
			if (item !== null && item.parentElement !== only) {
				doc.execCommand('outdent');
			} else {
				unlist(only);
			}
			ed.commit();
			return;
		}
		const collapsed = doc.getSelection().isCollapsed;
		const at = collapsed ? before(doc, lines[0]).length : 0;
		if (only !== null && /^(UL|OL)$/.test(only.tagName)) {
			caretTo(doc, ed.retagged(only, tag), at);
			ed.commit();
			return;
		}
		let list = doc.createElement(tag);
		if (lines[0].hasAttribute('data-block')) {
			list.setAttribute('data-block', lines[0].getAttribute('data-block'));
		}
		for (const line of lines) {
			if (/^(UL|OL)$/.test(line.tagName)) {
				list.append(...line.children);
			} else {
				const item = doc.createElement('li');
				item.append(...line.childNodes);
				list.append(item);
			}
		}
		lines[0].replaceWith(list);
		for (const line of lines.slice(1)) {
			line.remove();
		}
		const like = (one) => one?.tagName === name && isProse(one) && ed.placeOpen(one);
		if (like(list.previousElementSibling)) {
			const above = list.previousElementSibling;
			const offset = above.textContent.length;
			above.append(...list.children);
			list.remove();
			list = above;
			if (collapsed) {
				caretTo(doc, list, offset + at);
			}
		} else if (collapsed) {
			caretTo(doc, list, at);
		}
		if (like(list.nextElementSibling)) {
			list.append(...list.nextElementSibling.children);
			list.nextElementSibling.remove();
		}
		if (!collapsed) {
			holdLines(list, list);
		}
		ed.commit();
	};

	/** The lines under the selection become a heading, a quote or a block of code; a list's items leave it first. */
	ed.format = (tag) => {
		for (const one of tops().filter((top) => /^(UL|OL)$/.test(top.tagName) && isProse(top) && ed.formOpen(top) && ed.placeOpen(top))) {
			if (one.isConnected) {
				unlist(one);
			}
		}
		const lines = tops().filter((one) => /^(P|H[2-6]|BLOCKQUOTE|PRE)$/.test(one.tagName) && isProse(one) && ed.formOpen(one));
		if (lines.length === 0) {
			return;
		}
		if (ed.doc.getSelection().isCollapsed) {
			ed.retag(lines[0], tag);
		} else {
			const made = lines.map((one) => ed.retagged(one, tag));
			holdLines(made[0], made.at(-1));
		}
		ed.commit();
	};

	/** Puts cleaned markup in after a top element, or in the place of an empty paragraph. */
	ed.insertBlocks = (html, near) => {
		const doc = ed.doc;
		const holder = new DOMParser().parseFromString('<!doctype html><body>' + clean(html), 'text/html').body;
		const tops = [...holder.children].map((node) => {
			const top = doc.importNode(node, true);
			return drawTop(top, true);
		});
		const emptyLine = near !== null && near !== undefined && near.tagName === 'P' && near.textContent.trim() === '' && near.querySelector('img') === null;
		if (near === null || near === undefined) {
			doc.body.append(...tops);
		} else if (emptyLine) {
			near.replaceWith(...tops);
		} else {
			near.after(...tops);
		}
		ed.settle();
		ed.commit();
		return tops;
	};

	/** What can be inserted: images, a video, the package's blocks and the page's own. */
	ed.insertable = () => {
		const blocks = [...templates(), ...config.blocks].filter((one) => config.grid || one.group !== 'layout').map((one) => ({...one, icon: one.icon ?? 'square', run: () => {
			ed.insertBlocks(one.html.replaceAll('{id}', 'redz-block-' + blockId()), topAt(ed.doc));
		}}));
		const media = [...config.images.map((from) => ({label: from.label, icon: 'image', group: 'media', run: () => image(from)})), ...(config.embed ? [{label: say('embed'), icon: 'play-btn', group: 'media', run: embed}] : [])];
		return [...media, ...blocks];
	};

	/** One list of commands, for the palette today and for agents later. */
	ed.commands = () => {
		const top = topAt(ed.doc);
		return [
			...(ed.may('structure') ? ed.insertable().map((one) => ({label: say('insert') + ': ' + one.label, icon: one.icon, run: one.run})) : []),
			{label: say('bold'), icon: 'type-bold', keys: '⌘B', run: () => ed.exec('bold')},
			{label: say('italic'), icon: 'type-italic', keys: '⌘I', run: () => ed.exec('italic')},
			{label: say('underline'), icon: 'type-underline', keys: '⌘U', run: () => ed.exec('underline')},
			{label: say('link'), icon: 'link-45deg', keys: '⌘K', run: ed.link},
			{label: say('undo'), icon: 'arrow-counterclockwise', keys: '⌘Z', run: ed.undo},
			{label: say('redo'), icon: 'arrow-clockwise', keys: '⇧⌘Z', run: ed.redo},
			...(top !== null ? [{label: say('card'), icon: 'sliders', keys: '⌥↩', run: () => ed.openCard(top)}] : []),
			...(ed.may('html') ? [{label: say('source'), icon: 'code-slash', run: ed.toggleSource}] : []),
		];
	};

	/** Moves a top element before another, or to the end, with a View Transition where there is one. */
	ed.moveTop = (top, anchor) => {
		const change = () => {
			ed.doc.body.insertBefore(top, anchor);
			ed.settle();
			ed.commit();
			ed.pickNone();
		};
		if (ed.doc.startViewTransition !== undefined && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
			ed.doc.startViewTransition(change);
		} else {
			change();
		}
	};
	ed.moveBy = (top, step) => {
		if (ed.placeOpen(top)) {
			const near = step < 0 ? top.previousElementSibling : top.nextElementSibling?.nextElementSibling ?? null;
			if (step < 0 ? near !== null : top.nextElementSibling !== null) {
				ed.moveTop(top, near);
			}
		}
	};
	ed.copyTop = (top) => {
		const copy = top.cloneNode(true);
		copy.setAttribute('data-block', blockId());
		top.after(copy);
		ed.settle();
		ed.commit();
	};

	/** A REDZ.UI dialog with a form: its fields, OK and Cancel; answers the form's values, or null. */
	ed.ask = (title, fields) => new Promise((answer) => {
		const dialog = Object.assign(document.createElement('dialog'), {className: 'dialog'});
		const titled = id + '-dialog-' + ++made;
		dialog.setAttribute('aria-labelledby', titled);
		dialog.innerHTML = '<form method="dialog" class="vstack"><div class="dialog-header"><h2 class="dialog-title" id="' + titled + '">' + escape(title) + '</h2></div><div class="dialog-body vstack gap-12">' + fields + '</div><div class="dialog-footer"><button class="btn" type="submit" value="cancel" formnovalidate>' + escape(say('cancel')) + '</button><button class="btn btn-primary" type="submit" value="ok">' + escape(say('ok')) + '</button></div></form>';
		dialog.addEventListener('close', () => {
			const form = dialog.querySelector('form');
			answer(dialog.returnValue === 'ok' ? Object.fromEntries(new FormData(form)) : null);
			dialog.remove();
			ed.focus();
		});
		document.body.append(dialog);
		dialog.showModal();
	});
	ed.fieldHTML = (name, key, value = '', type = 'text') => '<div class="vstack gap-4"><label class="form-label" for="' + id + '-' + name + '">' + escape(say(key)) + '</label><input class="form-control" id="' + id + '-' + name + '" name="' + name + '" type="' + type + '" value="' + escape(value) + '"></div>';
	ed.checkField = (name, key, on = false) => '<label class="form-check"><input class="check" type="checkbox" name="' + name + '"' + (on ? ' checked' : '') + '>' + escape(say(key)) + '</label>';

	/** The link dialog: the address, the words, a new tab, nofollow; the link written or changed in place. */
	ed.link = async () => {
		const doc = ed.doc;
		const selection = doc.getSelection();
		const range = selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;
		const old = range?.startContainer.parentElement?.closest('a') ?? null;
		const rel = (old?.getAttribute('rel') || '').split(/\s+/);
		const values = await ed.ask(say('link'), ed.fieldHTML('href', 'link.href', old?.getAttribute('href') || '', 'url') + ed.fieldHTML('words', 'link.words', old?.textContent || range?.toString() || '') + ed.checkField('blank', 'link.blank', old?.target === '_blank') + ed.checkField('nofollow', 'link.nofollow', rel.includes('nofollow')));
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
		ed.commit();
	};

	/** The embed dialog: a YouTube or Vimeo address and a title; a block of its player. */
	const embed = async () => {
		const values = await ed.ask(say('embed'), ed.fieldHTML('url', 'embed.url', '', 'url') + ed.fieldHTML('title', 'embed.title'));
		const src = values === null ? null : player(values.url.trim());
		if (src !== null) {
			ed.insertBlocks('<iframe class="w-100 ratio-16x9 rounded-8" src="' + escape(src) + '" title="' + escape(values.title.trim() || say('embed')) + '" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>', topAt(ed.doc));
		}
	};

	/** Opens the image source; its image goes in at the caret. */
	const image = (from) => {
		from.open({
			insert: (spec) => {
				const img = '<img src="' + escape(spec.src) + '" alt="' + escape(spec.alt ?? '') + '"' + (spec.width ? ' width="' + escape(spec.width) + '"' : '') + (spec.height ? ' height="' + escape(spec.height) + '"' : '') + (spec.srcset ? ' srcset="' + escape(spec.srcset) + '"' : '') + (spec.sizes ? ' sizes="' + escape(spec.sizes) + '"' : '') + ' loading="lazy" decoding="async">';
				const html = Array.isArray(spec.sources) && spec.sources.length > 0 ? '<picture>' + spec.sources.map((one) => '<source' + (one.media ? ' media="' + escape(one.media) + '"' : '') + (one.type ? ' type="' + escape(one.type) + '"' : '') + ' srcset="' + escape(one.srcset) + '">').join('') + img + '</picture>' : img;
				ed.exec('insertHTML', clean(html));
			},
		});
	};

	/** Names what an expert wrote that REDZ.UI does not know, from the passport. */
	ed.checkHTML = async (value) => {
		const notes = [];
		const parsed = new DOMParser().parseFromString('<!doctype html><body>' + value, 'text/html').body;
		const removed = new Set();
		for (const one of parsed.querySelectorAll('script, style, object, embed, link, meta, base')) {
			removed.add(one.tagName.toLowerCase());
		}
		for (const one of parsed.querySelectorAll('*')) {
			for (const attribute of one.attributes) {
				if (/^on/i.test(attribute.name) || (/^(href|src)$/i.test(attribute.name) && !safe(attribute.value))) {
					removed.add(attribute.name);
				}
			}
		}
		if (removed.size > 0) {
			notes.push(say('html.removed', {what: [...removed].join(', ')}));
		}
		const known = await fetch(LIBRARY.passport).then((answer) => (answer.ok ? answer.json() : null)).catch(() => null);
		if (known !== null) {
			const names = new Set(Array.isArray(known.classes) ? known.classes : Object.keys(known.classes));
			const unknown = new Set([...parsed.querySelectorAll('[class]')].flatMap((one) => [...one.classList]).filter((name) => !names.has(name) && !name.startsWith('bi-')));
			if (unknown.size > 0) {
				notes.push(say('html.unknown', {what: [...unknown].join(', ')}));
			}
		}
		return notes;
	};

	/** The Preview dialog: a block alive in a frame of REDZ.UI's own CSS and JS, where the content runs no script. */
	const preview = (top) => {
		const dialog = Object.assign(document.createElement('dialog'), {className: 'dialog dialog-lg'});
		const titled = id + '-preview-' + ++made;
		dialog.setAttribute('aria-labelledby', titled);
		dialog.setAttribute('closedby', 'any');
		const texts = document.getElementById('redz-ui-text')?.textContent || '{}';
		const hosts = [...new Set([LIBRARY.js, ...config.scripts].map((src) => new URL(src, document.baseURI).origin))].join(' ');
		const head = '<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="script-src ' + escape(hosts) + '; object-src \'none\'; base-uri \'none\'; form-action \'none\'">' + [...frameSheets(), ...sheets].map((href) => '<link rel="stylesheet" href="' + escape(href) + '">').join('') + '<script type="application/json" id="redz-ui-text">' + texts.replace(/</g, '\\u003c') + '</script><script type="module" src="' + escape(LIBRARY.js) + '"></script>' + config.scripts.map((src) => '<script type="module" src="' + escape(src) + '"></script>').join('');
		dialog.innerHTML = '<div class="dialog-header"><h2 class="dialog-title" id="' + titled + '">' + escape(say('block.preview')) + '</h2><button class="btn-close" type="button" commandfor="' + titled + '-dialog" command="close" aria-label="' + escape(say('close')) + '"></button></div><div class="dialog-body"><iframe class="editor-preview" title="' + escape(say('block.preview')) + '"></iframe></div>';
		dialog.id = titled + '-dialog';
		const theme = document.documentElement.dataset.theme;
		dialog.querySelector('iframe').srcdoc = '<!doctype html><html lang="' + escape(config.lang) + '" dir="' + escape(config.dir) + '"' + (theme === undefined ? '' : ' data-theme="' + escape(theme) + '"') + '><head>' + head + '</head><body class="region p-16">' + clean(unmark(top.cloneNode(true), false).outerHTML) + '</body></html>';
		dialog.addEventListener('close', () => dialog.remove());
		document.body.append(dialog);
		dialog.showModal();
	};
	ed.preview = preview;

	/** Shows the source view of the value, or the text again with the source's value. */
	ed.toggleSource = () => {
		if (!ed.may('html')) {
			return;
		}
		ed.closeCard();
		if (source) {
			const html = fromSource();
			source = false;
			ed.fill(html);
			area.hidden = true;
			stage.hidden = false;
			ed.commit();
			ed.focus();
		} else {
			const parts = [...ed.doc.body.children].filter((top) => top.textContent.trim() !== '' || !isProse(top));
			area.value = parts.map((top) => (locked(top) ? '<!--block ' + top.getAttribute('data-block') + '-->' : unmark(top.cloneNode(true), config.ids === true).outerHTML)).join('\n');
			source = true;
			stage.hidden = true;
			area.hidden = false;
			area.focus();
		}
		ed.pickNone();
		ed.mark();
	};

	/** The source's text as a value: every protected block in its place, even when its line was removed. */
	const fromSource = () => {
		const kept = new Map([...ed.doc.querySelectorAll('[data-lock]')].filter(locked).map((one) => [one.getAttribute('data-block'), unmark(one.cloneNode(true), true).outerHTML]));
		const html = area.value.replace(/<!--block ([\w-]+)-->/g, (match, one) => {
			const block = kept.get(one) ?? '';
			kept.delete(one);
			return block;
		});
		return html + [...kept.values()].join('');
	};

	const hooks = {
		enter: (field, top, event) => {
			if (event.shiftKey) {
				return false;
			}
			const cell = field.closest('td, th');
			if (cell !== null) {
				const table = cell.closest('table');
				const rows = rowsOf(table);
				const below = rows[rows.indexOf(cell.parentElement) + 1]?.cells[cell.cellIndex];
				if (below !== undefined) {
					caretPut(ed.doc, {id: top.getAttribute('data-block'), field: [...top.querySelectorAll(FIELDS), top].indexOf(below), at: below.textContent.length});
				}
				return true;
			}
			const item = field.closest('li');
			if (item !== null && ed.placeOpen(top)) {
				const fresh = partDo(item, 'add');
				ed.redraw(top);
				ed.commit();
				caretPut(ed.doc, {id: top.getAttribute('data-block'), field: [...top.querySelectorAll(FIELDS), top].indexOf(fresh.matches(FIELDS) ? fresh : fresh.querySelector(FIELDS)), at: 0});
				return true;
			}
			return false;
		},
		tab: (field, top, event) => {
			const cell = field.closest('td, th');
			if (cell === null) {
				return false;
			}
			const all = [...top.querySelectorAll(FIELDS)];
			const next = all.indexOf(field) + (event.shiftKey ? -1 : 1);
			if (next >= all.length && ed.placeOpen(top)) {
				const rows = rowsOf(cell.closest('table'));
				partDo(rows.at(-1), 'add');
				ed.redraw(top);
				ed.commit();
				caretPut(ed.doc, {id: top.getAttribute('data-block'), field: [...top.querySelectorAll(FIELDS)].length - rows.at(-1).cells.length, at: 0});
			} else if (all[next] !== undefined) {
				caretPut(ed.doc, {id: top.getAttribute('data-block'), field: next, at: all[next].textContent.length});
			}
			return true;
		},
		backspace: (field, top) => {
			if (!ed.placeOpen(top)) {
				return;
			}
			const cell = field.closest('td, th');
			if (cell !== null) {
				const table = cell.closest('table');
				const row = cell.parentElement;
				if (row.parentElement.tagName !== 'THEAD' && [...row.cells].every((one) => one.textContent.trim() === '')) {
					const rows = rowsOf(table);
					const near = rows[rows.indexOf(row) - 1];
					if (rowDrop(table, rows.indexOf(row))) {
						ed.commit();
						caretPut(ed.doc, {id: top.getAttribute('data-block'), field: [...top.querySelectorAll(FIELDS), top].indexOf(near.cells[0]), at: near.cells[0].textContent.length});
					} else {
						top.remove();
						ed.settle();
						ed.commit();
						ed.note(say('last.table'));
					}
				}
				return;
			}
			const item = field.closest('li');
			if (item !== null && item.textContent.trim() === '' && repeats(item)) {
				const near = item.previousElementSibling ?? item.nextElementSibling;
				partDo(item, 'drop');
				ed.commit();
				caretPut(ed.doc, {id: top.getAttribute('data-block'), field: [...top.querySelectorAll(FIELDS), top].indexOf(near.matches(FIELDS) ? near : near.querySelector(FIELDS)), at: near.textContent.length});
			}
		},
	};

	const hint = () => {
		if (ed.composing) {
			return;
		}
		for (const one of ed.doc.querySelectorAll('[data-editor-hint]')) {
			one.removeAttribute('data-editor-hint');
		}
		const top = topAt(ed.doc);
		if (top?.hasAttribute('data-editor-gap') && top.textContent !== '') {
			top.removeAttribute('data-editor-gap');
		}
		if (top !== null && top.tagName === 'P' && top.textContent === '' && ed.doc.body.textContent.trim() !== '') {
			top.setAttribute('data-editor-hint', ed.may('structure') ? say('hint') : '');
		}
	};

	const bubble = () => {
		const doc = ed.doc;
		const selection = doc.getSelection();
		const panel = ed.layer.bubble;
		if (matchMedia('(pointer: coarse)').matches || selection === null || selection.rangeCount === 0 || selection.isCollapsed || selection.toString().trim() === '') {
			panel.hidden = true;
			return;
		}
		const rect = selection.getRangeAt(0).getBoundingClientRect();
		panel.hidden = false;
		const over = rect.top + frame.offsetTop - panel.offsetHeight - 8;
		panel.style.insetBlockStart = (over < frame.offsetTop ? rect.bottom + frame.offsetTop + 8 : over) + 'px';
		panel.style.left = Math.max(0, Math.min(rect.left + frame.offsetLeft + rect.width / 2 - panel.offsetWidth / 2, stage.clientWidth - panel.offsetWidth)) + 'px';
	};

	const buildBubble = () => {
		const panel = ed.layer.bubble;
		panel.innerHTML = [['bold', 'type-bold'], ['italic', 'type-italic'], ['underline', 'type-underline'], ['link', 'link-45deg'], ['clear', 'eraser']].map(([key, icon]) => '<button class="btn btn-text btn-sm btn-icon" type="button" data-editor-bubble="' + key + '" aria-label="' + say(key) + '" title="' + say(key) + '"><i class="bi bi-' + icon + '" aria-hidden="true"></i></button>').join('');
		panel.addEventListener('pointerdown', (event) => event.preventDefault());
		panel.addEventListener('click', (event) => {
			const act = event.target.closest('[data-editor-bubble]')?.dataset.editorBubble;
			if (act === 'link') {
				ed.link();
			} else if (act !== undefined) {
				ed.exec(act === 'clear' ? 'removeFormat' : act);
			}
		});
	};

	/** The frame: its document written, then the value put in and watched. */
	const ready = () => {
		const doc = frame.contentDocument;
		ed.doc = doc;
		const body = doc.body;
		body.className = 'prose';
		body.contentEditable = langOpen() ? 'true' : 'false';
		body.setAttribute('role', 'textbox');
		body.setAttribute('aria-multiline', 'true');
		body.setAttribute('aria-label', config.placeholder || say('body'));
		body.dataset.placeholder = config.placeholder;
		doc.execCommand('defaultParagraphSeparator', false, 'p');
		ed.applyTheme();
		watcher = new MutationObserver(ed.applyTheme);
		watcher.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
		ed.fill(config.value ?? '');
		ed.start();
		ed.buildTools();
		ed.buildLens();
		buildBubble();
		ed.mark();
		ed.changed();
		let asked = 0;
		sized = new doc.defaultView.ResizeObserver(() => {
			asked ||= requestAnimationFrame(() => {
				asked = 0;
				const height = Math.max(192, Math.ceil(body.getBoundingClientRect().height)) + 'px';
				if (frame.style.blockSize !== height) {
					frame.style.blockSize = height;
				}
			});
		});
		sized.observe(body);
		ed.on(doc, 'compositionstart', () => {
			ed.composing = true;
		});
		ed.on(doc, 'compositionend', (event) => {
			ed.composing = false;
			ed.typed(event);
			ed.commit(true);
		});
		ed.on(doc, 'input', (event) => {
			ed.typed(event);
			ed.commit(true);
		});
		ed.on(doc, 'selectionchange', () => {
			ed.mark();
			ed.followCaret();
			ed.pickFollow();
			hint();
			bubble();
		});
		ed.on(doc, 'keydown', (event) => {
			if (event.isComposing || event.keyCode === 229) {
				return;
			}
			const mod = event.metaKey || event.ctrlKey;
			const key = event.key.toLowerCase();
			if (ed.pickKeys(event)) {
				return;
			}
			if (event.altKey && event.key === 'F10') {
				event.preventDefault();
				(ed.toolbar.querySelector('button[tabindex="0"]') ?? ed.toolbar.querySelector('button'))?.focus();
			} else if (mod && key === 'z') {
				event.preventDefault();
				(event.shiftKey ? ed.redo : ed.undo)();
			} else if (mod && key === 'y') {
				event.preventDefault();
				ed.redo();
			} else if (mod && key === 'k') {
				event.preventDefault();
				ed.link();
			} else if (mod && key === '/') {
				event.preventDefault();
				ed.openPalette();
			} else if (event.altKey && event.key === 'Enter' && topAt(doc) !== null) {
				event.preventDefault();
				ed.openCard(topAt(doc));
			} else if (mod && event.shiftKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown') && topAt(doc) !== null) {
				event.preventDefault();
				ed.moveBy(topAt(doc), event.key === 'ArrowUp' ? -1 : 1);
			} else if (event.key === 'Escape') {
				ed.closeCard();
				ed.pickNone();
			} else {
				guard(doc, event, hooks);
			}
		});
		ed.on(doc, 'beforeinput', (event) => {
			if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
				event.preventDefault();
				(event.inputType === 'historyUndo' ? ed.undo : ed.redo)();
				return;
			}
			if (event.inputType.startsWith('delete') || event.inputType.startsWith('insert')) {
				const selection = doc.getSelection();
				const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
				const top = topAt(doc);
				const back = selection.isCollapsed && event.inputType.endsWith('Backward');
				const on = selection.isCollapsed && event.inputType.endsWith('Forward');
				const near = back ? top?.previousElementSibling : (on ? top?.nextElementSibling : null);
				const at = top === null || !selection.isCollapsed ? -1 : before(doc, top).length;
				const edge = top !== null && ((back && at === 0) || (on && at >= top.textContent.length)) && (locked(top) || (near !== null && near !== undefined && locked(near)));
				const hit = (selection.isCollapsed ? [] : [...doc.querySelectorAll('[data-lock]')].filter((one) => locked(one) && range.intersectsNode(one)));
				const split = event.inputType === 'insertParagraph' && top !== null && locked(top);
				if (hit.length > 0 || edge || split) {
					event.preventDefault();
					ed.note(say('lock.refused'));
					return;
				}
			}
			ed.changing();
		});
		ed.on(doc, 'paste', (event) => {
			event.preventDefault();
			ed.paste({html: event.clipboardData?.getData('text/html') || '', text: event.clipboardData?.getData('text/plain') || ''});
		});
		ed.on(doc, 'drop', (event) => event.preventDefault());
		ed.on(doc, 'mousedown', (event) => {
			const gap = event.target instanceof doc.defaultView.Element ? event.target.closest('[data-editor-gap]') : null;
			if (gap !== null) {
				event.preventDefault();
				ed.focusIn(doc.body);
				caretTo(doc, gap, 0);
			}
		});
		ed.on(doc, 'click', (event) => {
			const target = event.target instanceof doc.defaultView.Element ? event.target : null;
			if (target?.closest('a, summary, button') !== null && target !== null) {
				event.preventDefault();
			}
			if (target !== null) {
				ed.pick(target);
			}
		});
		ed.on(doc, 'pointermove', (event) => {
			const rect = frame.getBoundingClientRect();
			if (document.elementFromPoint(rect.left + event.clientX, rect.top + event.clientY) === frame) {
				ed.layer.follow(event.target);
			}
		});
		config.onReady?.();
	};

	const frameDocument = () => '<!doctype html><html lang="' + escape(config.lang) + '" dir="' + escape(config.dir) + '"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="' + CSP + '">' + [...frameSheets(), ...sheets, LIBRARY.surface].map((href) => '<link rel="stylesheet" href="' + escape(href) + '">').join('') + '</head><body></body></html>';

	/** Replaces the theme's stylesheets of the frame, for the lens. */
	ed.setStyles = (styles) => {
		const doc = ed.doc;
		sheets = styles;
		const links = [...doc.querySelectorAll('link[rel="stylesheet"]')];
		for (const link of links.filter((one) => config.styles.includes(one.getAttribute('href')) || one.dataset.editorSite !== undefined)) {
			link.remove();
		}
		const surface = links.find((one) => one.href === LIBRARY.surface);
		for (const href of styles) {
			const link = doc.createElement('link');
			link.rel = 'stylesheet';
			link.href = href;
			link.dataset.editorSite = '';
			doc.head.insertBefore(link, surface ?? null);
		}
	};

	/** Moves the text to another language: the host answers its value and direction. */
	ed.setLanguage = async (code) => {
		const one = (config.languages ?? []).find((each) => each.code === code);
		if (one === undefined) {
			return;
		}
		ed.commit();
		await config.onLanguage?.(code, ed.value());
		const html = await (one.value ?? config.getLanguage?.(code)) ?? '';
		config.lang = code;
		config.dir = one.dir ?? 'ltr';
		ed.doc.documentElement.lang = code;
		ed.doc.documentElement.dir = config.dir;
		ed.doc.body.contentEditable = langOpen() ? 'true' : 'false';
		ed.fill(html);
		ed.start();
		ed.changed();
		ed.mark();
	};

	ed.focus = () => {
		if (source) {
			area.focus();
		} else if (ed.doc !== null) {
			ed.focusIn(ed.doc.body);
		}
	};
	ed.on(frame, 'load', ready, {once: true});
	frame.srcdoc = frameDocument();

	return {
		getHTML: () => (ed.doc === null ? clean(config.value ?? '') : ed.value()),
		setHTML: (html) => {
			if (ed.doc === null) {
				config.value = html;
			} else if (source) {
				area.value = clean(html);
			} else {
				ed.fill(html);
				ed.commit();
			}
		},
		setRights: (given) => {
			ed.rights = rightsOf(given);
			if (ed.doc !== null) {
				const value = ed.read(true);
				ed.doc.body.contentEditable = langOpen() ? 'true' : 'false';
				ed.fill(value);
				ed.closeCard();
				ed.pickNone();
				ed.mark();
			}
		},
		focus: ed.focus,
		destroy: () => {
			for (const off of listeners) {
				off();
			}
			sized?.disconnect();
			watcher?.disconnect();
			ed.stop();
			ed.closeCard();
			clearTimeout(noteTimer);
			root.replaceChildren();
		},
	};
};

globalThis.REDZ = Object.assign(globalThis.REDZ ?? {}, {ui: {...globalThis.REDZ?.ui, editor}});

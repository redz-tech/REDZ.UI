// REDZ.UI editor, the card of a block or a part: its properties, tried on before they are kept, its form, its history, its protection and,
// for an expert, its HTML. The card never covers what it changes: it stands beside the editor, or as a sheet at the foot of a phone.
import {say} from './words.js';
import {escape, clean, safe, trusted} from './clean.js';
import {nodeAt, unmark, drawTop} from './marks.js';
import {choices, elementOf, readProp, writeProp} from './props.js';
import {columnAdd, columnDrop, columnsOf, headToggle, rowAdd, rowDrop, rowsOf} from './parts.js';
import {FORMS, formNow, toForm} from './forms.js';

const ICONS = ['info-circle', 'check-circle', 'exclamation-triangle', 'x-octagon', 'stars', 'star', 'heart', 'person-check', 'cup-hot', 'compass', 'life-preserver', 'sun', 'water', 'camera', 'geo-alt', 'clock', 'shield-check', 'wallet2', 'ticket-perforated', 'map', 'tree', 'bicycle', 'car-front', 'airplane', 'house', 'telephone', 'envelope', 'chat-dots', 'calendar', 'cart', 'gift', 'lightning'];

/** Gives the editor its card. */
export const cardOf = (ed) => {
	const card = Object.assign(document.createElement('div'), {className: 'editor-card'});
	card.popover = 'manual';
	card.setAttribute('role', 'dialog');
	card.setAttribute('aria-label', say('card'));
	ed.box.append(card);
	let trial = null;
	let open = null;

	const blockNow = () => (open === null ? null : ed.doc.querySelector('[data-block="' + CSS.escape(open.id) + '"]'));

	/** Tries a change on: the block changes on the page and comes back unless it is kept. */
	const tryOn = (top, change) => {
		trial ??= {id: top.getAttribute('data-block'), saved: top.cloneNode(true)};
		const fresh = trial.saved.cloneNode(true);
		ed.doc.querySelector('[data-block="' + CSS.escape(trial.id) + '"]').replaceWith(fresh);
		ed.redraw(change(fresh) ?? fresh);
		ed.paintPick();
	};
	/** A top element as it is kept: while a change is tried on, what it was. */
	ed.kept = (node) => (trial !== null && node.nodeType === Node.ELEMENT_NODE && node.getAttribute('data-block') === trial.id ? trial.saved : node);
	const tryOff = () => {
		if (trial !== null) {
			ed.doc.querySelector('[data-block="' + CSS.escape(trial.id) + '"]')?.replaceWith(trial.saved);
			trial = null;
			ed.paintPick();
		}
	};
	const tryKeep = () => {
		trial = null;
		ed.settle();
		ed.commit();
	};
	ed.tryOn = tryOn;
	ed.tryOff = tryOff;
	ed.tryKeep = tryKeep;

	const choose = (one, on, keep) => {
		one.addEventListener('pointerenter', on);
		one.addEventListener('focus', on);
		one.addEventListener('click', () => {
			on();
			tryKeep();
			keep();
		});
	};

	const propRow = (prop, index, read) => '<div class="editor-prop"><span>' + say('prop.' + prop.key) + '</span><div class="editor-choice' + (prop.kind === 'tone' ? ' editor-swatches' : '') + '" role="group" aria-label="' + say('prop.' + prop.key) + '" data-editor-prop="' + index + '">' + choices(prop).map(([value, label, color]) => {
		const words = label.key !== undefined ? say(label.key) : label.words;
		return '<button type="button" data-value="' + escape(value) + '" aria-pressed="' + (read(prop) === value) + '"' + (color === undefined ? '>' + words : ' aria-label="' + words + '" title="' + words + '"><i style="--editor-swatch:' + color + '"></i>') + '</button>';
	}).join('') + '</div></div>';
	const stepRow = (key, count, index) => '<div class="editor-prop"><span>' + say(key) + '</span><span class="editor-stepper"><button type="button" data-editor-less="' + index + '" aria-label="' + say(key + '.less') + '"><i class="bi bi-dash-lg" aria-hidden="true"></i></button><b>' + count + '</b><button type="button" data-editor-more="' + index + '" aria-label="' + say(key + '.more') + '"><i class="bi bi-plus-lg" aria-hidden="true"></i></button></span></div>';
	const hint = (key) => '<p class="editor-card-hint">' + say(key) + '</p>';

	/** The tab of properties, for the element at a path of the block. */
	const props = (body, top, path) => {
		const node = nodeAt(top, path);
		const entry = node === undefined ? null : elementOf(node);
		const design = ed.formOpen(top);
		const list = design ? entry?.props ?? [] : [];
		const table = node?.matches?.('table') ? node : null;
		const steps = [];
		if (table !== null && ed.placeOpen(top)) {
			steps.push(stepRow('rows', rowsOf(table).length - (table.tHead === null ? 0 : 1), 0), stepRow('columns', columnsOf(table), 1));
		}
		let extra = '';
		if (table !== null && design) {
			extra += '<div class="editor-prop"><span>' + say('prop.head') + '</span><div class="editor-choice" role="group" aria-label="' + say('prop.head') + '" data-editor-head>' + [['1', 'value.yes'], ['', 'value.no']].map(([value, key]) => '<button type="button" data-value="' + value + '" aria-pressed="' + ((table.tHead !== null ? '1' : '') === value) + '">' + say(key) + '</button>').join('') + '</div></div>';
		}
		if (entry?.value && design) {
			extra += '<div class="editor-prop"><label for="' + ed.id + '-value">' + say('prop.value') + '</label><input class="form-control form-control-sm" id="' + ed.id + '-value" type="number" min="0" value="' + escape(node.getAttribute('value') ?? '') + '"></div>';
		}
		if (entry?.image && ed.wordsOpen(top)) {
			extra += '<div class="editor-prop editor-prop-wide"><label for="' + ed.id + '-alt">' + say('prop.alt') + '</label><input class="form-control form-control-sm" id="' + ed.id + '-alt" value="' + escape(node.getAttribute('alt') ?? '') + '">' + (ed.aiOpen() ? '<span class="hstack gap-4"><button class="btn btn-xs" type="button" data-editor-alt="ask"><i class="bi bi-stars" aria-hidden="true"></i>' + say('ai.alt') + '</button><button class="btn btn-xs btn-primary" type="button" data-editor-alt="keep" hidden>' + say('ai.alt.keep') + '</button></span>' : '') + '</div>';
		}
		if (entry?.glyph && design) {
			const has = [...node.classList].find((name) => name.startsWith('bi-'));
			extra += '<div class="editor-icons" role="group" aria-label="' + say('el.icon') + '">' + ICONS.map((name) => '<button type="button" data-editor-icon="' + name + '" aria-label="' + name + '" aria-pressed="' + (has === 'bi-' + name) + '"><i class="bi bi-' + name + '" aria-hidden="true"></i></button>').join('') + '</div>';
		}
		body.innerHTML = trusted((list.length + steps.length === 0 && extra === '' ? hint('card.none') : hint('card.try') + steps.join('') + extra + list.map((prop, index) => propRow(prop, index, (one) => readProp(node, one))).join('')));
		const again = () => {
			const now = blockNow();
			if (now !== null) {
				props(body, now, path);
			}
		};
		for (const seg of body.querySelectorAll('[data-editor-prop]')) {
			const prop = list[+seg.dataset.editorProp];
			for (const one of seg.querySelectorAll('button')) {
				choose(one, () => tryOn(blockNow(), (fresh) => writeProp(nodeAt(fresh, path), prop, one.dataset.value)), again);
			}
			seg.addEventListener('pointerleave', tryOff);
		}
		const stepper = (index, more) => {
			const now = blockNow();
			const t = nodeAt(now, path);
			if (index === 0) {
				if (more) {
					rowAdd(t, rowsOf(t).length - 1);
				} else if (!rowDrop(t, rowsOf(t).length - 1)) {
					now.remove();
					ed.note(say('last.table'));
				}
			} else if (more) {
				columnAdd(t, columnsOf(t) - 1);
			} else if (!columnDrop(t, columnsOf(t) - 1)) {
				now.remove();
				ed.note(say('last.table'));
			}
			if (now.isConnected) {
				ed.redraw(now);
			}
			ed.settle();
			ed.commit();
			if (blockNow() === null) {
				ed.closeCard();
			} else {
				again();
			}
		};
		for (const one of body.querySelectorAll('[data-editor-more]')) {
			one.onclick = () => stepper(+one.dataset.editorMore, true);
		}
		for (const one of body.querySelectorAll('[data-editor-less]')) {
			one.onclick = () => stepper(+one.dataset.editorLess, false);
		}
		for (const one of body.querySelectorAll('[data-editor-head] button')) {
			choose(one, () => tryOn(blockNow(), (fresh) => headToggle(nodeAt(fresh, path), one.dataset.value === '1')), again);
		}
		const head = body.querySelector('[data-editor-head]');
		head?.addEventListener('pointerleave', tryOff);
		const value = body.querySelector('#' + CSS.escape(ed.id + '-value'));
		if (value !== null) {
			value.oninput = () => {
				nodeAt(blockNow(), path).setAttribute('value', value.value);
				ed.commit(true);
			};
		}
		const alt = body.querySelector('#' + CSS.escape(ed.id + '-alt'));
		if (alt !== null) {
			alt.oninput = () => {
				nodeAt(blockNow(), path).setAttribute('alt', alt.value);
				ed.commit(true);
			};
			const asks = body.querySelector('[data-editor-alt="ask"]');
			const takes = body.querySelector('[data-editor-alt="keep"]');
			if (asks !== null) {
				asks.onclick = async () => {
					const now = blockNow();
					const words = await ed.aiAlt(nodeAt(now, path), now);
					if (words !== null && alt.isConnected) {
						alt.value = words;
						takes.hidden = false;
						takes.focus();
					}
				};
				takes.onclick = () => {
					nodeAt(blockNow(), path).setAttribute('alt', alt.value);
					takes.hidden = true;
					ed.commit();
				};
			}
		}
		for (const one of body.querySelectorAll('[data-editor-icon]')) {
			const set = (fresh) => {
				const glyph = nodeAt(fresh, path);
				glyph.classList.remove(...[...glyph.classList].filter((name) => name.startsWith('bi-')));
				glyph.classList.add('bi-' + one.dataset.editorIcon);
			};
			choose(one, () => tryOn(blockNow(), set), again);
		}
		body.querySelector('.editor-icons')?.addEventListener('pointerleave', tryOff);
	};

	/** The tab of forms: the same words as a list, cards, an accordion, steps or a table. */
	const forms = (body, top) => {
		const now = formNow(top);
		const list = now === null ? [] : Object.keys(FORMS);
		body.innerHTML = trusted(list.length === 0 ? hint('card.form.none') : hint('card.form') + '<div role="group" aria-label="' + say('tab.form') + '">' + list.map((name) => '<button class="menu-item" type="button" data-form="' + name + '" aria-pressed="' + (now === name) + '"><i class="bi bi-' + FORMS[name].icon + '" aria-hidden="true"></i>' + say('form.' + name) + '</button>').join('') + '</div>');
		for (const one of body.querySelectorAll('[data-form]')) {
			choose(one, () => tryOn(blockNow(), (fresh) => toForm(fresh, one.dataset.form, ed.doc)), () => {
				const live = blockNow();
				if (live !== null) {
					forms(body, live);
				}
			});
		}
		body.firstElementChild?.nextElementSibling?.addEventListener('pointerleave', tryOff);
	};

	/** The tab of history: this block's earlier versions, tried on, one taken back alone. */
	const past = (body, top) => {
		const id = top.getAttribute('data-block');
		const now = unmark(top.cloneNode(true), true).outerHTML;
		const list = (ed.versions.get(id) ?? []).filter((one) => one.html !== now).reverse();
		const when = (at) => at instanceof Date ? at.toLocaleTimeString(ed.config.lang, {hour: '2-digit', minute: '2-digit'}) : String(at);
		const words = (html) => {
			const box = document.createElement('template');
			box.innerHTML = trusted(html);
			return box.content.textContent.trim().slice(0, 100);
		};
		body.innerHTML = trusted(list.length === 0 ? hint('card.past.none') : hint('card.past') + '<div role="group" aria-label="' + say('tab.past') + '">' + list.map((one, index) => '<button class="menu-item editor-past" type="button" data-version="' + index + '"><span class="text-muted fs-12">' + escape(when(one.at)) + (one.by ? ' · ' + escape(one.by) : '') + '</span><span>' + escape(words(one.html)) + '</span></button>').join('') + '</div>');
		if (!ed.wordsOpen(top)) {
			return;
		}
		for (const one of body.querySelectorAll('[data-version]')) {
			choose(one, () => tryOn(blockNow(), (fresh) => {
				const box = document.createElement('template');
				box.innerHTML = trusted(clean(list[+one.dataset.version].html));
				const made = ed.doc.importNode(box.content.firstElementChild, true);
				fresh.replaceWith(made);
				return made;
			}), () => {
				ed.note(say('past.back'));
				const live = blockNow();
				if (live !== null) {
					past(body, live);
				}
			});
		}
		body.querySelector('[role="group"]')?.addEventListener('pointerleave', tryOff);
	};

	/** The tab of protection. */
	const access = (body, top) => {
		const levels = [['', 'lock.open'], ['form', 'lock.form'], ['all', 'lock.all']];
		const now = top.getAttribute('data-lock') ?? '';
		body.innerHTML = trusted(hint('card.lock') + levels.map(([value, key]) => '<button class="menu-item editor-past" type="button" data-lock-level="' + value + '" aria-pressed="' + (now === value) + '"><span>' + say(key) + '</span><span class="text-muted fs-12">' + say(key + '.say') + '</span></button>').join(''));
		for (const one of body.querySelectorAll('[data-lock-level]')) {
			one.onclick = () => {
				const level = one.dataset.lockLevel;
				if (level === '') {
					top.removeAttribute('data-lock');
				} else {
					top.setAttribute('data-lock', level);
				}
				ed.redraw(top);
				ed.commit();
				const live = blockNow();
				if (live !== null) {
					access(body, live);
				}
			};
		}
	};

	/** The tab of HTML, for an expert. */
	const html = (body, top) => {
		const copy = unmark(top.cloneNode(true), false);
		body.innerHTML = trusted(hint('card.html') + '<textarea class="form-control font-monospace fs-12" id="' + ed.id + '-html" rows="10" spellcheck="false" aria-label="' + say('tab.html') + '">' + escape(copy.outerHTML) + '</textarea><div class="hstack gap-8"><button class="btn btn-primary btn-sm" type="button" data-editor-apply>' + say('apply') + '</button><span class="editor-card-note" role="status"></span></div>');
		body.querySelector('[data-editor-apply]').onclick = async () => {
			const value = body.querySelector('textarea').value;
			const notes = await ed.checkHTML(value);
			const parsed = new DOMParser().parseFromString(trusted('<!doctype html><body>' + clean(value)), 'text/html').body.firstElementChild;
			if (parsed === null) {
				return;
			}
			const made = ed.doc.importNode(parsed, true);
			made.setAttribute('data-block', top.getAttribute('data-block'));
			if (top.hasAttribute('data-lock')) {
				made.setAttribute('data-lock', top.getAttribute('data-lock'));
			}
			drawTop(made, ed.wordsOpen(made));
			top.replaceWith(made);
			ed.settle();
			ed.commit();
			body.querySelector('.editor-card-note').textContent = notes.length === 0 ? say('html.fine') : notes.join(' ');
			top = made;
		};
	};

	/** The tab of what else a block can do. */
	const more = (body, top) => {
		body.innerHTML = trusted([['copy', 'files', 'more.copy'], ['preview', 'eye', 'block.preview'], ['up', 'arrow-up', 'part.up'], ['down', 'arrow-down', 'part.down'], ['drop', 'trash3', 'part.drop']].map(([act, icon, key]) => '<button class="menu-item" type="button" data-more="' + act + '"><i class="bi bi-' + icon + '" aria-hidden="true"></i>' + say(key) + '</button>').join('') + '<p class="editor-card-hint">' + say('more.keys') + '</p>');
		for (const one of body.querySelectorAll('[data-more]')) {
			one.onclick = () => {
				const act = one.dataset.more;
				ed.closeCard();
				if (act === 'copy') {
					ed.copyTop(top);
				} else if (act === 'preview') {
					ed.preview(top);
				} else if (act === 'drop') {
					top.remove();
					ed.settle();
					ed.commit();
					ed.note(say('dropped'));
				} else {
					ed.moveBy(top, act === 'up' ? -1 : 1);
				}
			};
		}
	};

	const TABS = {props, form: forms, past, access, html, more};

	const render = () => {
		const top = blockNow();
		if (top === null) {
			ed.closeCard();
			return;
		}
		const entry = open.path.length > 0 ? elementOf(nodeAt(top, open.path)) : elementOf(top);
		const tabs = open.path.length > 0 ? ['props'] : [ed.formOpen(top) ? 'props' : null, ed.formOpen(top) && ed.placeOpen(top) ? 'form' : null, 'past', ed.may('lock') ? 'access' : null, ed.may('html') ? 'html' : null, ed.placeOpen(top) ? 'more' : null].filter(Boolean);
		if (!tabs.includes(open.tab)) {
			open.tab = tabs[0];
		}
		card.innerHTML = trusted('<div class="editor-card-head"><strong>' + say('el.' + (entry?.id ?? 'block')) + '</strong>' + (top.hasAttribute('data-lock') ? '<span class="badge badge-subtle-warning badge-sm">' + say('lock.' + top.getAttribute('data-lock')) + '</span>' : '') + '<button class="btn-close" type="button" aria-label="' + escape(say('close')) + '"></button></div>' + (tabs.length > 1 ? '<div class="editor-card-tabs" role="group" aria-label="' + say('card') + '">' + tabs.map((key) => '<button type="button" data-tab="' + key + '" aria-pressed="' + (key === open.tab) + '">' + say('tab.' + key) + '</button>').join('') + '</div>' : '') + '<div class="editor-card-body"></div>');
		card.querySelector('.btn-close').onclick = () => {
			ed.closeCard();
			ed.focus();
		};
		for (const one of card.querySelectorAll('[data-tab]')) {
			one.onclick = () => {
				tryOff();
				open.tab = one.dataset.tab;
				render();
			};
		}
		TABS[open.tab](card.querySelector('.editor-card-body'), top, open.path);
		ed.placeBeside(card, top);
	};

	/** Stands a panel beside the editor, or as a sheet that leaves the block seen, so it never covers what it changes. */
	ed.placeBeside = (panel, top) => {
		const box = ed.box.getBoundingClientRect();
		const width = panel.offsetWidth;
		const rect = top.getBoundingClientRect();
		const frame = ed.frame.getBoundingClientRect();
		const end = ed.config.dir === 'rtl' ? box.left - width - 8 : box.right + 8;
		if (end >= 8 && end + width <= innerWidth - 8) {
			panel.style.left = end + 'px';
			panel.style.top = Math.max(8, Math.min(rect.top + frame.top - 40, innerHeight - panel.offsetHeight - 8)) + 'px';
		} else {
			top.scrollIntoView({block: 'nearest'});
			const shown = top.getBoundingClientRect();
			const start = shown.top + ed.frame.getBoundingClientRect().top;
			const foot = innerHeight - panel.offsetHeight - 8;
			panel.style.left = Math.max(8, (innerWidth - width) / 2) + 'px';
			panel.style.top = Math.max(8, start + shown.height > foot && start > panel.offsetHeight + 16 ? 8 : foot) + 'px';
		}
	};

	ed.openCard = (top, tab = 'props', path = []) => {
		if (top.hasAttribute('data-editor-review')) {
			return;
		}
		ed.closeCard();
		open = {id: top.getAttribute('data-block'), tab, path};
		card.showPopover();
		render();
		card.querySelector('.editor-card-body button, .editor-card-body input, .editor-card-body textarea, .btn-close')?.focus({preventScroll: true});
	};
	ed.closeCard = () => {
		tryOff();
		open = null;
		if (card.matches(':popover-open')) {
			card.hidePopover();
		}
	};
	ed.cardOpen = () => open !== null;
	ed.cardAgain = () => {
		if (open !== null) {
			render();
		}
	};
	card.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') {
			event.stopPropagation();
			ed.closeCard();
			ed.focus();
		} else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			const items = [...card.querySelectorAll('.editor-card-body button')];
			const at = items.indexOf(document.activeElement);
			if (at !== -1) {
				event.preventDefault();
				items[(at + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
			}
		}
	});

	/** The link dialog of a part: its address and whether it opens anew. */
	ed.editLink = async (node) => {
		const values = await ed.ask(say('link'), ed.fieldHTML('href', 'link.href', node.getAttribute('href') || '', 'url') + ed.checkField('blank', 'link.blank', node.target === '_blank'));
		if (values === null) {
			return;
		}
		const href = values.href.trim();
		if (href !== '' && safe(href)) {
			node.setAttribute('href', href);
		}
		if (values.blank) {
			node.target = '_blank';
			node.rel = 'noopener';
		} else {
			node.removeAttribute('target');
			node.removeAttribute('rel');
		}
		ed.commit();
	};
};

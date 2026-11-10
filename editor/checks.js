// REDZ.UI editor, the foot and the checks before publishing: what a reader, a screen reader or a search engine would stumble on, each with a way to it,
// and the count of words, by the language's own word breaks, so Thai and Burmese count too. Text an AI wrote that nobody checked, a price typed by hand
// where a fact stands, and translations left behind are stumbles too.
import {say, sayCount} from './words.js';
import {escape, trusted} from './clean.js';
import {charsOf, rangeOf, slotsOf} from './plain.js';

const LONG = 320;

/** Where a fact's words stand typed by hand in a slot, as a place in its plain words. */
const typedAt = (text, words) => {
	const at = text.indexOf(words);
	const beside = (one) => one !== undefined && /\d/.test(one);
	return at === -1 || beside(text[at - 1]) || beside(text[at + words.length]) ? -1 : at;
};

/** What is wrong in the text, as {top, key, args, fix}. */
const issues = (ed) => {
	const out = [];
	let level = 1;
	const vague = say('check.vague.words').toLowerCase().split(',').map((one) => one.trim());
	const facts = ed.may('facts') ? [...ed.facts.values()].filter((one) => /\d/.test(one.text)) : [];
	for (const top of ed.doc.body.children) {
		const heading = /^H([1-6])$/.exec(top.tagName);
		if (heading !== null) {
			const now = +heading[1];
			if (top.textContent.trim() === '') {
				out.push({top, key: 'check.empty'});
			} else if (now > level + 1) {
				const tag = 'h' + (level + 1);
				out.push({top, key: 'check.level', args: {from: level, to: now}, fix: ed.formOpen(top) ? () => ed.retag(top, tag) : null});
			}
			level = now;
		}
		for (const image of top.querySelectorAll('img:not([alt]), img[alt=""]')) {
			out.push({top, key: 'check.alt', node: image});
		}
		if (top.matches('img:not([alt]), img[alt=""]')) {
			out.push({top, key: 'check.alt'});
		}
		for (const link of top.querySelectorAll('a')) {
			if (vague.includes(link.textContent.trim().toLowerCase())) {
				out.push({top, key: 'check.vague', args: {words: link.textContent.trim()}});
			}
		}
		if (top.tagName === 'P' && top.textContent.length > LONG) {
			out.push({top, key: 'check.long'});
		}
		if (top.tagName === 'TABLE' && top.tHead === null) {
			out.push({top, key: 'check.head'});
		}
		if ((top.getAttribute('data-by') === 'ai' || top.getAttribute('data-by') === 'mt') && !top.hasAttribute('data-checked')) {
			out.push({top, key: 'check.ai', fix: ed.may('review') ? () => top.setAttribute('data-checked', ed.config.person?.name ?? '1') : null});
		}
		for (const one of top.querySelectorAll('[data-editor-unknown]')) {
			out.push({top, key: 'check.fact.unknown', args: {key: one.getAttribute('value')}});
		}
		if (ed.wordsOpen(top)) {
			for (const fact of facts) {
				for (const slot of slotsOf(top)) {
					const {text, chars} = charsOf(slot);
					const words = String(fact.text).replace(/\s+/g, ' ');
					const at = typedAt(text, words);
					if (at !== -1) {
						out.push({top, key: 'check.fact', args: {words, label: fact.label}, fix: () => ed.putFact(fact.key, rangeOf(slot, chars, at, at + words.length))});
					}
				}
			}
		}
	}
	const pair = ed.pairCounts();
	if (pair !== null && pair.stale + pair.missing > 0) {
		out.push({key: 'check.pair', args: {stale: pair.stale, missing: pair.missing}});
	}
	return out;
};

/** Gives the editor its foot: the count of words, the tools, the panels they open, and the checks. */
export const checksOf = (ed) => {
	const foot = Object.assign(document.createElement('div'), {className: 'editor-foot'});
	const count = Object.assign(document.createElement('span'), {className: 'editor-count'});
	count.setAttribute('role', 'status');
	const tools = Object.assign(document.createElement('span'), {className: 'editor-foot-tools'});
	foot.append(count, tools);
	ed.box.append(foot);
	ed.footBox = foot;
	ed.foot = tools;

	const button = (key, icon, act) => {
		const one = Object.assign(document.createElement('button'), {type: 'button', className: 'btn btn-text btn-xs'});
		one.dataset.editorFoot = key;
		one.innerHTML = trusted('<i class="bi bi-' + icon + '" aria-hidden="true"></i>' + escape(say(key)));
		if (act !== null) {
			one.addEventListener('click', act);
		}
		return one;
	};

	/** A button of the foot, before the checks. */
	ed.footButton = (key, icon, act) => tools.insertBefore(button(key, icon, act), tools.querySelector('[data-editor-foot="check"]'));

	/** A panel the foot opens: a card above the foot, named by a key. */
	ed.panel = (className, key) => {
		const panel = Object.assign(document.createElement('div'), {className: 'editor-card ' + className});
		panel.popover = 'auto';
		panel.setAttribute('role', 'dialog');
		panel.setAttribute('aria-label', say(key));
		panel.innerHTML = trusted('<div class="editor-card-head"><strong>' + escape(say(key)) + '</strong><button class="btn-close" type="button" aria-label="' + escape(say('close')) + '"></button></div><div class="editor-card-body"></div>');
		ed.box.append(panel);
		const close = () => panel.hidePopover();
		panel.querySelector('.btn-close').onclick = close;
		return {
			panel,
			close,
			body: panel.querySelector('.editor-card-body'),
			open: () => {
				if (!panel.matches(':popover-open')) {
					panel.showPopover();
				}
				const box = ed.box.getBoundingClientRect();
				panel.style.left = Math.max(8, Math.min(box.right - panel.offsetWidth, innerWidth - panel.offsetWidth - 8)) + 'px';
				panel.style.top = Math.max(8, Math.min(box.bottom, innerHeight) - panel.offsetHeight - 44) + 'px';
			},
		};
	};

	const panel = ed.panel('editor-checks', 'check');
	const open = tools.appendChild(button('check', 'clipboard-check', null));
	const badge = open.appendChild(Object.assign(document.createElement('span'), {className: 'badge badge-sm'}));

	const words = () => [...new Intl.Segmenter(ed.config.lang, {granularity: 'word'}).segment(ed.doc.body.textContent)].filter((one) => one.isWordLike).length;

	ed.changed = () => {
		const many = words();
		count.textContent = sayCount('words', many) + ' · ' + say('minutes', {minutes: Math.max(1, Math.round(many / 180))});
		ed.pairAgain();
		badge.textContent = issues(ed).length;
	};

	const render = () => {
		const list = issues(ed);
		panel.body.innerHTML = trusted(list.length === 0 ? '<p class="editor-card-hint">' + escape(say('check.fine')) + '</p>' : list.map((one, index) => '<div class="editor-issue"><i class="bi bi-exclamation-triangle" aria-hidden="true"></i><span>' + escape(say(one.key, one.args)) + '</span><span class="hstack gap-4">' + (one.top ? '<button class="btn btn-xs" type="button" data-show="' + index + '">' + escape(say('check.show')) + '</button>' : '') + (one.fix ? '<button class="btn btn-xs" type="button" data-fix="' + index + '">' + escape(say('check.fix')) + '</button>' : '') + '</span></div>').join(''));
		for (const one of panel.body.querySelectorAll('[data-show]')) {
			one.onclick = () => {
				panel.close();
				list[+one.dataset.show].top.scrollIntoView({block: 'center'});
				ed.pick(list[+one.dataset.show].top);
			};
		}
		for (const one of panel.body.querySelectorAll('[data-fix]')) {
			one.onclick = () => {
				list[+one.dataset.fix].fix();
				ed.commit();
				render();
			};
		}
	};
	ed.openChecks = () => {
		render();
		panel.open();
	};
	open.addEventListener('click', () => {
		if (panel.panel.matches(':popover-open')) {
			panel.close();
		} else {
			ed.openChecks();
		}
	});
};

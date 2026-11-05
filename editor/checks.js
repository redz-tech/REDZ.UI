// REDZ.UI editor, the checks before publishing: what a reader, a screen reader or a search engine would stumble on, each with a way to it, and
// the count of words, by the language's own word breaks, so Thai and Burmese count too.
import {say, sayCount} from './words.js';
import {escape} from './clean.js';

const LONG = 320;

/** What is wrong in the text, as {top, key, args, fix}. */
const issues = (ed) => {
	const out = [];
	let level = 1;
	const vague = say('check.vague.words').toLowerCase().split(',').map((one) => one.trim());
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
	}
	return out;
};

/** Gives the editor its foot: the count of words and the checks. */
export const checksOf = (ed) => {
	const foot = Object.assign(document.createElement('div'), {className: 'editor-foot'});
	const count = Object.assign(document.createElement('span'), {className: 'editor-count'});
	count.setAttribute('role', 'status');
	const open = Object.assign(document.createElement('button'), {type: 'button', className: 'btn btn-text btn-xs'});
	const panel = Object.assign(document.createElement('div'), {className: 'editor-card editor-checks'});
	panel.popover = 'auto';
	panel.setAttribute('role', 'dialog');
	panel.setAttribute('aria-label', say('check'));
	foot.append(count, open);
	ed.box.append(foot, panel);

	const words = () => [...new Intl.Segmenter(ed.config.lang, {granularity: 'word'}).segment(ed.doc.body.textContent)].filter((one) => one.isWordLike).length;

	ed.changed = () => {
		const many = words();
		count.textContent = sayCount('words', many) + ' · ' + say('minutes', {minutes: Math.max(1, Math.round(many / 180))});
		open.innerHTML = '<i class="bi bi-clipboard-check" aria-hidden="true"></i>' + escape(say('check')) + ' <span class="badge badge-sm">' + issues(ed).length + '</span>';
	};

	const render = () => {
		const list = issues(ed);
		panel.innerHTML = '<div class="editor-card-head"><strong>' + escape(say('check')) + '</strong><button class="btn-close" type="button" aria-label="' + escape(say('close')) + '"></button></div><div class="editor-card-body">' + (list.length === 0 ? '<p class="editor-card-hint">' + escape(say('check.fine')) + '</p>' : list.map((one, index) => '<div class="editor-issue"><i class="bi bi-exclamation-triangle" aria-hidden="true"></i><span>' + escape(say(one.key, one.args)) + '</span><span class="hstack gap-4"><button class="btn btn-xs" type="button" data-show="' + index + '">' + escape(say('check.show')) + '</button>' + (one.fix ? '<button class="btn btn-xs" type="button" data-fix="' + index + '">' + escape(say('check.fix')) + '</button>' : '') + '</span></div>').join('')) + '</div>';
		panel.querySelector('.btn-close').onclick = () => panel.hidePopover();
		for (const one of panel.querySelectorAll('[data-show]')) {
			one.onclick = () => {
				panel.hidePopover();
				list[+one.dataset.show].top.scrollIntoView({block: 'center'});
				ed.pick(list[+one.dataset.show].top);
			};
		}
		for (const one of panel.querySelectorAll('[data-fix]')) {
			one.onclick = () => {
				list[+one.dataset.fix].fix();
				ed.commit();
				render();
			};
		}
	};
	open.addEventListener('click', () => {
		render();
		panel.togglePopover();
		const box = ed.box.getBoundingClientRect();
		panel.style.left = Math.max(8, Math.min(box.right - panel.offsetWidth, innerWidth - panel.offsetWidth - 8)) + 'px';
		panel.style.top = Math.max(8, box.bottom - panel.offsetHeight - 44) + 'px';
	});
};

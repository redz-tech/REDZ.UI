// REDZ.UI editor, the seam of the AI: options.ai is the host's, async, and no key is ever in a page. It gets a task of plain words, facts as tokens, and
// answers plain words or flat blocks; nothing lands without the review, a refusal is said as what it is, and an answer that comes back after a person
// changed the block is left out, because the AI never overwrites what someone just wrote. It acts with the person's rights: a closed block is not sent.
import {say} from './words.js';
import {escape, trusted} from './clean.js';
import {blockId} from './marks.js';
import {elementOf} from './props.js';
import {plainOf, slotsOf, tokensIn, wordsHash} from './plain.js';
import {fromFlat} from './flat.js';

const HOW = [['shorter', 'arrows-collapse'], ['simpler', 'type'], ['warmer', 'emoji-smile'], ['fix', 'check2-circle']];

/** Gives the editor the AI's seam. */
export const aiOf = (ed) => {
	const running = new Set();
	const block = (id) => ed.doc.querySelector('[data-block="' + CSS.escape(id) + '"]');
	const state = Object.assign(document.createElement('span'), {className: 'editor-working', hidden: true});
	state.innerHTML = trusted('<span class="spinner-border" aria-hidden="true"></span><span role="status"></span><button class="btn btn-text btn-xs" type="button">' + say('ai.stop') + '</button>');
	ed.foot.prepend(state);
	state.querySelector('button').onclick = () => {
		for (const stop of running) {
			stop.abort();
		}
	};

	ed.aiOpen = () => ed.may('ai') && typeof ed.config.ai === 'function';

	/** The words of a block as a task sends them. */
	ed.aiBlock = (top) => ({id: top.getAttribute('data-block'), hash: wordsHash(top), element: elementOf(top)?.id ?? top.tagName.toLowerCase(), fields: slotsOf(top).map(plainOf)});

	/** What the AI may work on: the blocks under the selection, or the chosen one, that this person may write in. */
	ed.aiTargets = () => {
		const picked = ed.sel === null ? null : block(ed.sel.id);
		const tops = ed.tops();
		return (tops.length === 0 && picked !== null ? [picked] : tops).filter((top) => slotsOf(top).some((slot) => plainOf(slot) !== '') && ed.wordsOpen(top) && !top.hasAttribute('data-editor-review'));
	};

	const busy = (ids, on) => {
		for (const id of ids) {
			block(id)?.toggleAttribute('data-editor-busy', on);
		}
	};

	/** Sends a task to the host; answers what came, or null after saying why not. */
	ed.aiAsk = async (task, progress) => {
		const stop = new AbortController();
		const ids = (task.blocks ?? []).map((one) => one.id);
		const sent = {id: blockId(), lang: ed.config.lang, ...task};
		running.add(stop);
		busy(ids, true);
		state.hidden = false;
		state.querySelector('[role="status"]').textContent = say('ai.working');
		let answer = null;
		try {
			answer = await ed.config.ai(sent, {signal: stop.signal, progress: (partial) => {
				if (!stop.signal.aborted) {
					progress?.(partial);
				}
			}});
		} catch (error) {
			if (!stop.signal.aborted && error?.name !== 'AbortError') {
				ed.note(say('ai.failed'));
			}
			return null;
		} finally {
			running.delete(stop);
			busy(ids, false);
			state.hidden = running.size === 0;
		}
		if (stop.signal.aborted || answer === null || answer === undefined) {
			return null;
		}
		if (answer.refusal !== undefined) {
			ed.note(typeof answer.refusal === 'string' && answer.refusal !== '' ? say('ai.refused.why', {why: answer.refusal}) : say('ai.refused'));
			return null;
		}
		return {...answer, task: sent};
	};
	ed.aiStop = state.querySelector('button').onclick;

	/** The answers that may be shown: of blocks unchanged since they were sent, all their fields there and every fact kept. */
	ed.aiTaken = (sent, blocks, hashes = (one) => (block(one.id) === null ? null : wordsHash(block(one.id)))) => {
		const out = [];
		const left = new Set();
		for (const one of sent) {
			const got = Array.isArray(blocks) ? blocks.find((each) => each?.id === one.id) : undefined;
			if (hashes(one) !== one.hash) {
				left.add('ai.moved');
			} else if (!Array.isArray(got?.fields) || got.fields.length !== one.fields.length || got.fields.some((text) => typeof text !== 'string')) {
				left.add('ai.shape');
			} else if (got.fields.some((text, index) => tokensIn(text) !== tokensIn(one.fields[index]))) {
				left.add('ai.lost');
			} else {
				out.push({id: one.id, fields: got.fields});
			}
		}
		for (const key of left) {
			ed.note(say(key));
		}
		return out;
	};

	/** Rewrites what the person chose, by one of the buttons or their own words. */
	ed.aiRewrite = async (how, words = '') => {
		if (!ed.aiOpen()) {
			return;
		}
		if (ed.reviewing()) {
			ed.note(say('review.first'));
			return;
		}
		const tops = ed.aiTargets();
		if (tops.length === 0) {
			ed.note(say('ai.where'));
			return;
		}
		ed.commit();
		const blocks = tops.map(ed.aiBlock);
		const answer = await ed.aiAsk({kind: 'rewrite', how, words, blocks});
		if (answer !== null) {
			const drafts = ed.aiTaken(blocks, answer.blocks);
			if (drafts.length > 0) {
				ed.review(drafts, {task: answer.task, answer});
			}
		}
	};

	/** Writes new blocks from a person's words: flat blocks, written by the catalog, into the review. */
	ed.aiWrite = async () => {
		if (!ed.aiOpen()) {
			return;
		}
		if (ed.reviewing()) {
			ed.note(say('review.first'));
			return;
		}
		const near = ed.topNow();
		const values = await ed.ask(say('ai.write'), '<div class="vstack gap-4"><label class="form-label" for="' + ed.id + '-write">' + escape(say('ai.write.what')) + '</label><textarea class="form-control" id="' + ed.id + '-write" name="words" rows="4" required></textarea></div>');
		if (values === null || values.words.trim() === '') {
			return;
		}
		const answer = await ed.aiAsk({kind: 'write', words: values.words.trim(), facts: [...ed.facts.values()].map(({key, label}) => ({key, label}))});
		if (answer !== null) {
			const added = fromFlat(answer.blocks, ed.facts);
			if (answer.task.lang !== ed.config.lang) {
				ed.note(say('ai.moved'));
			} else if (added.length === 0) {
				ed.note(say('ai.shape'));
			} else {
				ed.review([], {task: answer.task, answer, added: [{html: added.join(''), near: near?.isConnected ? near : null}]});
			}
		}
	};

	/** Suggests an image's words; a person keeps them. */
	ed.aiAlt = async (image, top) => {
		const answer = await ed.aiAsk({kind: 'alt', src: image.getAttribute('src') ?? '', blocks: []});
		return typeof answer?.text === 'string' && image.isConnected && top.isConnected ? answer.text : null;
	};

	const list = Object.assign(document.createElement('div'), {className: 'menu', id: ed.id + '-ai'});
	list.popover = 'auto';
	list.setAttribute('role', 'menu');
	list.setAttribute('aria-label', say('ai'));
	ed.box.append(list);
	ed.aiCommands = () => [
		...HOW.map(([how, icon]) => ({label: say('ai.' + how), icon, run: () => ed.aiRewrite(how)})),
		{label: say('pad'), icon: 'sliders', run: ed.openPad},
		{label: say('ai.write'), icon: 'pencil', run: ed.aiWrite},
		{label: say('ask'), icon: 'chat-dots', run: ed.openAsk},
	];
	ed.aiMenuId = list.id;
	const button = ed.footButton('ai', 'stars', null);
	button.setAttribute('commandfor', list.id);
	button.setAttribute('command', 'toggle-popover');
	button.setAttribute('aria-haspopup', 'menu');
	ed.aiPaint = () => {
		button.hidden = !ed.aiOpen();
		for (const one of ed.box.querySelectorAll('[data-editor-bubble="ai"]')) {
			one.hidden = !ed.aiOpen();
		}
	};
	ed.aiBuild = () => {
		ed.aiPaint();
		list.replaceChildren(...ed.aiCommands().map((one) => {
			const item = Object.assign(document.createElement('button'), {type: 'button', className: 'menu-item', innerHTML: trusted('<i class="bi bi-' + one.icon + '" aria-hidden="true"></i>' + escape(one.label))});
			item.setAttribute('role', 'menuitem');
			item.addEventListener('click', () => {
				list.hidePopover();
				one.run();
			});
			return item;
		}));
	};
};

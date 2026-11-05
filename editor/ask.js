// REDZ.UI editor, the AI's reading: what a visitor's assistant would answer from this page and nothing else, asked while the page is being written.
// A question it cannot answer from the text is a gap in the text.
import {say} from './words.js';
import {escape} from './clean.js';
import {plainOf, slotsOf} from './plain.js';

const QUESTIONS = ['ask.what', 'ask.price', 'ask.when'];

/** Gives the editor the page's reading. */
export const askOf = (ed) => {
	const panel = ed.panel('editor-ask', 'ask');
	let stop = null;

	/** The page as a visitor reads it: every fact as its words. */
	const pageText = () => [...ed.doc.body.children].flatMap((node) => {
		const top = ed.held(ed.kept(node));
		return top === null ? [] : slotsOf(top).map(plainOf);
	}).filter(Boolean).join('\n').replace(/⟦([\w.-]+)⟧/g, (token, key) => ed.facts.get(key)?.text ?? '');

	const ask = async (question) => {
		const out = panel.body.querySelector('.editor-ask-answer');
		stop?.();
		let mine = false;
		stop = () => {
			mine = true;
		};
		out.textContent = say('ask.reading');
		const answer = await ed.aiAsk({kind: 'read', question, text: pageText()}, (partial) => {
			if (!mine && typeof partial?.text === 'string') {
				out.textContent = partial.text;
			}
		});
		if (mine) {
			return;
		}
		out.textContent = typeof answer?.text === 'string' ? answer.text : say('ask.none');
	};

	const render = () => {
		panel.body.innerHTML = '<p class="editor-card-hint">' + escape(say('ask.hint')) + '</p><div class="hstack flex-wrap gap-4">' + QUESTIONS.map((key) => '<button class="btn btn-xs" type="button" data-ask="' + key + '">' + escape(say(key)) + '</button>').join('') + '</div><form class="hstack gap-4"><input class="form-control form-control-sm" type="text" name="question" aria-label="' + escape(say('ask.question')) + '" placeholder="' + escape(say('ask.question')) + '" autocomplete="off"><button class="btn btn-sm btn-primary" type="submit">' + escape(say('ask.go')) + '</button></form><div class="editor-ask-answer" role="status"></div>';
		for (const one of panel.body.querySelectorAll('[data-ask]')) {
			one.onclick = () => ask(say(one.dataset.ask));
		}
		panel.body.querySelector('form').onsubmit = (event) => {
			event.preventDefault();
			const question = event.currentTarget.elements.question.value.trim();
			if (question !== '') {
				ask(question);
			}
		};
	};
	ed.openAsk = () => {
		if (!ed.aiOpen()) {
			return;
		}
		render();
		panel.open();
		panel.body.querySelector('input').focus();
	};
};

// REDZ.UI editor, live facts: a price, a date, a phone number written once and shown in every place, <data value="KEY">. The words keep the key, so
// a price that changes neither touches a translation nor leaves it stale; an AI and a translator see a token they cannot change.
import {say} from './words.js';
import {escape} from './clean.js';
import {fieldAt, topAt} from './caret.js';

const ZERO = String.fromCodePoint(0x200b);

/** Gives the editor its facts. */
export const factsOf = (ed) => {
	ed.facts = new Map();

	/** Asks the host for the facts of the text's language. */
	ed.loadFacts = () => {
		const given = ed.config.facts;
		const take = (list) => {
			ed.facts = new Map(list.map((one) => [one.key, one]));
			ed.factsPaint();
		};
		if (typeof given === 'function') {
			return new Promise((done) => done(given(ed.config.lang))).then(take, () => take([]));
		}
		take(given ?? []);
		return null;
	};

	/** A fact as an element of the text. */
	ed.factNode = (key) => {
		const node = ed.doc.createElement('data');
		node.setAttribute('value', key);
		node.setAttribute('contenteditable', 'false');
		node.textContent = ed.facts.get(key)?.text ?? key;
		return node;
	};

	/** Shows every fact of the text as it stands now, and marks the ones the page does not know. */
	ed.drawFacts = () => {
		for (const node of ed.doc.body.querySelectorAll('data[value]')) {
			const fact = ed.facts.get(node.getAttribute('value'));
			node.toggleAttribute('data-editor-unknown', fact === undefined);
			if (fact !== undefined && node.textContent !== String(fact.text)) {
				node.textContent = fact.text;
			}
		}
	};

	/** Puts a fact at the caret, in place of what is selected, or of a given range. */
	ed.putFact = (key, range) => {
		const doc = ed.doc;
		const selection = doc.getSelection();
		const top = topAt(doc);
		if (range === undefined && (selection.rangeCount === 0 || top === null)) {
			ed.note(say('fact.where'));
			return;
		}
		if (top !== null && !ed.wordsOpen(top)) {
			ed.note(say('lock.refused'));
			return;
		}
		const place = range ?? selection.getRangeAt(0);
		const after = doc.createTextNode(ZERO);
		place.deleteContents();
		place.insertNode(after);
		place.insertNode(ed.factNode(key));
		after.parentNode.normalize();
		ed.focusIn(fieldAt(doc) ?? doc.body);
		selection.collapse(after, 1);
		ed.commit();
	};

	/** Backspace right after a fact takes it whole, the invisible letter that holds the caret with it. */
	ed.factBack = () => {
		const selection = ed.doc.getSelection();
		const node = selection.anchorNode;
		if (!selection.isCollapsed || node?.nodeType !== Node.TEXT_NODE || selection.anchorOffset !== 1 || node.data[0] !== ZERO || !node.previousSibling?.matches?.('data[value]')) {
			return false;
		}
		node.previousSibling.remove();
		node.deleteData(0, 1);
		ed.commit();
		return true;
	};

	const button = ed.footButton('facts', 'tag', () => ed.openFacts());
	const uses = (key) => ed.doc.body.querySelectorAll('data[value="' + CSS.escape(key) + '"]').length;
	const panel = ed.panel('editor-facts', 'facts');

	const render = () => {
		const open = ed.may('facts');
		const edits = open && typeof ed.config.onFact === 'function';
		const rows = [...ed.facts.values()].map((one, index) => '<div class="editor-fact"><label for="' + ed.id + '-fact-' + index + '">' + escape(one.label) + ' <span class="text-muted">· ' + escape(say('fact.uses', {count: uses(one.key)})) + '</span></label><span class="hstack gap-4"><input class="form-control form-control-sm" id="' + ed.id + '-fact-' + index + '" data-fact="' + escape(one.key) + '" value="' + escape(one.text) + '"' + (edits && one.editable !== false ? '' : ' readonly') + '>' + (open ? '<button class="btn btn-xs" type="button" data-fact-put="' + escape(one.key) + '">' + escape(say('fact.put')) + '</button>' : '') + '</span></div>').join('');
		panel.body.innerHTML = '<p class="editor-card-hint">' + escape(say(ed.facts.size === 0 ? 'fact.none' : 'fact.hint')) + '</p>' + rows;
		for (const one of panel.body.querySelectorAll('[data-fact-put]')) {
			one.onclick = () => {
				panel.close();
				ed.putFact(one.dataset.factPut);
			};
		}
		for (const one of panel.body.querySelectorAll('input[data-fact]:not([readonly])')) {
			one.onchange = async () => {
				const fact = ed.facts.get(one.dataset.fact);
				const taken = await ed.config.onFact(fact.key, one.value);
				if (taken === false) {
					one.value = fact.text;
					ed.note(say('fact.refused'));
					return;
				}
				fact.text = one.value;
				ed.drawFacts();
				ed.commit();
				ed.note(say('fact.changed'));
			};
		}
	};
	ed.openFacts = () => {
		render();
		panel.open();
	};
	ed.factsPaint = () => {
		button.hidden = ed.facts.size === 0;
	};
};

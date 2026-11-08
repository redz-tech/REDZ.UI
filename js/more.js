// REDZ.UI, show more: a button with command="--more" and aria-controls naming a list - a list group, any element whose
// children are its items, a table or its body - asks the page for the next items by the cancelable redz:more {shown,
// signal} on the list (js/answer.js). Answered with a promise, the button is busy until the page has put them in; then
// the focus goes to the first new item - its first link or button, else the item - and the count of new ones is said in
// the page's text "more.loaded". The answer may name the total ({total}) or the end ({done: true}); an answer that adds
// nothing is the end too. data-more-total on the button is the total known from the start. At the end the button hides;
// at data-more-max items it hides and the data-more-cap beside it shows the page's sentence. A data-more-count beside the
// button reads "{count} of {total}" ("more.count"), or "{count}+" ("more.some") while the total is unknown. A refusal
// keeps the button and the focus. A server search over the list starts it again (js/filter.js).
import {ask} from './answer.js';
import {busy} from './busy.js';
import {text, textCount} from './text.js';
import {announce} from './say.js';

/** The items of the list: a table's rows without its bands and subtotals, else the list's children. */
const itemsOf = (list) => list.matches('table, tbody') ? [...list.querySelectorAll('tbody > tr:not(.table-group, .table-subtotal)')] : [...list.children].filter((child) => !child.matches('[data-filter-empty], template, script'));

/** A number in the page's digits. */
const digits = (count) => new Intl.NumberFormat(document.documentElement.lang || 'en').format(count);

/** Shows the button or its cap and writes the count, from the items there are and what the page said. */
const show = (button, list, done) => {
	const shown = itemsOf(list).length;
	const total = button.dataset.moreTotal === undefined ? null : Number(button.dataset.moreTotal);
	const max = Number(button.dataset.moreMax) || Infinity;
	const ended = done || (total !== null && shown >= total);
	const capped = !ended && shown >= max;
	const foot = button.parentElement;
	button.hidden = ended || capped;
	foot?.querySelectorAll('[data-more-cap]').forEach((cap) => {
		cap.hidden = !capped;
	});
	foot?.querySelectorAll('[data-more-count]').forEach((count) => {
		count.textContent = total !== null || ended ? text('more.count', {count: digits(shown), total: digits(total ?? shown)}) : text('more.some', {count: digits(shown)});
	});
};

/** Takes the answer's total, then shows the button's state. */
const settle = (button, list, answer, added) => {
	if (typeof answer?.total === 'number') {
		button.dataset.moreTotal = String(answer.total);
	}
	show(button, list, answer?.done === true || added === 0);
};

/** The more buttons of the list. */
const buttonsOf = (list) => list.id === '' ? [] : [...document.querySelectorAll('button[command="--more"][aria-controls="' + CSS.escape(list.id) + '"]')];

// The question each list has out.
const asked = new WeakMap();

/** Starts the list's more buttons again after its items were replaced, with the answer that replaced them. */
export const restart = (list, answer) => {
	asked.get(list)?.abort();
	for (const button of buttonsOf(list)) {
		delete button.dataset.moreTotal;
		settle(button, list, answer, null);
	}
};

document.addEventListener('click', (event) => {
	const button = event.target instanceof Element ? event.target.closest('button[command="--more"][aria-controls]') : null;
	const list = button === null || button.disabled || button.getAttribute('aria-disabled') === 'true' ? null : document.getElementById(button.getAttribute('aria-controls'));
	if (list === null) {
		return;
	}
	const before = itemsOf(list);
	const controller = new AbortController();
	const [, answer] = ask(list, 'redz:more', {shown: before.length, signal: controller.signal});
	if (answer === null) {
		return;
	}
	asked.set(list, controller);
	busy(button, answer).then((result) => {
		if (controller.signal.aborted) {
			return;
		}
		const fresh = itemsOf(list).filter((item) => !before.includes(item));
		settle(button, list, result, fresh.length);
		if (fresh.length === 0) {
			return;
		}
		const first = fresh[0];
		const target = first.querySelector('a[href], button:not(:disabled), input:not(:disabled), [tabindex]') ?? first;
		if (target === first && !first.hasAttribute('tabindex')) {
			first.tabIndex = -1;
		}
		target.focus();
		announce(textCount('more.loaded', fresh.length));
	}, () => {});
});

for (const button of document.querySelectorAll('button[command="--more"][aria-controls]')) {
	const list = document.getElementById(button.getAttribute('aria-controls'));
	if (list !== null) {
		show(button, list, false);
	}
}

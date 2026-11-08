// REDZ.UI, contents loaded the first time they show: an element with data-lazy - a tree's group, a details or its
// accordion-body, a region a --toggle button opens, a tab panel - asks the page for its contents by the cancelable
// redz:load {region} (js/answer.js) the first time it shows: open at load, put in open later, or opened by a person, but
// never for the paper. The library takes data-lazy away first. Answered with a promise, the region shows three
// placeholder lines while it is empty and the words of the page's text "busy" to a screen reader, until the page has put
// the contents in. A refusal puts data-lazy back and shows its words in the region, which stays open, for another try
// when it opens again. data-lazy written again on a region that shows loads it again at once.
import {ask} from './answer.js';
import {text} from './text.js';
import {printing} from './print.js';

// The elements a refusal left open, which wait to be opened again.
const failed = new WeakSet();

/** Whether the element shows: neither it nor an element around it hidden, and every details from it out open. */
const shows = (element) => {
	for (let at = element; at !== null; at = at.parentElement) {
		if (at.hidden || (at.localName === 'details' && !at.open)) {
			return false;
		}
	}
	return true;
};

/** The look of a region waiting for its contents: placeholder lines, and the page's word for a screen reader. */
const waiting = (region) => {
	const list = region.matches('ul, ol');
	const box = document.createElement(list ? 'li' : 'div');
	box.dataset.loading = '';
	box.className = 'vstack gap-8 py-8';
	box.append(Object.assign(document.createElement('span'), {className: 'visually-hidden', textContent: text('busy')}));
	for (const width of ['w-75', 'w-100', 'w-50']) {
		const line = Object.assign(document.createElement('span'), {className: 'placeholder ' + width});
		line.setAttribute('aria-hidden', 'true');
		box.append(line);
	}
	return box;
};

/** The page's words of a refusal, shown in the region. */
const refused = (region, words) => {
	const box = document.createElement(region.matches('ul, ol') ? 'li' : 'p');
	box.dataset.loadError = '';
	box.className = 'text-danger py-8';
	box.textContent = words;
	return box;
};

/** Asks the page for the contents of the element; the button that opened it, if any, is busy meanwhile. */
export const load = (element, busyWith = null) => {
	delete element.dataset.lazy;
	const region = element.matches('details') ? element.querySelector(':scope > .accordion-body') ?? element : element;
	region.querySelectorAll(':scope > [data-load-error]').forEach((old) => old.remove());
	const [, answer] = ask(element, 'redz:load', {region, group: element});
	if (answer === null) {
		return;
	}
	const look = [...region.children].every((child) => child.matches('summary, [data-loading]')) ? waiting(region) : null;
	if (look !== null) {
		region.append(look);
	}
	(busyWith === null ? answer : busyWith(answer)).then(() => look?.remove(), (reason) => {
		look?.remove();
		failed.add(element);
		element.dataset.lazy = '';
		const words = reason instanceof Error ? reason.message : String(reason ?? '');
		if (words !== '') {
			region.append(refused(region, words));
		}
	});
};

/** Loads every lazy element in or around the node that shows now. */
const check = (node) => {
	if (printing() || !(node instanceof Element)) {
		return;
	}
	for (const element of [...(node.matches('[data-lazy]') ? [node] : []), ...node.querySelectorAll('[data-lazy]')]) {
		if (!shows(element)) {
			failed.delete(element);
		} else if (!failed.has(element)) {
			load(element);
		}
	}
};

new MutationObserver((records) => {
	for (const record of records) {
		[record.target, ...record.addedNodes].forEach(check);
	}
}).observe(document.documentElement, {childList: true, subtree: true, attributes: true, attributeFilter: ['data-lazy', 'hidden', 'open']});

document.addEventListener('toggle', (event) => check(event.target), true);

check(document.body);

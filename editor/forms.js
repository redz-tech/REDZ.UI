// REDZ.UI editor, the forms of a list: the same words as bullets, numbers, a list group, cards, an accordion, steps or a table. Each form
// reads its items and writes them, so turning a block into another form never touches a word.
const HEADING = /^h[1-6]$/i;

export const FORMS = {bullets: {icon: 'list-ul'}, numbers: {icon: 'list-ol'}, group: {icon: 'list-task'}, cards: {icon: 'card-text'}, accordion: {icon: 'chevron-bar-expand'}, steps: {icon: 'signpost-split'}, table: {icon: 'table'}};

/** Which form a top element has, or null. */
export const formNow = (top) => {
	if (top.matches('.accordion')) {
		return 'accordion';
	}
	if (top.matches('.stepper')) {
		return 'steps';
	}
	if (top.matches('.list-group')) {
		return 'group';
	}
	if (top.matches('.grid') && [...top.children].every((one) => one.matches('.card'))) {
		return 'cards';
	}
	if (top.matches('table') && [...top.rows].every((row) => row.cells.length === 2)) {
		return 'table';
	}
	return top.matches('ul') ? 'bullets' : (top.matches('ol') ? 'numbers' : null);
};

/** A list item's words, a strong start as its title. */
const fromLine = (li) => {
	const first = li.firstElementChild;
	if (first?.matches('strong, b') && li.firstChild === first) {
		const rest = li.cloneNode(true);
		rest.firstElementChild.remove();
		return {title: first.innerHTML, text: rest.innerHTML.replace(/^\s*[:.]\s*/, '')};
	}
	return {title: li.innerHTML, text: ''};
};

const readers = {
	bullets: (top) => [...top.children].map(fromLine),
	numbers: (top) => [...top.children].map(fromLine),
	group: (top) => [...top.children].map(fromLine),
	steps: (top) => [...top.children].map(fromLine),
	cards: (top) => [...top.children].map((card) => {
		const heading = [...card.querySelectorAll('*')].find((one) => HEADING.test(one.tagName));
		return {title: heading?.innerHTML ?? '', text: card.querySelector('p')?.innerHTML ?? ''};
	}),
	accordion: (top) => [...top.querySelectorAll('details')].map((item) => {
		const summary = item.querySelector('summary').cloneNode(true);
		summary.querySelector('.accordion-icon')?.remove();
		return {title: summary.innerHTML.trim(), text: item.querySelector('.accordion-body')?.innerHTML ?? ''};
	}),
	table: (top) => [...top.rows].filter((row) => row.parentElement.tagName !== 'THEAD').map((row) => ({title: row.cells[0].innerHTML, text: row.cells[1].innerHTML})),
};

const line = (one) => (one.text === '' ? one.title : '<strong>' + one.title + '</strong>: ' + one.text);
const writers = {
	bullets: (items) => '<ul>' + items.map((one) => '<li>' + line(one) + '</li>').join('') + '</ul>',
	numbers: (items) => '<ol>' + items.map((one) => '<li>' + line(one) + '</li>').join('') + '</ol>',
	group: (items) => '<ul class="list-group">' + items.map((one) => '<li class="list-group-item">' + line(one) + '</li>').join('') + '</ul>',
	steps: (items) => '<ol class="stepper">' + items.map((one) => '<li class="stepper-item">' + line(one) + '</li>').join('') + '</ol>',
	cards: (items) => '<div class="grid md:cols-' + Math.min(4, Math.max(2, items.length)) + ' gap-16">' + items.map((one) => '<div class="card"><div class="card-body vstack gap-8"><h3>' + one.title + '</h3><p>' + one.text + '</p></div></div>').join('') + '</div>',
	accordion: (items) => '<div class="accordion">' + items.map((one) => '<details class="accordion-item"><summary class="accordion-header">' + one.title + '<i class="bi bi-chevron-down accordion-icon" aria-hidden="true"></i></summary><div class="accordion-body">' + one.text + '</div></details>').join('') + '</div>',
	table: (items) => '<table class="table"><tbody>' + items.map((one) => '<tr><th scope="row">' + one.title + '</th><td>' + one.text + '</td></tr>').join('') + '</tbody></table>',
};

/** Turns a top element into a form; answers the new element, which keeps its place and its id. */
export const toForm = (top, name, doc) => {
	const now = formNow(top);
	if (now === null) {
		return top;
	}
	const box = doc.createElement('template');
	box.innerHTML = writers[name](readers[now](top));
	const made = box.content.firstElementChild;
	made.setAttribute('data-block', top.getAttribute('data-block'));
	top.replaceWith(made);
	return made;
};

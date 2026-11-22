// REDZ.UI, reordering: in a list, a table's tbody, a grid or a tree with data-reorder naming a hidden field, each item
// with a data-value moves by its drag-handle - a button opening the list's menu of moves by commandfor, whose items
// carry data-move: up, down, first, last, and in a tree in (to the end of the group of the item above) and out (after
// its parent) - or by the pointer dragging the handle within its group: a lifted copy follows the pointer while the
// item's place, an empty slot, goes where it will land - down a column, or, where the group lays its items out in a
// line - a grid of more than one column, a flex row - before or after the item under the pointer by the half of it the
// pointer is in, or to the group's end below its last item -, the other items gliding aside; near an edge of a box
// under the pointer that scrolls, and of the page, it scrolls, and Escape takes the item back. Lists with one
// data-reorder-group are a board: an item at the top of its list is dragged into any of them, an empty one included,
// and data-move="to" with data-to naming one moves it to that list's end. A move by the menu glides as well, unless the
// reader asks for no motion. Each move ends with the focus back on the handle and the page's text "moved" said
// politely - "moved.into", with the list's name, into another list; then the cancelable redz:move (js/answer.js) with
// the item, its list, the list it left, parent and place: a refusal undoes the move and says the page's words; left
// alone, hidden fields beside each list it changed - beside its table for a tbody - hold the order for the form: each
// value in data-reorder's name, one empty value for a list left empty, and with data-parent each one's parent under
// data-parent's name.
import {ask} from './answer.js';
import {text} from './text.js';
import {mark} from './toggle.js';

let handle = null;
let drag = null;
let swallow = false;

const listOf = (element) => element.closest('[data-reorder]');
const itemOf = (element) => element.closest('[data-value]');
const itemsOf = (group) => [...group.children].filter((child) => child.matches('[data-value]'));
const handleOf = (item) => [...item.querySelectorAll('.drag-handle')].find((grip) => itemOf(grip) === item) ?? null;
const besideOf = (list) => list.matches('tbody') ? list.closest('table') : list;

/** The lists of the list's board - every list of its data-reorder-group -, else the list alone. */
const boardOf = (list) => list.dataset.reorderGroup ? [...document.querySelectorAll('[data-reorder][data-reorder-group]')].filter((one) => one.dataset.reorderGroup === list.dataset.reorderGroup) : [list];

/** The list's name: its aria-label, else the words of its aria-labelledby. */
const nameOf = (list) => list.getAttribute('aria-label') || (list.getAttribute('aria-labelledby') ?? '').split(/\s+/).map((id) => document.getElementById(id)?.textContent.trim() ?? '').filter(Boolean).join(' ');

/** Whether the group lays its items out in a line - a grid of more than one column or a flex row. */
const linesOf = (group) => {
	const style = getComputedStyle(group);
	if (style.display.endsWith('grid')) {
		return style.gridTemplateColumns.trim().split(/\s+/).length > 1;
	}
	return style.display.endsWith('flex') && !style.flexDirection.startsWith('column');
};

/** The item the item sits in, within its list, or null at the top. */
const parentOf = (item) => {
	const parent = item.parentElement.closest('[data-value]');
	return parent !== null && listOf(item).contains(parent) ? parent : null;
};

/** Where the move takes the item - [its new group, the item it goes before, null for the end] - or null where it cannot
 *  go; TO is the id of the list of its board a move "to" names. */
const placeOf = (item, move, to) => {
	const group = item.parentElement;
	const list = listOf(item);
	const other = document.getElementById(to ?? '');
	const items = itemsOf(group);
	const at = items.indexOf(item);
	const parent = parentOf(item);
	const above = items[at - 1]?.querySelector(':scope > .tree-group') ?? null;
	const places = {
		up: at > 0 ? [group, items[at - 1]] : null,
		down: at < items.length - 1 ? [group, items[at + 2] ?? null] : null,
		first: at > 0 ? [group, items[0]] : null,
		last: at < items.length - 1 ? [group, null] : null,
		in: above === null ? null : [above, null],
		out: parent === null ? null : [parent.parentElement, itemsOf(parent.parentElement)[itemsOf(parent.parentElement).indexOf(parent) + 1] ?? null],
		to: group === list && other !== list && boardOf(list).includes(other) ? [other, null] : null
	};
	return places[move] ?? null;
};

/** The list's polite status, made on first need - when its menu of moves opens or a drag starts, before a move: a
 *  region made with its words says nothing. */
const statusOf = (list) => {
	const beside = besideOf(list);
	let status = beside.parentElement.querySelector(':scope > .reorder-status');
	if (status === null) {
		status = Object.assign(document.createElement('div'), {className: 'reorder-status visually-hidden'});
		status.setAttribute('role', 'status');
		beside.after(status);
	}
	return status;
};

const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = {duration: 160, easing: 'cubic-bezier(0.2, 0, 0, 1)'};

/** Does MOVE, the items of the groups gliding from where they stood to where it leaves them - unless the reader asks
 *  for no motion; answers what MOVE answers. */
const glide = (groups, move) => {
	const items = [...new Set(groups)].flatMap(itemsOf);
	const from = still() ? [] : items.map((item) => item.getBoundingClientRect());
	const answer = move();
	from.forEach((was, k) => {
		const now = items[k].getBoundingClientRect();
		if (was.left !== now.left || was.top !== now.top) {
			items[k].animate([{translate: (was.left - now.left) + 'px ' + (was.top - now.top) + 'px'}, {translate: '0 0'}], EASE);
		}
	});
	return answer;
};

/** Puts the item at the place, its group opened and its handle focused; answers the place it left. */
const put = (item, [group, before]) => glide([item.parentElement, group], () => {
	const left = [item.parentElement, item.nextElementSibling];
	group.insertBefore(item, before);
	if (group.hidden) {
		group.hidden = false;
		mark(group, true);
	}
	handleOf(item)?.focus();
	return left;
});

/** Writes the order into hidden fields beside the list, and says it changed. */
const hold = (list) => {
	list.id ||= 'redz-reorder-' + Math.random().toString(36).slice(2);
	const beside = besideOf(list);
	for (const field of beside.parentElement.querySelectorAll(':scope > input[type="hidden"]')) {
		if (field.dataset.orderOf === list.id) {
			field.remove();
		}
	}
	const fields = [];
	const field = (name, value) => {
		const made = Object.assign(document.createElement('input'), {type: 'hidden', name, value});
		made.dataset.orderOf = list.id;
		fields.push(made);
	};
	for (const item of list.querySelectorAll('[data-value]')) {
		field(list.dataset.reorder, item.dataset.value);
		if (list.dataset.parent) {
			field(list.dataset.parent + '[' + item.dataset.value + ']', parentOf(item)?.dataset.value ?? '');
		}
	}
	if (fields.length === 0) {
		field(list.dataset.reorder, '');
	}
	beside.after(...fields);
	list.dispatchEvent(new Event('change', {bubbles: true}));
};

/** After a move from the place LEFT: says where the item is now, and asks the page, which may refuse it. */
const moved = (item, left) => {
	const list = listOf(item);
	const from = listOf(left[0]);
	const items = itemsOf(item.parentElement);
	const position = items.indexOf(item);
	const name = from === list ? '' : nameOf(list);
	statusOf(from).textContent = name ? text('moved.into', {list: name, position: position + 1, count: items.length}) : text('moved', {position: position + 1, count: items.length});
	const [taken, answer] = ask(item, 'redz:move', {item, list, from, parent: parentOf(item), position});
	if (!taken) {
		new Set([list, from]).forEach(hold);
		return;
	}
	answer?.catch((words) => {
		put(item, left);
		statusOf(from).textContent = String(words ?? '');
	});
};

/** The lifted copy of the item that follows the pointer, at the item's place: the item in a shallow copy of its group -
 *  a row in a copy of its table and tbody, its cells as wide as they are - so it keeps its look; inert, unread. */
const copyOf = (item, box) => {
	const group = item.parentElement;
	const shell = group.matches('tbody') ? group.closest('table').cloneNode(false) : group.cloneNode(false);
	const inner = group.matches('tbody') ? shell.appendChild(group.cloneNode(false)) : shell;
	const twin = inner.appendChild(item.cloneNode(true));
	if (item.matches('tr')) {
		[...item.children].forEach((cell, k) => {
			twin.children[k].style.inlineSize = cell.getBoundingClientRect().width + 'px';
		});
	}
	for (const named of [shell, ...shell.querySelectorAll('[id]')]) {
		named.removeAttribute('id');
	}
	shell.removeAttribute('data-reorder');
	shell.setAttribute('aria-hidden', 'true');
	shell.inert = true;
	shell.dataset.dragCopy = '';
	Object.assign(shell.style, {left: box.left + 'px', top: box.top + 'px', inlineSize: box.width + 'px'}, shell.matches('table') ? {} : {display: 'block'});
	(item.closest('dialog[open]') ?? document.body).append(shell);
	return shell;
};

/** The boxes that scroll around the element, the nearest first, each with whether it scrolls across and down. */
const scrollersOf = (element) => {
	const boxes = [];
	for (let up = element; up !== null && up !== document.body && up !== document.documentElement; up = up.parentElement) {
		const style = getComputedStyle(up);
		const axes = [/auto|scroll/.test(style.overflowX) && up.scrollWidth > up.clientWidth, /auto|scroll/.test(style.overflowY) && up.scrollHeight > up.clientHeight];
		if (axes[0] || axes[1]) {
			boxes.push([up, axes]);
		}
	}
	return boxes;
};

/** Whether the pointer is inside the box. */
const inside = (box) => drag.px > box.left && drag.px < box.right && drag.py > box.top && drag.py < box.bottom;

/** Whether the group lays its items out in a line, and whether right to left, read once a drag. */
const layoutOf = (group) => {
	if (!drag.layouts.has(group)) {
		drag.layouts.set(group, [linesOf(group), getComputedStyle(group).direction === 'rtl']);
	}
	return drag.layouts.get(group);
};

/** Moves the item before or after the item under the pointer - by its half, across a line or down a column -, or to
 *  the end of the group under the pointer below its last item, unless the items still glide from the last move and NOW
 *  is not asked. The group is the board's list under the pointer, else the item's own. */
const follow = (now = false) => {
	if (!now && performance.now() < drag.calm) {
		return;
	}
	const under = drag.groups.find((group) => inside(group.getBoundingClientRect())) ?? null;
	const group = under ?? drag.item.parentElement;
	const [lines, rtl] = layoutOf(group);
	const others = itemsOf(group).filter((other) => other !== drag.item);
	let before;
	for (const other of others) {
		const box = other.getBoundingClientRect();
		if (drag.py <= box.top || drag.py >= box.bottom || (lines && (drag.px <= box.left || drag.px >= box.right))) {
			continue;
		}
		const after = lines ? (drag.px > box.left + box.width / 2) !== rtl : drag.py > box.top + box.height / 2;
		before = after ? other.nextElementSibling : other;
		break;
	}
	if (before === undefined) {
		const last = others.at(-1)?.getBoundingClientRect();
		if (under === null || (last && drag.py < last.bottom && !(lines && drag.py > last.top && (rtl ? drag.px < last.left : drag.px > last.right)))) {
			return;
		}
		before = null;
	}
	if (group !== drag.item.parentElement || (before !== drag.item && before !== drag.item.nextElementSibling)) {
		glide([drag.item.parentElement, group], () => group.insertBefore(drag.item, before));
		drag.calm = performance.now() + (still() ? 0 : EASE.duration);
	}
};

/** Near an edge of a box that scrolls - around the pointer, then around the item while the pointer is across from it -
 *  or of the page, or past it, scrolls it - the first that still can, each way -, faster the nearer the edge, every
 *  frame. */
const tick = () => {
	if (drag === null || drag.left === null) {
		return;
	}
	const near = (at, start, end) => at < start + 48 ? -Math.ceil((start + 48 - at) / 6) : (at > end - 48 ? Math.ceil((at - end + 48) / 6) : 0);
	const done = [false, false];
	for (const [box, axes] of new Map([...scrollersOf(document.elementFromPoint(drag.px, drag.py) ?? drag.item), ...scrollersOf(drag.item), [document.scrollingElement, [false, true]]])) {
		const edges = box === document.scrollingElement ? {left: -Infinity, right: Infinity, top: 0, bottom: innerHeight} : box.getBoundingClientRect();
		const by = [axes[0] && !done[0] && drag.py > edges.top && drag.py < edges.bottom ? near(drag.px, edges.left, edges.right) : 0, axes[1] && !done[1] && drag.px > edges.left && drag.px < edges.right ? near(drag.py, edges.top, edges.bottom) : 0];
		if (by[0] !== 0 || by[1] !== 0) {
			const was = [box.scrollLeft, box.scrollTop];
			box.scrollBy(by[0], by[1]);
			done[0] ||= box.scrollLeft !== was[0];
			done[1] ||= box.scrollTop !== was[1];
		}
	}
	if (done[0] || done[1]) {
		follow();
	}
	drag.frame = requestAnimationFrame(tick);
};

/** Ends a drag - the copy settling into the item's place, the item at rest, its move told if it moved; CANCEL takes the
 *  item back where it started. */
const drop = (cancel = false) => {
	if (drag?.left) {
		const {item, copy, left, lists} = drag;
		cancelAnimationFrame(drag.frame);
		if (cancel === true) {
			glide([item.parentElement, left[0]], () => left[0].insertBefore(item, left[1]));
		} else {
			follow(true);
		}
		const land = () => {
			copy.remove();
			delete item.dataset.dragging;
			lists.forEach((list) => list.classList.remove('reordering'));
		};
		const to = item.getBoundingClientRect();
		if (still()) {
			land();
		} else {
			copy.animate([{translate: copy.style.translate || '0 0'}, {translate: (to.left - parseFloat(copy.style.left)) + 'px ' + (to.top - parseFloat(copy.style.top)) + 'px'}], {...EASE, fill: 'forwards'}).finished.then(land, land);
		}
		swallow = true;
		setTimeout(() => {
			swallow = false;
		});
		if (item.parentElement !== left[0] || item.nextElementSibling !== left[1]) {
			moved(item, left);
		}
	}
	drag = null;
};

document.addEventListener('click', (event) => {
	const grip = event.target instanceof Element ? event.target.closest('.drag-handle') : null;
	if (grip !== null && swallow) {
		event.preventDefault();
		event.stopImmediatePropagation();
	}
	swallow = false;
	if (grip !== null) {
		handle = grip;
	}
	const choice = event.target instanceof Element ? event.target.closest('[data-move]') : null;
	const menu = choice?.closest('[popover]');
	const item = handle === null ? null : itemOf(handle);
	if (choice === null || item === null || !menu?.matches(':popover-open')) {
		return;
	}
	const place = placeOf(item, choice.dataset.move, choice.dataset.to);
	if (place !== null) {
		menu.hidePopover();
		moved(item, put(item, place));
	}
}, true);

document.addEventListener('beforetoggle', (event) => {
	const menu = event.target;
	if (event.newState !== 'open' || !(menu instanceof HTMLElement) || menu.querySelector('[data-move]') === null || handle === null) {
		return;
	}
	for (const choice of menu.querySelectorAll('[data-move]')) {
		choice.setAttribute('aria-disabled', String(placeOf(itemOf(handle), choice.dataset.move, choice.dataset.to) === null));
	}
	const list = listOf(handle);
	if (list !== null) {
		statusOf(list);
	}
}, true);

document.addEventListener('pointerdown', (event) => {
	const grip = event.target instanceof Element ? event.target.closest('.drag-handle') : null;
	swallow = false;
	if (grip !== null && event.button === 0 && listOf(grip) !== null) {
		drag = {item: itemOf(grip), grip, x: event.clientX, y: event.clientY, left: null};
	}
});

document.addEventListener('pointermove', (event) => {
	if (drag === null) {
		return;
	}
	if (drag.left === null) {
		if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 4) {
			return;
		}
		const list = listOf(drag.item);
		drag.left = [drag.item.parentElement, drag.item.nextElementSibling];
		drag.groups = drag.item.parentElement === list ? boardOf(list) : [drag.item.parentElement];
		drag.lists = [...new Set(drag.groups.map(listOf))];
		drag.layouts = new Map();
		drag.calm = 0;
		statusOf(list);
		drag.grip.setPointerCapture(event.pointerId);
		drag.copy = copyOf(drag.item, drag.item.getBoundingClientRect());
		drag.item.dataset.dragging = '';
		drag.lists.forEach((one) => one.classList.add('reordering'));
		drag.frame = requestAnimationFrame(tick);
	}
	drag.px = event.clientX;
	drag.py = event.clientY;
	drag.copy.style.translate = (event.clientX - drag.x) + 'px ' + (event.clientY - drag.y) + 'px';
	follow();
});

document.addEventListener('pointerup', () => drop());
document.addEventListener('pointercancel', () => drop(true));
document.addEventListener('keydown', (event) => {
	if (event.key === 'Escape' && drag?.left) {
		event.preventDefault();
		drop(true);
	}
});

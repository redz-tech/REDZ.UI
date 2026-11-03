// REDZ.UI, reordering: in a list or a tree with data-reorder naming a hidden field, each item with a data-value moves by
// its drag-handle — a button opening the list's menu of moves by commandfor, whose items carry data-move: up, down,
// first, last, and in a tree in (to the end of the group of the item above) and out (after its parent) — or by the
// pointer dragging the handle within its group. A move is done at once, the focus back on the handle and the page's
// text "moved" said politely; then the cancelable redz:move (js/answer.js) with the item, its list, parent and place:
// a refusal undoes the move and says the page's words; left alone, hidden fields beside the list hold the order for the
// form — each value in data-reorder's name, and with data-parent each one's parent under data-parent's name.
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

/** The item the item sits in, within its list, or null at the top. */
const parentOf = (item) => {
	const parent = item.parentElement.closest('[data-value]');
	return parent !== null && listOf(item).contains(parent) ? parent : null;
};

/** Where the move takes the item — [its new group, the item it goes before, null for the end] — or null where it cannot go. */
const placeOf = (item, move) => {
	const group = item.parentElement;
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
		out: parent === null ? null : [parent.parentElement, itemsOf(parent.parentElement)[itemsOf(parent.parentElement).indexOf(parent) + 1] ?? null]
	};
	return places[move] ?? null;
};

/** The list's polite status, made on first need — when its menu of moves opens or a drag starts, before a move: a
 *  region made with its words says nothing. */
const statusOf = (list) => {
	let status = list.parentElement.querySelector(':scope > .reorder-status');
	if (status === null) {
		status = Object.assign(document.createElement('div'), {className: 'reorder-status visually-hidden'});
		status.setAttribute('role', 'status');
		list.after(status);
	}
	return status;
};

/** Puts the item at the place, its group opened and its handle focused; answers the place it left. */
const put = (item, [group, before]) => {
	const left = [item.parentElement, item.nextElementSibling];
	group.insertBefore(item, before);
	if (group.hidden) {
		group.hidden = false;
		mark(group, true);
	}
	handleOf(item)?.focus();
	return left;
};

/** Writes the order into hidden fields beside the list, and says it changed. */
const hold = (list) => {
	list.id ||= 'redz-reorder-' + Math.random().toString(36).slice(2);
	for (const field of list.parentElement.querySelectorAll(':scope > input[type="hidden"]')) {
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
	list.after(...fields);
	list.dispatchEvent(new Event('change', {bubbles: true}));
};

/** After a move from the place LEFT: says where the item is now, and asks the page, which may refuse it. */
const moved = (item, left) => {
	const list = listOf(item);
	const items = itemsOf(item.parentElement);
	const position = items.indexOf(item);
	statusOf(list).textContent = text('moved', {position: position + 1, count: items.length});
	const [taken, answer] = ask(item, 'redz:move', {item, list, parent: parentOf(item), position});
	if (!taken) {
		hold(list);
		return;
	}
	answer?.catch((words) => {
		put(item, left);
		statusOf(list).textContent = String(words ?? '');
	});
};

/** Ends a drag: the item at rest, its move told if it moved. */
const drop = () => {
	if (drag?.left) {
		delete drag.item.dataset.dragging;
		listOf(drag.item)?.classList.remove('reordering');
		swallow = true;
		if (drag.item.parentElement !== drag.left[0] || drag.item.nextElementSibling !== drag.left[1]) {
			moved(drag.item, drag.left);
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
	const place = placeOf(item, choice.dataset.move);
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
		choice.setAttribute('aria-disabled', String(placeOf(itemOf(handle), choice.dataset.move) === null));
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
		drag.left = [drag.item.parentElement, drag.item.nextElementSibling];
		statusOf(listOf(drag.item));
		drag.grip.setPointerCapture(event.pointerId);
		drag.item.dataset.dragging = '';
		listOf(drag.item).classList.add('reordering');
	}
	for (const other of itemsOf(drag.item.parentElement)) {
		const box = other.getBoundingClientRect();
		if (other !== drag.item && event.clientY > box.top && event.clientY < box.bottom) {
			drag.item.parentElement.insertBefore(drag.item, event.clientY > box.top + box.height / 2 ? other.nextElementSibling : other);
			break;
		}
	}
});

document.addEventListener('pointerup', drop);
document.addEventListener('pointercancel', drop);

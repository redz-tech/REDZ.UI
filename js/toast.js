// REDZ.UI, notices: REDZ.ui.toast() shows a toast in the stack .toast-container, in one of its two live regions that
// are on the page from the start - role="status", role="alert" for danger - or, while a modal dialog is open, in the
// dialog's own stack, since everything outside a modal is inert; as the dialog closes, its toasts go on in the stack
// below it, out of the live regions, which said them once. Success and info leave after 8 seconds unless the
// pointer or the focus rests on them; danger and a toast with an action stay until closed. A stack shows three: the
// newest, errors before the rest and the one holding the focus always; the others fold behind a bar at its top, outside
// the live regions - a button that opens the whole stack, named by the page's text "toast.more" with their count, and
// one that closes every toast of the stack, "toast.close_all". A toast of a group takes the place of the group's toast
// before it. The words come from the caller; the buttons' names from the page's texts.
import {text, textCount} from './text.js';

const LIFE = 8000;
const SHOWN = 3;
const ICONS = {primary: 'bi-bell-fill', success: 'bi-check-circle-fill', danger: 'bi-x-octagon-fill', warning: 'bi-exclamation-triangle-fill', info: 'bi-info-circle-fill'};
const returns = new WeakMap();
const born = new WeakMap();
const groups = new Map();
let made = 0;

/** The toasts of the stack, the oldest first: in its live regions, and those a closed dialog left beside them. */
const toastsOf = (stack) => [...stack.querySelectorAll(':scope > .toast, :scope > [role] > .toast')].sort((a, b) => (born.get(a) ?? 0) - (born.get(b) ?? 0));

/** The stack's bar: its two buttons, made once, before the live regions. */
const barOf = (stack) => {
	let bar = stack.querySelector(':scope > .toast-bar');
	if (bar === null) {
		bar = Object.assign(document.createElement('div'), {className: 'toast-bar', hidden: true});
		const more = Object.assign(document.createElement('button'), {className: 'btn btn-sm', type: 'button'});
		more.setAttribute('aria-expanded', 'false');
		more.addEventListener('click', () => {
			stack.toggleAttribute('data-open');
			settle(stack);
		});
		const all = Object.assign(document.createElement('button'), {className: 'btn btn-sm', type: 'button'});
		all.addEventListener('click', () => {
			for (const one of toastsOf(stack)) {
				one.remove();
			}
			settle(stack);
		});
		bar.addEventListener('focusin', (event) => {
			if (!bar.contains(event.relatedTarget)) {
				returns.set(bar, event.relatedTarget);
			}
		});
		bar.append(more, all);
		stack.prepend(bar);
	}
	return bar;
};

/** Folds what the stack cannot show: the oldest first, an error after every other toast, never the one holding the
 *  focus; the bar shows while anything is folded, and the open stack closes once nothing is. */
const settle = (stack) => {
	const toasts = toastsOf(stack);
	const kept = new Set(toasts.filter((one) => one.contains(document.activeElement)));
	for (const one of [...toasts].reverse().sort((a, b) => Number(b.matches('.toast-danger')) - Number(a.matches('.toast-danger')))) {
		if (kept.size >= SHOWN) {
			break;
		}
		kept.add(one);
	}
	const folded = toasts.filter((one) => !kept.has(one));
	for (const one of toasts) {
		one.toggleAttribute('data-folded', folded.includes(one));
	}
	if (folded.length === 0) {
		stack.removeAttribute('data-open');
	}
	if (folded.length === 0 && stack.querySelector(':scope > .toast-bar') === null) {
		return;
	}
	const bar = barOf(stack);
	const [more, all] = bar.children;
	const open = stack.hasAttribute('data-open');
	if (folded.length === 0 && bar.contains(document.activeElement)) {
		returns.get(bar)?.focus();
	}
	bar.hidden = folded.length === 0;
	more.textContent = open ? text('toast.fewer') : textCount('toast.more', folded.length);
	more.setAttribute('aria-expanded', String(open));
	all.textContent = text('toast.close_all');
};

/** The live region for the role in the scope's stack, made now with the stack when the scope has none. */
const regionIn = (scope, role) => {
	let stack = [...scope.querySelectorAll('.toast-container')].find((s) => scope !== document.body || s.closest('dialog') === null);
	let fresh = false;
	if (stack === undefined) {
		stack = Object.assign(document.createElement('div'), {className: 'toast-container'});
		scope.append(stack);
	}
	for (const each of ['status', 'alert']) {
		if (stack.querySelector(':scope > [role="' + each + '"]') === null) {
			const region = document.createElement('div');
			region.setAttribute('role', each);
			stack.append(region);
			fresh = true;
		}
	}
	return {region: stack.querySelector(':scope > [role="' + role + '"]'), fresh};
};

regionIn(document.body, 'status');
document.addEventListener('close', (event) => {
	const kept = event.target instanceof HTMLDialogElement ? event.target.querySelectorAll('.toast-container .toast') : [];
	if (kept.length > 0) {
		const stack = regionIn(document.querySelector('dialog:modal') ?? document.body, 'status').region.parentElement;
		const bar = stack.querySelector(':scope > .toast-bar');
		if (bar === null) {
			stack.prepend(...kept);
		} else {
			bar.after(...kept);
		}
		settle(stack);
	}
}, true);

/** Removes the toast; when it holds the focus, the focus goes back where it came from. */
const close = (toast) => {
	if (toast.contains(document.activeElement)) {
		returns.get(toast)?.focus();
	}
	const stack = toast.closest('.toast-container');
	toast.remove();
	if (stack !== null) {
		settle(stack);
	}
};

/** Shows a toast: {title, text, tone, action: {label, run}, persistent, group}; answers a function that closes it. */
export const toast = ({title = '', text: detail = '', tone = 'info', action = null, persistent = false, group = ''} = {}) => {
	if (group !== '' && groups.get(group)?.isConnected) {
		close(groups.get(group));
	}
	const node = document.createElement('div');
	born.set(node, ++made);
	if (group !== '') {
		groups.set(group, node);
	}
	node.className = 'toast toast-' + tone;
	const icon = document.createElement('i');
	icon.className = 'bi ' + (ICONS[tone] ?? ICONS.info);
	icon.setAttribute('aria-hidden', 'true');
	const body = document.createElement('div');
	body.className = 'toast-body';
	if (title !== '') {
		body.append(Object.assign(document.createElement('strong'), {textContent: title}));
	}
	if (detail !== '') {
		body.append(Object.assign(document.createElement('div'), {className: title === '' ? '' : 'text-muted fs-12', textContent: detail}));
	}
	node.append(icon, body);
	if (action !== null) {
		const button = Object.assign(document.createElement('button'), {className: 'btn btn-sm', type: 'button', textContent: action.label});
		button.addEventListener('click', () => {
			action.run();
			close(node);
		});
		node.append(button);
	}
	const dismiss = Object.assign(document.createElement('button'), {className: 'btn-close', type: 'button'});
	dismiss.setAttribute('aria-label', text('close'));
	dismiss.addEventListener('click', () => close(node));
	node.append(dismiss);
	node.addEventListener('focusin', (event) => {
		if (!node.contains(event.relatedTarget)) {
			returns.set(node, event.relatedTarget);
		}
	});

	if (tone !== 'danger' && action === null && !persistent) {
		let left = LIFE;
		let started = 0;
		let timer = 0;
		const run = () => {
			started = Date.now();
			timer = setTimeout(() => close(node), left);
		};
		const hold = () => {
			if (timer !== 0) {
				clearTimeout(timer);
				timer = 0;
				left -= Date.now() - started;
			}
		};
		const resume = () => {
			if (timer === 0 && !node.matches(':hover') && !node.contains(document.activeElement)) {
				run();
			}
		};
		node.addEventListener('pointerenter', hold);
		node.addEventListener('focusin', hold);
		node.addEventListener('pointerleave', resume);
		node.addEventListener('focusout', () => setTimeout(resume));
		run();
	}

	const {region, fresh} = regionIn(document.querySelector('dialog:modal') ?? document.body, tone === 'danger' ? 'alert' : 'status');
	const add = () => {
		region.append(node);
		settle(region.parentElement);
	};
	if (fresh) {
		setTimeout(add, 100);
	} else {
		add();
	}
	return () => close(node);
};

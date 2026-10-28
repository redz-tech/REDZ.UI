// REDZ.UI, notices: REDZ.ui.toast() shows a toast in the stack .toast-container, in one of its two live regions that
// are on the page from the start — role="status", role="alert" for danger — or, while a modal dialog is open, in the
// dialog's own stack, since everything outside a modal is inert. Success and info leave after 8 seconds unless the
// pointer or the focus rests on them; danger and a toast with an action stay until closed. The words come from the
// caller; the close button's name from the page's texts.
import {text} from './text.js';

const LIFE = 8000;
const ICONS = {primary: 'bi-bell-fill', success: 'bi-check-circle-fill', danger: 'bi-x-octagon-fill', warning: 'bi-exclamation-triangle-fill', info: 'bi-info-circle-fill'};
const returns = new WeakMap();

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

/** Removes the toast; when it holds the focus, the focus goes back where it came from. */
const close = (toast) => {
	if (toast.contains(document.activeElement)) {
		returns.get(toast)?.focus();
	}
	toast.remove();
};

/** Shows a toast: {title, text, tone, action: {label, run}, persistent}; answers a function that closes it. */
export const toast = ({title = '', text: detail = '', tone = 'info', action = null, persistent = false} = {}) => {
	const node = document.createElement('div');
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
	if (fresh) {
		setTimeout(() => region.append(node), 100);
	} else {
		region.append(node);
	}
	return () => close(node);
};

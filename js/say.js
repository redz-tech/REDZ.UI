// REDZ.UI, saying: a widget's words said politely by a status of its own - inside the open modal dialog, since
// everything outside one is inert.
const regions = new WeakMap();

/** Says the message politely. */
export const say = (message) => {
	const scope = [...document.querySelectorAll('dialog:modal')].at(-1) ?? document.body;
	let region = regions.get(scope);
	const fresh = !region?.isConnected;
	if (fresh) {
		region = Object.assign(document.createElement('div'), {className: 'visually-hidden'});
		region.setAttribute('role', 'status');
		scope.append(region);
		regions.set(scope, region);
	}
	region.textContent = '';
	setTimeout(() => {
		region.textContent = message;
	}, fresh ? 100 : 0);
};

// REDZ.UI, polite words: announce() says a message through a hidden polite status - inside the open modal dialog, as
// everything outside one is inert; a status made for the message first gets it a moment later, once a reader knows it.

/** The hidden polite region of the scope, made now when it has none; whether it was just made. */
const statusIn = (scope) => {
	let region = [...scope.children].find((child) => child.matches('.visually-hidden[role="status"]'));
	if (region !== undefined) {
		return {region, fresh: false};
	}
	region = Object.assign(document.createElement('div'), {className: 'visually-hidden'});
	region.setAttribute('role', 'status');
	scope.append(region);
	return {region, fresh: true};
};

statusIn(document.body);

/** Says the message politely. */
export const announce = (message) => {
	const {region, fresh} = statusIn([...document.querySelectorAll('dialog:modal')].at(-1) ?? document.body);
	region.textContent = '';
	setTimeout(() => {
		region.textContent = message;
	}, fresh ? 100 : 0);
};

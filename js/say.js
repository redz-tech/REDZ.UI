// REDZ.UI, polite words: announce() says a message through a hidden polite status - inside the open modal dialog, as
// everything outside one is inert; a status made for the message first gets it a moment later, once a reader knows it.
// announce(message, true) says it through a hidden alert, made the same way, for words that cannot wait.

/** The hidden region of the role in the scope, made now when it has none; whether it was just made. */
const regionIn = (scope, role) => {
	let region = [...scope.children].find((child) => child.matches('.visually-hidden[role="' + role + '"]'));
	if (region !== undefined) {
		return {region, fresh: false};
	}
	region = Object.assign(document.createElement('div'), {className: 'visually-hidden'});
	region.setAttribute('role', role);
	scope.append(region);
	return {region, fresh: true};
};

regionIn(document.body, 'status');

/** Says the message politely, or at once when it is urgent. */
export const announce = (message, urgent = false) => {
	const {region, fresh} = regionIn([...document.querySelectorAll('dialog:modal')].at(-1) ?? document.body, urgent ? 'alert' : 'status');
	region.textContent = '';
	setTimeout(() => {
		region.textContent = message;
	}, fresh ? 100 : 0);
};

// REDZ.UI, sharing: a button with command="--share" shares data-share-url - the page's own address when it has none - and
// data-share-title through the device's share sheet where it has one; elsewhere it opens its menu, aria-controls, as
// its popover. The library writes the addresses of the menu's links by their class - share-telegram, share-facebook,
// share-messenger, share-linkedin, share-vk, share-line, share-whatsapp - and the URL into a --copy item without
// data-copy. Like --toggle, the button has no commandfor.
const NETWORKS = {
	telegram: 'https://t.me/share/url?url={url}&text={title}',
	facebook: 'https://www.facebook.com/sharer/sharer.php?u={url}',
	messenger: 'fb-messenger://share/?link={url}',
	linkedin: 'https://www.linkedin.com/sharing/share-offsite/?url={url}',
	vk: 'https://vk.com/share.php?url={url}&title={title}',
	line: 'https://social-plugins.line.me/lineit/share?url={url}',
	whatsapp: 'https://wa.me/?text={title}%20{url}',
};
const failed = new WeakSet();

/** What the button shares. */
const sharedBy = (button) => ({url: new URL(button.dataset.shareUrl || location.href, location.href).href, title: button.dataset.shareTitle || document.title});

/** Whether the button shares by the device's own sheet: there is one, and it has not failed it. */
const sheet = (button) => !failed.has(button) && typeof navigator.share === 'function' && navigator.canShare?.(sharedBy(button)) !== false;

/** The button's menu with its links written, and the button made its popover's invoker unless the sheet shares; null
 *  when it has no menu. */
const ready = (button) => {
	const menu = document.getElementById((button.getAttribute('aria-controls') || '').trim());
	if (menu === null) {
		return null;
	}
	const {url, title} = sharedBy(button);
	for (const [network, address] of Object.entries(NETWORKS)) {
		for (const link of menu.querySelectorAll('a.share-' + network)) {
			link.href = address.replace('{url}', encodeURIComponent(url)).replace('{title}', encodeURIComponent(title));
			link.target ||= '_blank';
			link.rel ||= 'noopener';
		}
	}
	for (const copy of menu.querySelectorAll('[command="--copy"]:not([data-copy])')) {
		copy.dataset.copy = url;
	}
	if (sheet(button)) {
		button.removeAttribute('popovertarget');
	} else {
		button.setAttribute('popovertarget', menu.id);
	}
	return menu;
};

document.addEventListener('click', (event) => {
	const button = event.target instanceof Element ? event.target.closest('button[command="--share"]') : null;
	if (button === null || button.disabled || button.getAttribute('aria-disabled') === 'true') {
		return;
	}
	ready(button);
	if (!sheet(button)) {
		return;
	}
	navigator.share(sharedBy(button)).catch((error) => {
		if (error?.name !== 'AbortError') {
			failed.add(button);
			if (ready(button) !== null) {
				button.click();
			}
		}
	});
});

document.addEventListener('beforetoggle', (event) => {
	for (const button of event.target.id ? document.querySelectorAll('button[command="--share"][aria-controls="' + CSS.escape(event.target.id) + '"]') : []) {
		button.setAttribute('aria-expanded', String(event.newState === 'open'));
	}
}, true);

for (const button of document.querySelectorAll('button[command="--share"]')) {
	ready(button);
}

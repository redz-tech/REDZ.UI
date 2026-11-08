// REDZ.UI, trees: a list of class tree whose items open their tree-group by a --toggle button (js/toggle.js). A group
// with data-lazy fires redz:load when it first opens (js/lazy.js), its toggle busy until the page has put the items in;
// a refusal leaves it open with the page's words, for another try when it opens again. A button with commandfor naming
// the tree and command="--expand-all" or "--collapse-all" opens or closes every group of it that holds items.
import {busy} from './busy.js';
import {mark} from './toggle.js';
import {load} from './lazy.js';

/** Opens or closes the group, its buttons saying so. */
const show = (group, open) => {
	if (open) {
		group.hidden = false;
	} else {
		group.setAttribute('hidden', 'until-found');
	}
	mark(group, open);
};

document.addEventListener('command', (event) => {
	const target = event.target;
	if (!(target instanceof HTMLElement)) {
		return;
	}
	if (event.command === '--toggle' && target.classList.contains('tree-group') && 'lazy' in target.dataset && !target.hidden) {
		load(target, event.source instanceof HTMLButtonElement ? (answer) => busy(event.source, answer) : null);
		return;
	}
	if ((event.command === '--expand-all' || event.command === '--collapse-all') && target.classList.contains('tree')) {
		for (const group of target.querySelectorAll('.tree-group')) {
			if (group.childElementCount > 0) {
				show(group, event.command === '--expand-all');
			}
		}
	}
}, true);

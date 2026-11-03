// REDZ.UI, trees: a list of class tree whose items open their tree-group by a --toggle button (js/toggle.js). A group
// with data-lazy and no items fires the cancelable redz:expand (js/answer.js) when it first opens: answered with a
// promise, its toggle is busy until the page has put the items in, and a refusal closes it again for another try. A
// button with commandfor naming the tree and command="--expand-all" or "--collapse-all" opens or closes every group of
// it that holds items.
import {ask} from './answer.js';
import {busy} from './busy.js';
import {mark} from './toggle.js';

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
	if (event.command === '--toggle' && target.classList.contains('tree-group') && 'lazy' in target.dataset && target.childElementCount === 0) {
		delete target.dataset.lazy;
		const [, answer] = ask(target, 'redz:expand', {group: target});
		if (answer !== null) {
			(event.source instanceof HTMLButtonElement ? busy(event.source, answer) : answer).catch(() => {
				target.dataset.lazy = '';
				show(target, false);
			});
		}
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

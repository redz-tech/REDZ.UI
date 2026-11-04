// REDZ.UI, the window's progress: REDZ.ui.progress(promise) shows a thin bar along the top of the window while the
// promise runs - after 150 ms, then for at least 400 ms, one bar however many promises run at once - and answers the
// promise. Readers do not hear it: the busy states of what waits say the rest. Under reduced motion it stands still.
let bar = null;
let running = 0;
let since = 0;
let timer = 0;

/** Shows the bar, in the top layer. */
const show = () => {
	if (bar === null) {
		bar = Object.assign(document.createElement('progress'), {className: 'progress progress-xs progress-top', popover: 'manual'});
		bar.setAttribute('aria-hidden', 'true');
		document.body.append(bar);
	}
	bar.showPopover();
	since = performance.now();
};

/** Shows the bar while the promise runs; answers the promise. */
export const progress = (promise) => {
	if (running++ === 0) {
		clearTimeout(timer);
		if (since === 0) {
			timer = setTimeout(show, 150);
		}
	}
	return Promise.resolve(promise).finally(() => {
		if (--running > 0) {
			return;
		}
		clearTimeout(timer);
		if (since !== 0) {
			timer = setTimeout(() => {
				bar.hidePopover();
				since = 0;
			}, Math.max(0, since + 400 - performance.now()));
		}
	});
};

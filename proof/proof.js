// REDZ.UI, the proof file (a file of the release on its own, js/redz-ui-proof.min.js): the family's one solver of a
// form's proof of work, a classic script needing no other file of the library - no main script, no styles - and
// writing no markup. Started as a dedicated worker it answers each {at, task, width} with {at, found}, many walks at
// once, each by its own at, in any order; {at, stop: true} ends that walk, which answers -1. Loaded by a script tag
// into a page, where no worker could start, it fires redz:solver on the document at once, its detail the call
// solve(task, {width, signal}), a promise of the counter or -1 that never rejects.
import {solve} from './walk.js';

if (typeof WorkerGlobalScope !== 'undefined' && globalThis instanceof WorkerGlobalScope) {
	const walks = new Map();
	globalThis.addEventListener('message', (event) => {
		const {at, task, width, stop} = event.data ?? {};
		if (stop === true) {
			walks.get(at)?.abort();
			return;
		}
		const control = new AbortController();
		walks.set(at, control);
		solve(task, {width, signal: control.signal}).then((found) => {
			if (walks.get(at) === control) {
				walks.delete(at);
			}
			globalThis.postMessage({at, found});
		});
	});
} else {
	document.dispatchEvent(new CustomEvent('redz:solver', {detail: solve}));
}

// REDZ.UI, uploads: an element of class upload holds an input type="file", a button of class upload-zone that opens it
// and takes the files dropped on it, a <template> of one file's row and a list of class upload-list. Chosen, dropped or
// pasted while the focus is in the upload, each file is checked against the input's accept and the upload's
// data-max-size in bytes, gets its row — its name in the row's data-file-name and in the label of its data-file-remove
// button, by the page's text remove — and fires the cancelable redz:files
// (js/answer.js) with the file, the row, progress(fraction) for the row's progress bar and a signal its data-file-remove
// button aborts: the page sends it; resolved, the row is done; rejected, the page's words show in its data-file-error,
// as a refusal shows the page's text file.type or file.size. Left alone, the file joins the input's files for the form.
// A file dropped elsewhere on the page does not open in the window.
import {ask} from './answer.js';
import {text} from './text.js';

const kept = new WeakMap();
const files = new WeakMap();
const aborts = new WeakMap();
let over = null;
let depth = 0;

const inputOf = (upload) => upload.querySelector('input[type="file"]');
const carries = (event) => event.dataTransfer?.types.includes('Files') ?? false;

/** Whether the input's accept takes the file: by its extension, its type, or its type's family. */
const accepts = (input, file) => {
	const wanted = input.accept.split(',').map((one) => one.trim().toLowerCase()).filter(Boolean);
	const name = file.name.toLowerCase();
	const type = file.type.toLowerCase();
	return wanted.length === 0 || wanted.some((one) => one.startsWith('.') ? name.endsWith(one) : (one.endsWith('/*') ? type.startsWith(one.slice(0, -1)) : type === one));
};

/** The byte count in the page language's units. */
const sizeOf = (bytes) => {
	const mega = bytes >= 1048576;
	return new Intl.NumberFormat(document.documentElement.lang || 'en', {style: 'unit', unit: mega ? 'megabyte' : 'kilobyte', maximumFractionDigits: 1}).format(bytes / (mega ? 1048576 : 1024));
};

/** The input holds the files kept for the form. */
const sync = (upload) => {
	const box = new DataTransfer();
	for (const file of kept.get(upload) ?? []) {
		box.items.add(file);
	}
	inputOf(upload).files = box.files;
};

/** The row's end: done, or failed with words; its bar full when done. */
const end = (row, state, words = '') => {
	row.dataset.state = state;
	row.removeAttribute('aria-busy');
	const error = row.querySelector('[data-file-error]');
	if (error !== null && words !== '') {
		error.setAttribute('role', 'alert');
		error.textContent = words;
	}
	const bar = row.querySelector('progress');
	if (bar !== null && state === 'done') {
		bar.max = 1;
		bar.value = 1;
	}
};

/** Checks each file, gives it its row, and asks the page to send it — or keeps it for the form. */
const take = (upload, chosen) => {
	const input = inputOf(upload);
	const template = upload.querySelector('template');
	const most = Number(upload.dataset.maxSize || 0);
	for (const file of chosen) {
		const row = template.content.firstElementChild.cloneNode(true);
		const name = row.querySelector('[data-file-name]');
		if (name !== null) {
			name.textContent = file.name;
		}
		row.querySelector('[data-file-remove]')?.setAttribute('aria-label', text('remove', {label: file.name}));
		files.set(row, file);
		upload.querySelector('.upload-list').append(row);
		if (!accepts(input, file)) {
			end(row, 'failed', text('file.type', {name: file.name}));
			continue;
		}
		if (most > 0 && file.size > most) {
			end(row, 'failed', text('file.size', {name: file.name, size: sizeOf(most)}));
			continue;
		}
		const bar = row.querySelector('progress');
		const controller = new AbortController();
		aborts.set(row, controller);
		row.dataset.state = 'sending';
		row.setAttribute('aria-busy', 'true');
		const progress = (fraction) => {
			if (bar !== null) {
				bar.max = 1;
				bar.value = Math.min(1, Math.max(0, fraction));
			}
		};
		const [taken, answer] = ask(upload, 'redz:files', {file, row, progress, signal: controller.signal});
		if (!taken) {
			kept.set(upload, [...(kept.get(upload) ?? []), file]);
			end(row, 'ready');
		} else if (answer !== null) {
			answer.then(() => end(row, 'done'), (words) => controller.signal.aborted || end(row, 'failed', String(words ?? '')));
		}
	}
	sync(upload);
};

document.addEventListener('click', (event) => {
	const target = event.target instanceof Element ? event.target : null;
	const zone = target?.closest('.upload-zone');
	if (zone) {
		inputOf(zone.closest('.upload'))?.click();
		return;
	}
	const remove = target?.closest('[data-file-remove]');
	const row = remove?.closest('.upload-list > *');
	const upload = row?.closest('.upload');
	if (upload) {
		aborts.get(row)?.abort();
		kept.set(upload, (kept.get(upload) ?? []).filter((file) => file !== files.get(row)));
		sync(upload);
		const next = row.nextElementSibling ?? row.previousElementSibling;
		row.remove();
		(next?.querySelector('[data-file-remove]') ?? upload.querySelector('.upload-zone'))?.focus();
	}
});

document.addEventListener('change', (event) => {
	const input = event.target;
	const upload = input instanceof HTMLInputElement && input.type === 'file' ? input.closest('.upload') : null;
	if (upload !== null) {
		take(upload, [...input.files]);
	}
});

document.addEventListener('dragenter', (event) => {
	const zone = event.target instanceof Element ? event.target.closest('.upload-zone') : null;
	if (zone !== null && carries(event)) {
		depth = zone === over ? depth + 1 : 1;
		over = zone;
		zone.dataset.over = '';
	}
});

document.addEventListener('dragleave', (event) => {
	if (over !== null && event.target instanceof Element && over.contains(event.target) && --depth <= 0) {
		delete over.dataset.over;
		over = null;
	}
});

document.addEventListener('dragover', (event) => {
	if (carries(event)) {
		event.preventDefault();
		event.dataTransfer.dropEffect = event.target instanceof Element && event.target.closest('.upload-zone') ? 'copy' : 'none';
	}
});

document.addEventListener('drop', (event) => {
	if (!carries(event)) {
		return;
	}
	event.preventDefault();
	const zone = event.target instanceof Element ? event.target.closest('.upload-zone') : null;
	if (over !== null) {
		delete over.dataset.over;
		over = null;
	}
	if (zone !== null) {
		take(zone.closest('.upload'), [...event.dataTransfer.files]);
	}
});

document.addEventListener('paste', (event) => {
	const upload = event.target instanceof Element ? event.target.closest('.upload') : null;
	if (upload !== null && (event.clipboardData?.files.length ?? 0) > 0) {
		event.preventDefault();
		take(upload, [...event.clipboardData.files]);
	}
});

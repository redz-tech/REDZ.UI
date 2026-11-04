// REDZ.UI, uploads: an element of class upload holds an input type="file", a button of class upload-zone that opens it
// and takes the files dropped on it, a <template> of one file's row and a list of class upload-list. Chosen, dropped or
// pasted while the focus is in the upload, each file is checked against the input's accept, the upload's data-max-size
// in bytes and its data-max-files, gets its row - its name in the row's data-file-name and in the label of its
// data-file-remove button, by the page's text remove, an image's own preview in its img data-file-preview - and fires
// the cancelable redz:files (js/answer.js) with the file, the row, progress(fraction) for the row's progress bar and a
// signal its data-file-remove button aborts: the page sends it; resolved, the row is done - resolved with a file, a
// resized one say, that file joins the input's files in its place; rejected, the page's words show in its
// data-file-error, as a refusal shows the page's text file.type, file.size or file.count. Left alone, the file joins
// the input's files for the form. An input without multiple holds one file: a new one takes the place of the one
// before, its sending aborted, and of several dropped or pasted only the first is taken. A row the server wrote for a
// file it holds carries data-file-stored, its id: its Remove asks the page in the cancelable redz:remove (detail.id,
// detail.row) - busy while the page's promise runs, gone when it resolves, its words said when it rejects; untaken, the
// row goes, with any field of its own. After each change the upload fires redz:change with detail.count, the files it
// holds, stored and new. The zone may be a plain button.btn. A file dropped elsewhere on the page does not open in the
// window.
import {ask} from './answer.js';
import {announce} from './say.js';
import {text} from './text.js';

const kept = new WeakMap();
const files = new WeakMap();
const aborts = new WeakMap();
const previews = new WeakMap();

/** Takes the row away: its sending aborted, its preview let go. */
const drop = (row) => {
	aborts.get(row)?.abort();
	URL.revokeObjectURL(previews.get(row) ?? '');
	row.remove();
};
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

/** Tells the page how many files the upload holds now, stored and new, refused ones aside. */
const changed = (upload) => {
	const count = upload.querySelectorAll('.upload-list > :not([data-state="failed"])').length;
	upload.dispatchEvent(new CustomEvent('redz:change', {bubbles: true, detail: {count}}));
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

/** Checks each file, gives it its row, and asks the page to send it - or keeps it for the form. */
const take = (upload, given) => {
	const input = inputOf(upload);
	const chosen = input.multiple ? given : given.slice(0, 1);
	if (!input.multiple && chosen.length > 0) {
		upload.querySelectorAll('.upload-list > *').forEach(drop);
		kept.set(upload, []);
	}
	const template = upload.querySelector('template');
	const list = upload.querySelector('.upload-list');
	const most = Number(upload.dataset.maxSize || 0);
	const count = Number(upload.dataset.maxFiles || 0);
	for (const file of chosen) {
		const held = list.querySelectorAll(':scope > :not([data-state="failed"])').length;
		const row = template.content.firstElementChild.cloneNode(true);
		const name = row.querySelector('[data-file-name]');
		if (name !== null) {
			name.textContent = file.name;
		}
		row.querySelector('[data-file-remove]')?.setAttribute('aria-label', text('remove', {label: file.name}));
		const preview = row.querySelector('img[data-file-preview]');
		if (preview !== null && file.type.startsWith('image/')) {
			preview.alt = '';
			preview.src = URL.createObjectURL(file);
			previews.set(row, preview.src);
		}
		files.set(row, file);
		list.append(row);
		if (!accepts(input, file)) {
			end(row, 'failed', text('file.type', {name: file.name}));
			continue;
		}
		if (most > 0 && file.size > most) {
			end(row, 'failed', text('file.size', {name: file.name, size: sizeOf(most)}));
			continue;
		}
		if (count > 0 && held >= count) {
			end(row, 'failed', text('file.count', {name: file.name, count}));
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
			answer.then((made) => {
				if (controller.signal.aborted) {
					return;
				}
				if (made instanceof Blob) {
					const own = made instanceof File ? made : new File([made], file.name, {type: made.type});
					files.set(row, own);
					kept.set(upload, [...(kept.get(upload) ?? []), own]);
					sync(upload);
					end(row, 'ready');
					return;
				}
				end(row, 'done');
			}, (words) => controller.signal.aborted || end(row, 'failed', String(words ?? '')));
		}
	}
	sync(upload);
	if (chosen.length > 0) {
		changed(upload);
	}
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
	if (!upload || row.getAttribute('aria-busy') === 'true') {
		return;
	}
	const leave = () => {
		kept.set(upload, (kept.get(upload) ?? []).filter((file) => file !== files.get(row)));
		sync(upload);
		const next = row.nextElementSibling ?? row.previousElementSibling;
		drop(row);
		(next?.querySelector('[data-file-remove]') ?? upload.querySelector('.upload-zone'))?.focus();
		changed(upload);
	};
	if (!row.hasAttribute('data-file-stored')) {
		leave();
		return;
	}
	const [taken, answer] = ask(upload, 'redz:remove', {id: row.dataset.fileStored, row});
	if (!taken) {
		leave();
	} else if (answer !== null) {
		row.setAttribute('aria-busy', 'true');
		answer.then(leave, (words) => {
			row.removeAttribute('aria-busy');
			const error = row.querySelector('[data-file-error]');
			if (error === null) {
				announce(String(words ?? ''));
				return;
			}
			error.setAttribute('role', 'alert');
			error.textContent = String(words ?? '');
		});
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

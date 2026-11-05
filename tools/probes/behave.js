// The behaviour checks of the probes: the widgets of the docs' examples, as docs/all.html holds them, driven by the
// events a user's input makes against what each must do. Each check is a list of steps; a step answers a drag for the
// engine's own pointer ({drag: [x, y, x, y]}) or nothing, and pushes its findings. tools/probe.php runs the checks whose
// targets the page has, once, at 1440, light LTR, on the page fresh from its load: REDZ_BEHAVE.targets(), then
// REDZ_BEHAVE.step(name) until it answers {findings}.
window.REDZ_BEHAVE = (() => {
	const wait = (ms) => new Promise((done) => setTimeout(done, ms));
	const $ = (selector, root = document) => root.querySelector(selector);
	const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
	const say = JSON.stringify;
	const near = (a, b, by = 2) => Math.abs(a - b) <= by;
	const input = (field, value) => {
		field.value = value;
		field.dispatchEvent(new Event('input', {bubbles: true}));
	};
	const files = (names, type = 'image/png', body = ['x']) => {
		const box = new DataTransfer();
		for (const name of names) {
			box.items.add(new File(body, name, {type}));
		}
		return box.files;
	};
	const choose = (field, list) => {
		field.files = list;
		field.dispatchEvent(new Event('change', {bubbles: true}));
	};
	const center = (el, fx = 0.5, fy = 0.5) => {
		const box = el.getBoundingClientRect();
		return [Math.round(box.left + box.width * fx), Math.round(box.top + box.height * fy)];
	};
	const values = (selector) => $$(selector).map((el) => el.dataset.value).join(' ');
	// Whether the engine reads a canvas back: CI's Safari, on a machine without a GPU, cannot, so the checks of colours
	// and of a drawn PNG leave it to the other engines.
	const readable = (async () => {
		try {
			const canvas = Object.assign(document.createElement('canvas'), {width: 1, height: 1});
			const paint = canvas.getContext('2d');
			paint.fillStyle = '#0a7f5a';
			paint.fillRect(0, 0, 1, 1);
			paint.getImageData(0, 0, 1, 1);
			return await new Promise((done) => canvas.toBlob((blob) => done(blob !== null), 'image/png'));
		} catch {
			return false;
		}
	})();
	const rgb = (color) => {
		const paint = Object.assign(document.createElement('canvas'), {width: 1, height: 1}).getContext('2d');
		paint.fillStyle = color;
		paint.fillRect(0, 0, 1, 1);
		return [...paint.getImageData(0, 0, 1, 1).data.slice(0, 3)].join(',');
	};

	const checks = {
		pin: {target: '#pin-unlock .pin', steps: [async (out) => {
			const pad = $('#pin-unlock .pin');
			const field = $('input', pad);
			const keys = $$('.pin-keypad > *', pad);
			const press = (key) => {
				const button = $('[data-key="' + key + '"]', pad);
				button.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, cancelable: true}));
				button.click();
			};
			const order = keys.map((key) => key.dataset.key ?? '_').join(' ');
			if (order !== '1 2 3 4 5 6 7 8 9 _ 0 delete') {
				out.push('a pad of a fixed length has the keys ' + order + ', not 1-9, a gap, 0 and delete');
			}
			if (keys.some((key) => key.tagName === 'BUTTON' && key.tabIndex !== -1) || !$('[data-key="delete"]', pad).getAttribute('aria-label')) {
				out.push('its keys are in the Tab order, or delete has no name');
			}
			if ($$('.pin-dots > *', pad).length !== field.maxLength) {
				out.push('it draws ' + $$('.pin-dots > *', pad).length + ' dots for a length of ' + field.maxLength);
			}
			field.focus();
			press('1');
			press('2');
			press('delete');
			press('3');
			if (field.value !== '13' || $$('.pin-dots > [data-filled]', pad).length !== 2 || document.activeElement !== field) {
				out.push('1, 2, delete, 3 leave ' + say(field.value) + ', ' + $$('.pin-dots > [data-filled]', pad).length + ' dots filled, the focus ' + (document.activeElement === field ? 'in' : 'out of') + ' the field');
			}
			press('4');
			press('5');
			await wait(50);
			if (pad.getAttribute('aria-busy') !== 'true' || !field.readOnly) {
				out.push('a full code sent leaves the pad not busy (aria-busy ' + pad.getAttribute('aria-busy') + ', readOnly ' + field.readOnly + ')');
			}
			press('9');
			await wait(900);
			if (field.value !== '' || field.getAttribute('aria-invalid') !== 'true' || document.activeElement !== field || $('#pin-unlock-alert').textContent.trim() === '') {
				out.push('a refused code leaves ' + say(field.value) + ', aria-invalid ' + field.getAttribute('aria-invalid') + ', the focus ' + (document.activeElement === field ? 'in' : 'out of') + ' the field, the alert ' + say($('#pin-unlock-alert').textContent.trim()));
			}
			input(field, 'a2b5');
			if (field.value !== '25' || field.hasAttribute('aria-invalid')) {
				out.push('typing "a2b5" leaves ' + say(field.value) + ', aria-invalid ' + field.getAttribute('aria-invalid') + ' - not the digits, unmarked');
			}
			input(field, '2580');
			await wait(900);
			if (field.value !== '2580' || pad.hasAttribute('aria-busy')) {
				out.push('a taken code leaves ' + say(field.value) + ', aria-busy ' + pad.getAttribute('aria-busy'));
			}
			const any = $('#pin-any .pin');
			const short = $('input', any);
			let sent = 0;
			short.form.addEventListener('submit', (event) => {
				event.preventDefault();
				sent++;
			});
			if (!$('[data-key="enter"]', any)) {
				out.push('a pad of a free length has no Enter key');
			}
			input(short, '12');
			$('[data-key="enter"]', any)?.click();
			input(short, '123456');
			const dots = $$('.pin-dots > *', any).length;
			short.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true}));
			if (sent !== 1 || dots !== 6) {
				out.push('a free length sends ' + sent + ' of a short code and a long one by Enter (1 expected) and draws ' + dots + ' dots for 6 digits');
			}
		}]},
		cooldown: {target: '#btn-cooldown button', steps: [async (out) => {
			const button = $('#btn-cooldown button');
			const count = () => $('.btn-cooldown', button)?.textContent.trim() ?? '';
			if (button.getAttribute('aria-disabled') !== 'true' || $('.btn-cooldown', button)?.getAttribute('aria-hidden') !== 'true' || count() === '') {
				out.push('a counting button is not aria-disabled, or its count is missing or not hidden from readers');
			}
			button.dataset.cooldown = '2';
			await wait(100);
			if (!count().includes('2')) {
				out.push('data-cooldown="2" set again counts ' + say(count()));
			}
			let clicked = 0;
			button.addEventListener('click', () => clicked++);
			button.click();
			await wait(2300);
			if (clicked !== 0 || button.hasAttribute('aria-disabled') || button.hasAttribute('data-cooldown') || count() !== '') {
				out.push('the count let a click through (' + clicked + '), or at its end left aria-disabled ' + button.getAttribute('aria-disabled') + ', data-cooldown ' + button.dataset.cooldown + ', the count ' + say(count()));
			}
			button.click();
			await wait(100);
			if (clicked !== 1 || button.getAttribute('aria-disabled') !== 'true') {
				out.push('a click after the count reaches the page ' + clicked + ' times, and the restarted count leaves aria-disabled ' + button.getAttribute('aria-disabled'));
			}
		}]},
		busy: {target: '#busy-button [data-busy]', steps: [async (out) => {
			const [plain, worded] = $$('#busy-button button');
			const before = worded.innerHTML;
			let done;
			const waited = REDZ.ui.busy(worded, new Promise((settle) => {
				done = settle;
			}));
			await wait(50);
			const icon = $('.bi', worded);
			if (worded.textContent.trim() !== worded.dataset.busy || getComputedStyle(icon).borderTopStyle !== 'solid') {
				out.push('a busy button with words shows ' + say(worded.textContent.trim()) + ', not ' + say(worded.dataset.busy) + ', and its icon is ' + (getComputedStyle(icon).borderTopStyle === 'solid' ? '' : 'not ') + 'a spinner');
			}
			await wait(500);
			if (!$$('[role="status"]').some((status) => status.textContent === worded.dataset.busy)) {
				out.push('its words are not said by a status');
			}
			done();
			await waited;
			if (worded.innerHTML !== before) {
				out.push('settled, it does not show what it showed before');
			}
			const quiet = REDZ.ui.busy(plain, wait(100));
			await wait(20);
			if (getComputedStyle(plain, '::after').content === 'none') {
				out.push('a busy button without words draws no spinner');
			}
			await quiet;
		}]},
		confirm: {target: '#dialog-confirm-lists', steps: [async (out) => {
			const asked = REDZ.ui.confirm({title: 'Delete the project?', text: 'Gone for good.', note: {tone: 'danger', text: 'This cannot be undone.'}, sections: [{title: 'Will be deleted:', items: ['128 tasks', '342 <b>files</b>']}, {title: 'Kept:', items: ['The audit history']}], ok: 'Delete', tone: 'danger', phrase: 'Riverside'});
			await wait(200);
			const dialog = $('dialog[open]');
			const described = (dialog.getAttribute('aria-describedby') ?? '').split(' ').map((id) => document.getElementById(id)?.textContent).join(' | ');
			if (described !== 'Gone for good. | This cannot be undone.') {
				out.push('a confirmation with a note is described by ' + say(described));
			}
			const lists = $$('.dialog-body h3', dialog).map((h) => h.textContent + ':' + $$('li', h.parentElement).map((li) => li.textContent).join(',')).join(' ');
			if (lists !== 'Will be deleted::128 tasks,342 <b>files</b> Kept::The audit history' || $('b', dialog) !== null || !$('.dialog-body > .alert', dialog)) {
				out.push('its lists read ' + say(lists) + ($('b', dialog) ? ', with markup made of their text' : '') + ($('.dialog-body > .alert', dialog) ? '' : ', without the note'));
			}
			const field = document.activeElement;
			if (!field.id.endsWith('-phrase')) {
				out.push('the focus is not in the phrase field');
			} else {
				input(field, 'Riverside');
				field.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true}));
			}
			if (await Promise.race([asked, wait(500).then(() => 'unanswered')]) !== true) {
				out.push('the phrase typed and Enter do not answer true');
			}
			const plain = REDZ.ui.confirm({title: 'Plain?'});
			await wait(100);
			if ($('dialog[open]').hasAttribute('aria-describedby')) {
				out.push('a confirmation without text is described');
			}
			$('dialog[open] button[value="cancel"]').click();
			if (await plain !== false) {
				out.push('Cancel does not answer false');
			}
		}]},
		chart: {target: '#chart-messages table.chart', steps: [async (out) => {
			const table = $('#chart-messages table.chart');
			const roles = [table, $('caption', table), table.tBodies[0], $('thead th', table), $('tbody th', table), $('tbody td', table)].map((el) => el.getAttribute('role')).join(' ');
			if (roles !== 'table caption rowgroup columnheader rowheader cell') {
				out.push('a chart table carries the roles ' + say(roles));
			}
			const cell = $('tbody td[data-v]', table);
			const room = table.tBodies[0].getBoundingClientRect().height;
			const height = () => cell.getBoundingClientRect().height;
			if (cell.style.getPropertyValue('--v') !== cell.dataset.v || !near(height(), Number(cell.dataset.v) * room, 3)) {
				out.push('a column of ' + cell.dataset.v + ' has --v ' + say(cell.style.getPropertyValue('--v')) + ' and ' + Math.round(height()) + ' of ' + Math.round(room) + ' px');
			}
			if (getComputedStyle(cell).backgroundColor !== getComputedStyle($('thead th:nth-child(2)', table), '::before').backgroundColor) {
				out.push('a series is drawn in another colour than its legend');
			}
			cell.dataset.v = '0.1';
			await wait(50);
			if (cell.style.getPropertyValue('--v') !== '0.1' || !near(height(), 0.1 * room, 3)) {
				out.push('a column whose data-v changed to 0.1 is ' + Math.round(height()) + ' px');
			}
			const box = document.createElement('div');
			box.className = 'overflow-x-auto';
			const late = document.createElement('table');
			late.className = 'chart';
			late.innerHTML = '<thead><tr><th>Day</th><th>A</th></tr></thead><tbody>' + Array.from({length: 90}, (_, i) => '<tr><th><span class="visually-hidden">' + i + '</span></th><td data-v="' + (i % 10) / 10 + '">' + i + '</td></tr>').join('') + '</tbody>';
			box.append(late);
			$('#chart-messages').append(box);
			await wait(50);
			if (late.getAttribute('role') !== 'table' || $('td', late).style.getPropertyValue('--v') !== '0') {
				out.push('a chart added later gets no roles or no numbers');
			}
			if (box.scrollWidth > box.clientWidth + 1) {
				out.push('90 columns overflow their box: ' + box.scrollWidth + ' > ' + box.clientWidth);
			}
			box.remove();
			const spark = $('#chart-sparks .spark-lg');
			if (spark && (Math.round(spark.getBoundingClientRect().height) !== 64 || getComputedStyle(spark, '::after').bottom === 'auto')) {
				out.push('a large spark is ' + spark.getBoundingClientRect().height + ' px tall, its median at ' + getComputedStyle(spark, '::after').bottom);
			}
			const tick = $('#chart-board .lanes-tick-once');
			const track = tick.parentElement.getBoundingClientRect();
			const at = (tick.getBoundingClientRect().left - track.left) / track.width;
			if (!near(at, Number(tick.dataset.at), 0.01)) {
				out.push('a tick at ' + tick.dataset.at + ' is drawn at ' + at.toFixed(3));
			}
		}]},
		highlight: {target: '#chart-board tr[data-highlight]', steps: [async (out) => {
			const lane = $('#chart-board tr[data-highlight]');
			const key = lane.dataset.highlight;
			lane.dispatchEvent(new PointerEvent('pointerover', {bubbles: true}));
			const lit = $$('[data-highlighted]');
			if (lit.length !== $$('[data-highlight="' + key + '"]').length || lit.some((el) => el.dataset.highlight !== key)) {
				out.push('pointing at a lane lights ' + say(lit.map((el) => el.dataset.highlight)) + ', not every ' + key);
			}
			$('#chart-board caption').dispatchEvent(new PointerEvent('pointerover', {bubbles: true}));
			if ($$('[data-highlighted]').length !== 0) {
				out.push('pointing elsewhere leaves ' + $$('[data-highlighted]').length + ' lit');
			}
		}]},
		view: {target: '#media-folder-grid', steps: [async (out) => {
			const grid = $('#media-folder-grid');
			const [tiles, rows] = $$('[command="--view"][aria-controls="media-folder-grid"]');
			const pressed = () => tiles.getAttribute('aria-pressed') + '/' + rows.getAttribute('aria-pressed');
			const columns = () => getComputedStyle(grid).gridTemplateColumns.split(' ').length;
			if (grid.dataset.view !== 'grid' || pressed() !== 'true/false' || columns() < 2) {
				out.push('at rest: data-view ' + grid.dataset.view + ', pressed ' + pressed() + ', ' + columns() + ' columns');
			}
			let told = '';
			document.addEventListener('redz:view', (event) => {
				told = event.detail.view;
			}, {once: true});
			rows.click();
			await wait(50);
			if (grid.dataset.view !== 'list' || pressed() !== 'false/true' || told !== 'list' || columns() !== 1 || getComputedStyle($('.media-tile-thumb', grid)).display !== 'none' || getComputedStyle($('.media-tile-name > .bi', grid)).display === 'none') {
				out.push('the list view: data-view ' + grid.dataset.view + ', pressed ' + pressed() + ', redz:view ' + say(told) + ', ' + columns() + ' columns, thumbs ' + getComputedStyle($('.media-tile-thumb', grid)).display + ', name icons ' + getComputedStyle($('.media-tile-name > .bi', grid)).display);
			}
			grid.dataset.view = 'grid';
			await wait(50);
			if (pressed() !== 'true/false') {
				out.push('data-view written by the page leaves its buttons pressed ' + pressed());
			}
		}]},
		nav: {target: '#nav-scrolling .nav', steps: [async (out) => {
			const nav = $('#nav-scrolling .nav');
			const current = $('[aria-current]', nav).getBoundingClientRect();
			const box = nav.getBoundingClientRect();
			if (current.left < box.left - 1 || current.right > box.right + 1) {
				out.push('loaded, its current item is out of its view');
			}
			const at = async (left) => {
				nav.scrollLeft = left;
				await wait(100);
				return nav.dataset.more;
			};
			const ltr = [await at(0), await at(nav.scrollWidth)];
			document.documentElement.dir = 'rtl';
			await wait(100);
			const rtl = [await at(0), await at(-nav.scrollWidth)];
			document.documentElement.dir = 'ltr';
			await wait(100);
			if (say([...ltr, ...rtl]) !== say(['end', 'start', 'end', 'start'])) {
				out.push('data-more at the start and the end reads ' + say(ltr) + ' left to right, ' + say(rtl) + ' right to left - not end, start');
			}
			const fits = $$('.nav').filter((other) => other.scrollWidth <= other.clientWidth && other.hasAttribute('data-more'));
			if (fits.length > 0) {
				out.push(fits.length + ' navs that fit carry data-more');
			}
		}]},
		upload: {target: '#upload-one .upload', steps: [async (out) => {
			const one = $('#upload-one .upload');
			const field = $('input[type="file"]', one);
			const shown = () => $$('[data-file-name]', one).map((name) => name.textContent).join(',') + ' / ' + [...field.files].map((file) => file.name).join(',');
			choose(field, files(['a.png']));
			choose(field, files(['b.png']));
			await wait(20);
			const second = shown();
			$('.upload-zone', one).dispatchEvent(new DragEvent('drop', {bubbles: true, cancelable: true, dataTransfer: (() => {
				const box = new DataTransfer();
				box.items.add(new File(['x'], 'c.png', {type: 'image/png'}));
				box.items.add(new File(['x'], 'd.png', {type: 'image/png'}));
				return box;
			})()}));
			await wait(20);
			if (second !== 'b.png / b.png' || shown() !== 'c.png / c.png') {
				out.push('one file at a time: a second choice shows ' + say(second) + ', two dropped ' + say(shown()) + ' (the row / the field)');
			}
			const many = $('#upload-photos .upload');
			const more = $('input[type="file"]', many);
			const before = $$('[data-file-name]', many).length;
			choose(more, files(['x.png', 'y.png']));
			await wait(20);
			choose(more, files(['z.png']));
			await wait(50);
			if ($$('[data-file-name]', many).length !== before + 3) {
				out.push('a field of many files keeps ' + ($$('[data-file-name]', many).length - before) + ' of 3 chosen in two goes');
			}
		}]},
		thumbs: {target: '#upload-shots .upload', steps: [async (out) => {
			const up = $('#upload-shots .upload');
			const field = $('input[type="file"]', up);
			const png = await new Promise((done) => {
				const canvas = document.createElement('canvas');
				canvas.width = 40;
				canvas.height = 30;
				canvas.getContext('2d').fillRect(0, 0, 40, 30);
				canvas.toBlob(done, 'image/png');
			});
			const max = Number(up.dataset.maxFiles);
			choose(field, files(Array.from({length: max + 1}, (_, i) => 'p' + i + '.png'), 'image/png', [png]));
			await wait(100);
			const rows = $$('.upload-list > *', up);
			const states = rows.map((row) => (row.dataset.state ?? '') + ':' + ($('[data-file-preview]', row)?.src.startsWith('blob:') ? 'preview' : 'none'));
			const refused = rows.at(-1);
			if (states.slice(0, max).some((state) => state !== 'ready:preview') || refused?.dataset.state !== 'failed' || ($('[data-file-error]', refused)?.textContent ?? '') === '' || field.files.length !== max) {
				out.push(max + 1 + ' images for ' + max + ' places: rows ' + say(states) + ', the last one\'s error ' + say($('[data-file-error]', refused)?.textContent ?? '') + ', ' + field.files.length + ' in the field');
			}
			const tile = rows[0].getBoundingClientRect();
			if (!near(tile.width, tile.height, 1)) {
				out.push('a thumbnail tile is ' + Math.round(tile.width) + ' × ' + Math.round(tile.height));
			}
			const src = $('img', rows[0]).src;
			const revoked = [];
			const revoke = URL.revokeObjectURL;
			URL.revokeObjectURL = (url) => {
				revoked.push(url);
				revoke.call(URL, url);
			};
			$('[data-file-remove]', rows[0]).click();
			await wait(50);
			URL.revokeObjectURL = revoke;
			if (!revoked.includes(src)) {
				out.push('a removed file\'s preview URL is not revoked');
			}
			up.addEventListener('redz:files', (event) => {
				event.preventDefault();
				event.detail.respondWith(wait(100).then(() => new File(['small'], 'small-' + event.detail.file.name, {type: 'image/png'})));
			}, {once: true});
			choose(field, files(['e.png'], 'image/png', [png]));
			await wait(30);
			const busy = $('.upload-list > :last-child', up).dataset.state;
			await wait(300);
			const state = $('.upload-list > :last-child', up).dataset.state;
			if (busy !== 'sending' || state !== 'ready' || ![...field.files].some((file) => file.name === 'small-e.png')) {
				out.push('a file the page makes smaller: ' + busy + ' then ' + state + ', the field holds ' + say([...field.files].map((file) => file.name)));
			}
		}]},
		thread: {target: '#thread-desk', steps: [async (out) => {
			const remove = $('#thread-desk .thread-file-remove');
			const at = [getComputedStyle(remove).display];
			$('#thread-desk [command="--edit"]').click();
			await wait(100);
			at.push(getComputedStyle(remove).display);
			const focus = document.activeElement.tagName;
			document.activeElement.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true}));
			await wait(100);
			at.push(getComputedStyle(remove).display);
			if (at[0] !== 'none' || at[1] === 'none' || at[2] !== 'none' || focus !== 'TEXTAREA') {
				out.push('a message\'s file Remove shows ' + say(at) + ' at rest, editing and after Escape, the focus in ' + focus + ' while editing');
			}
			const body = $('#thread-desk .card-body');
			if (body.scrollHeight <= body.clientHeight) {
				out.push('a long thread does not scroll in its card');
			}
		}]},
		alert: {target: '#alert-fill-words', steps: [async (out) => {
			const alert = $('#alert-fill-words');
			const run = $('[data-docs-run="alert-fill"]');
			const tall = () => Math.round(alert.getBoundingClientRect().height);
			const empty = [tall(), alert.getAttribute('role')];
			run.click();
			await wait(50);
			const filled = [tall(), alert.textContent !== ''];
			run.click();
			await wait(50);
			if (empty[0] > 1 || empty[1] !== 'alert' || filled[0] < 20 || !filled[1] || tall() > 1) {
				out.push('an empty alert is ' + empty[0] + ' px tall, ' + filled[0] + ' px filled, ' + tall() + ' px emptied again');
			}
		}]},
		grow: {target: '#form-grow-text', steps: [async (out) => {
			const field = $('#form-grow-text');
			const tall = () => Math.round(field.getBoundingClientRect().height);
			const one = tall();
			input(field, field.value + '\nThe second line\nThe third line');
			await wait(50);
			const three = tall();
			input(field, 'One line');
			await wait(50);
			if (one > 48 || three < one + 30 || tall() !== one) {
				out.push('a growing field of one row is ' + one + ' px, ' + three + ' px with three lines, ' + tall() + ' px with one again');
			}
		}]},
		counter: {target: '#form-counter-title-count', steps: [async (out) => {
			const counter = $('#form-counter-title-count');
			const field = $('#form-counter-title');
			const start = [counter.textContent, counter.dataset.state ?? ''];
			input(field, 'x'.repeat(55));
			const near = counter.dataset.state;
			input(field, 'x'.repeat(61));
			const over = [counter.textContent, counter.dataset.state];
			await wait(1100);
			const said = counter.nextElementSibling?.getAttribute('aria-live') === 'polite' ? counter.nextElementSibling.textContent : '';
			if (start[0] !== field.defaultValue.length + ' / 60' || start[1] !== '' || near !== 'near' || over[0] !== '61 / 60' || over[1] !== 'over' || said === '') {
				out.push('a counter reads ' + say(start) + ' at rest, ' + say(near) + ' at 55 of 60, ' + say(over) + ' at 61, and says ' + say(said));
			}
		}]},
		step: {target: '#form-step-guests', steps: [async (out) => {
			const field = $('#form-step-guests');
			const up = $('[command="--step-up"][aria-controls="form-step-guests"]');
			const down = $('[command="--step-down"][aria-controls="form-step-guests"]');
			let changed = 0;
			field.addEventListener('change', () => changed++);
			up.click();
			const once = [field.value, changed];
			input(field, '12');
			up.click();
			const top = [field.value, up.getAttribute('aria-disabled'), down.getAttribute('aria-disabled')];
			input(field, '1');
			const bottom = [down.getAttribute('aria-disabled'), up.getAttribute('aria-disabled')];
			if (say(once) !== say(['3', 1]) || say(top) !== say(['12', 'true', null]) || say(bottom) !== say(['true', null])) {
				out.push('a step up from 2 gives ' + say(once) + ' (value, changes), at the max ' + say(top) + ' (value, up and down aria-disabled), at the min ' + say(bottom) + ' (down, up)');
			}
		}]},
		color: {target: '#form-color-pick', steps: [async (out) => {
			const picker = $('#form-color-pick');
			const twin = $('#form-color-hex');
			input(twin, 'zz');
			const refused = [twin.getAttribute('aria-invalid'), picker.value];
			input(twin, '#123');
			const taken = [twin.hasAttribute('aria-invalid'), picker.value];
			picker.value = '#e76f51';
			picker.dispatchEvent(new Event('input', {bubbles: true}));
			if (say(refused) !== say(['true', '#2a9d8f']) || say(taken) !== say([false, '#112233']) || twin.value !== '#e76f51') {
				out.push('a hex twin: "zz" leaves ' + say(refused) + ', "#123" ' + say(taken) + ', the picker set ' + say(twin.value));
			}
			const [light, dark] = $$('#form-color .icon-tile');
			const read = await readable;
			const stored = [$('#form-color .dot').style.getPropertyValue('--redz-color'), ...(read ? [rgb(getComputedStyle(light).color), rgb(getComputedStyle(dark).color), rgb(getComputedStyle($('#form-color .edge-start-color')).borderInlineStartColor)] : [])];
			if (say(stored) !== say(['#2a9d8f', ...(read ? ['0,0,0', '255,255,255', '231,111,81'] : [])])) {
				out.push('stored colours read ' + say(stored) + ' (a dot\'s --redz-color, a light and a dark tile\'s icon, an edge)');
			}
		}]},
		submit: {target: '#form-submit form', steps: [async (out) => {
			const form = $('#form-submit form');
			const sort = $('select', form);
			sort.value = 'price';
			sort.dispatchEvent(new Event('change', {bubbles: true}));
			await wait(50);
			const sent = $('[data-docs-sent]', form).textContent;
			if (!sent.includes('sort=price')) {
				out.push('a form with data-submit="change" sends ' + say(sent) + ' when its select changes');
			}
		}]},
		show: {target: '#form-show-tax-region', steps: [async (out) => {
			const region = $('#form-show-tax-region');
			const pay = $('#form-show-pay');
			const tax = $('#form-show-tax');
			const state = () => [region.hidden, tax.disabled];
			const start = state();
			pay.value = 'invoice';
			pay.dispatchEvent(new Event('change', {bubbles: true}));
			const shown = state();
			pay.value = 'card';
			pay.dispatchEvent(new Event('change', {bubbles: true}));
			if (say([start, shown, state()]) !== say([[true, true], [false, false], [true, true]])) {
				out.push('a region shown by a select is [hidden, its field disabled] ' + say(start) + ' at rest, ' + say(shown) + ' for its value, ' + say(state()) + ' for another');
			}
		}]},
		free: {target: '#combobox-free-list', steps: [async (out) => {
			const search = $('#combobox-free-search');
			const held = () => $$('input[type="hidden"][name="to[]"]').map((field) => field.value);
			const comma = () => search.dispatchEvent(new KeyboardEvent('keydown', {key: ',', bubbles: true, cancelable: true}));
			input(search, 'guide@example.com');
			comma();
			const taken = [held(), search.value];
			input(search, 'guide@example.com');
			comma();
			const twice = held().length;
			input(search, 'not an address');
			comma();
			await wait(100);
			if (say(taken) !== say([['guide@example.com'], '']) || twice !== 1 || search.getAttribute('aria-invalid') !== 'true' || held().length !== 1 || $$('#combobox-free-chips .chip').length !== 1) {
				out.push('free values: a comma takes ' + say(taken) + ', the same again leaves ' + twice + ', words that are no address leave aria-invalid ' + say(search.getAttribute('aria-invalid')) + ' and ' + held().length + ' held, ' + $$('#combobox-free-chips .chip').length + ' chips');
			}
		}]},
		levels: {target: '#combobox-levels-list', steps: [async (out) => {
			const search = $('[aria-controls="combobox-levels-list"]');
			input(search, 'phuket');
			const shown = $$('#combobox-levels-list [role="option"]').filter((option) => !option.hidden).map((option) => option.dataset.value);
			const active = $('#combobox-levels-list [data-active]')?.dataset.value;
			input(search, '');
			if (say(shown) !== say(['th', 'th-south', 'phuket']) || active !== 'phuket') {
				out.push('a search in levels shows ' + say(shown) + ', active ' + say(active) + ' - not Phuket with its parents, Phuket active');
			}
		}]},
		rating: {target: '#rating-display .rating', steps: [async (out) => {
			const shown = $('#rating-display .rating').style.getPropertyValue('--v');
			const fills = $$('#rating-give label').map((label) => getComputedStyle(label, '::before').backgroundColor);
			if (shown !== '0.84' || new Set(fills.slice(0, 4)).size !== 1 || fills[4] === fills[0]) {
				out.push('a rating of 0.84 has --v ' + say(shown) + '; four stars given fill ' + say(fills));
			}
		}]},
		brand: {target: '#tokens-brand-region [data-brand]', steps: [async (out) => {
			const [green, yellow] = $$('#tokens-brand-region [data-brand]');
			const look = await readable ? [rgb(getComputedStyle($('.btn-primary', green)).backgroundColor), green.style.getPropertyValue('--redz-brand'), rgb(getComputedStyle($('.btn-primary', yellow)).color)] : ['10,127,90', green.style.getPropertyValue('--redz-brand'), '0,0,0'];
			if (say(look) !== say(['10,127,90', '#0a7f5a', '0,0,0'])) {
				out.push('a white label of #0a7f5a draws its button ' + say(look[0]) + ' with --redz-brand ' + say(look[1]) + ', one of #f4c542 its words ' + say(look[2]));
			}
		}]},
		segmented: {target: '#btn-segmented', steps: [async (out) => {
			const look = (id) => getComputedStyle($('label[for="' + id + '"]')).backgroundColor;
			const before = [look('btn-segmented-week'), look('btn-segmented-day')];
			$('label[for="btn-segmented-day"]').click();
			await wait(300);
			const after = [$('#btn-segmented-day').checked, look('btn-segmented-day'), look('btn-segmented-week')];
			if (before[0] === before[1] || !after[0] || after[1] !== before[0] || after[2] !== before[1]) {
				out.push('a segmented choice draws the checked ' + say(before) + ' (checked, not), then after a click on Day ' + say(after));
			}
		}]},
		marks: {target: '#save-bar-changed', steps: [async (out) => {
			const changed = getComputedStyle($('#save-bar-changed-name')).boxShadow;
			const dot = getComputedStyle($('#save-bar-changed .form-check'), '::after').content;
			const select = getComputedStyle($('#form-adorn-country')).paddingInlineStart;
			if (changed === 'none' || dot === 'none' || select !== '34px') {
				out.push('a changed field\'s mark is ' + say(changed) + ', a changed check\'s ' + say(dot) + ', a select with an icon starts at ' + select);
			}
		}]},
		copy: {target: '#commands-copy-field', steps: [async (out) => {
			const said = () => $$('[role="status"]').map((status) => status.textContent).join('|');
			const copied = [];
			let told = '';
			document.addEventListener('redz:copy', (event) => {
				told = event.detail.text;
			}, {once: true});
			Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: async (words) => {
				copied.push(words);
			}}});
			const button = $('#commands-copy-field [aria-controls]');
			button.click();
			await wait(200);
			const icon = $('.bi', button).className;
			if (copied[0] !== $('#commands-copy-key').value || told !== copied[0] || !said().includes('Copied') || !icon.includes('bi-check-lg')) {
				out.push('copying a field gives ' + say(copied) + ', redz:copy ' + say(told) + ', the statuses ' + say(said()) + ', the icon ' + say(icon));
			}
			$('#commands-copy-field [data-copy]').click();
			await wait(50);
			delete navigator.clipboard;
			Object.defineProperty(navigator, 'clipboard', {configurable: true, value: undefined});
			const command = document.execCommand;
			const commanded = [];
			document.execCommand = (name) => commanded.push(name + ':' + document.activeElement?.value) > 0;
			button.click();
			await wait(200);
			document.execCommand = command;
			delete navigator.clipboard;
			if (copied[1] !== $('#commands-copy-field [data-copy]').dataset.copy || commanded[0] !== 'copy:' + $('#commands-copy-key').value || document.activeElement !== button) {
				out.push('data-copy gives ' + say(copied[1]) + ', and without the Clipboard API the copy command got ' + say(commanded) + ', the focus ' + (document.activeElement === button ? 'back on' : 'not on') + ' the button');
			}
			await wait(1500);
			if ($('.bi', button).className !== 'bi bi-copy') {
				out.push('the check does not give the icon back: ' + say($('.bi', button).className));
			}
		}]},
		download: {target: '#qr-download-room', steps: [async (out) => {
			if (!(await readable)) {
				return;
			}
			const click = HTMLAnchorElement.prototype.click;
			let got = null;
			HTMLAnchorElement.prototype.click = function () {
				got = {name: this.download, href: this.href};
			};
			$('#qr-download-room [command="--download"]').click();
			for (let waited = 0; got === null && waited < 30; waited++) {
				await wait(100);
			}
			HTMLAnchorElement.prototype.click = click;
			if (got === null || got.name !== 'room-12.png' || !got.href.startsWith('blob:')) {
				out.push('the download gives ' + say(got));
				return;
			}
			const picture = await createImageBitmap(await (await fetch(got.href)).blob());
			const canvas = Object.assign(document.createElement('canvas'), {width: picture.width, height: picture.height});
			canvas.getContext('2d').drawImage(picture, 0, 0);
			const corner = [...canvas.getContext('2d').getImageData(1, 1, 1, 1).data].join(',');
			if (picture.width !== 512 || picture.height !== 512 || corner !== '255,255,255,255') {
				out.push('the PNG is ' + picture.width + ' × ' + picture.height + ', its corner ' + corner + ', not 512 × 512 on white');
			}
		}]},
		print: {target: '#commands-print-page', steps: [async (out) => {
			const closed = $$('details:not([open])');
			const named = closed.filter((details) => details.hasAttribute('name')).map((details) => details.getAttribute('name'));
			const regions = $$('button[command="--toggle"][aria-expanded="false"][aria-controls]').map((button) => document.getElementById(button.getAttribute('aria-controls'))).filter((region) => region?.hidden);
			dispatchEvent(new Event('beforeprint'));
			const opened = [closed.filter((details) => details.open).length, regions.filter((region) => !region.hidden).length];
			dispatchEvent(new Event('afterprint'));
			const back = [closed.filter((details) => !details.open).length, regions.filter((region) => region.hidden).length, closed.filter((details) => details.hasAttribute('name')).map((details) => details.getAttribute('name')).join(' ')];
			if (closed.length === 0 || regions.length === 0 || say(opened) !== say([closed.length, regions.length]) || say(back) !== say([closed.length, regions.length, named.join(' ')])) {
				out.push('printing opens ' + opened[0] + ' of ' + closed.length + ' closed details and ' + opened[1] + ' of ' + regions.length + ' closed regions, and after it ' + back[0] + ' and ' + back[1] + ' are closed again, the groups named ' + say(back[2]));
			}
		}]},
		theme: {target: '#commands-theme-choice', steps: [async (out) => {
			const root = document.documentElement;
			const before = root.dataset.theme;
			const buttons = $$('#commands-theme-choice [command="--theme"]');
			const pressed = () => buttons.map((button) => button.value + ':' + button.getAttribute('aria-pressed')).join(' ');
			let told = '';
			document.addEventListener('redz:theme', (event) => {
				told = event.detail.theme;
			});
			buttons.find((button) => button.value === 'dark').click();
			await wait(50);
			const dark = [root.dataset.theme, told, pressed()];
			buttons.find((button) => button.value === 'system').click();
			await wait(50);
			const system = [root.hasAttribute('data-theme'), told, pressed()];
			const flipped = matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark';
			buttons.find((button) => button.value === 'toggle').click();
			await wait(50);
			const toggled = [root.dataset.theme, told];
			if (before === undefined) {
				delete root.dataset.theme;
			} else {
				root.dataset.theme = before;
			}
			if (say(dark) !== say(['dark', 'dark', 'light:false dark:true system:false toggle:true']) || system[0] || system[1] !== 'system' || !system[2].includes('system:true') || say(toggled) !== say([flipped, flipped])) {
				out.push('the theme buttons give ' + say(dark) + ', then for system ' + say(system) + ', then the toggle ' + say(toggled));
			}
		}]},
		share: {target: '#commands-share-tour', steps: [async (out) => {
			const button = $('#commands-share-tour [command="--share"]');
			const menu = $('#commands-share-menu');
			let shared = null;
			Object.defineProperty(navigator, 'share', {configurable: true, value: async (data) => {
				shared = data;
			}});
			Object.defineProperty(navigator, 'canShare', {configurable: true, value: () => true});
			button.click();
			await wait(100);
			const bySheet = [shared?.url, shared?.title, menu.matches(':popover-open')];
			Object.defineProperty(navigator, 'share', {configurable: true, value: async () => {
				throw new DOMException('refused', 'NotAllowedError');
			}});
			button.click();
			await wait(200);
			const byMenu = [menu.matches(':popover-open'), button.getAttribute('aria-expanded'), $('a.share-telegram', menu).href, $('[command="--copy"]', menu).dataset.copy];
			menu.hidePopover();
			delete navigator.share;
			delete navigator.canShare;
			const url = button.dataset.shareUrl;
			if (say(bySheet) !== say([url, button.dataset.shareTitle, false]) || !byMenu[0] || byMenu[1] !== 'true' || !byMenu[2].startsWith('https://t.me/share/url?url=' + encodeURIComponent(url)) || byMenu[3] !== url) {
				out.push('by the sheet it shares ' + say(bySheet) + '; the sheet failing, the menu ' + say(byMenu));
			}
		}]},
		time: {target: '#time-ticking', steps: [async (out) => {
			const [elapsed, ago, ahead] = $$('#time-ticking time');
			const at = [elapsed.textContent, ago.textContent, ahead.textContent, ago.title !== ''];
			elapsed.dateTime = new Date(Date.now() - 3725000).toISOString();
			await wait(50);
			const hour = elapsed.textContent;
			await wait(1100);
			const [minutes, seconds] = at[0].split(':').map(Number);
			if (!/^\d+:\d\d$/.test(at[0]) || minutes * 60 + seconds < 95 || minutes * 60 + seconds > 240 || at[1] !== '5 minutes ago' || at[2] !== 'in 2 hours' || !at[3] || !/^1:02:0[5-7]$/.test(hour) || elapsed.textContent === hour) {
				out.push('the times read ' + say(at) + ', an elapsed time of an hour and more ' + say(hour) + ' then ' + say(elapsed.textContent));
			}
		}]},
		viewer: {target: '#viewer-set', steps: [async (out) => {
			const links = $$('#viewer-set a[data-zoom]');
			links[0].click();
			await wait(100);
			const viewer = $('dialog.viewer');
			const shown = () => [$('.viewer-image', viewer).getAttribute('src').split('/').pop(), $('.viewer-caption', viewer).textContent];
			const first = [viewer?.open, ...shown()];
			const key = (name) => viewer.dispatchEvent(new KeyboardEvent('keydown', {key: name, bubbles: true, cancelable: true}));
			key('ArrowRight');
			const second = shown();
			key('ArrowLeft');
			key('ArrowLeft');
			const wrapped = shown();
			document.documentElement.dir = 'rtl';
			key('ArrowLeft');
			const mirrored = shown();
			document.documentElement.dir = 'ltr';
			$('.viewer-close', viewer).click();
			await wait(50);
			if (say(first) !== say([true, 'lagoon.svg', 'The lagoon at Ang Thong · 1 of 3']) || second[0] !== 'pier.svg' || say(wrapped) !== say(['cliffs.svg', 'Cliffs above a bay with a boat · 3 of 3']) || mirrored[0] !== 'lagoon.svg' || viewer.open || document.activeElement !== links[0]) {
				out.push('a set of three opens ' + say(first) + ', steps to ' + say(second) + ', wraps back to ' + say(wrapped) + ', right to left on to ' + say(mirrored) + ', and closed leaves the focus ' + (document.activeElement === links[0] ? 'on its link' : 'elsewhere'));
			}
			let followed = null;
			const watch = (event) => {
				followed = !event.defaultPrevented;
				event.preventDefault();
			};
			addEventListener('click', watch, {once: true});
			links[1].dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, ctrlKey: true}));
			if (followed !== true || viewer.open) {
				out.push('a click with Control does not open the image as a link does');
			}
			const room = $('#viewer-dialog-room');
			room.showModal();
			$('a[data-zoom]', room).click();
			await wait(100);
			const above = [viewer.open, room.open];
			$('.viewer-close', viewer).click();
			await wait(50);
			const after = [viewer.open, room.open, room.contains(document.activeElement)];
			room.close();
			if (say(above) !== say([true, true]) || say(after) !== say([false, true, true])) {
				out.push('opened from a dialog the viewer and the dialog are ' + say(above) + ' open, then ' + say(after) + ' with the focus in the dialog');
			}
		}]},
		prompt: {target: '#dialog-prompt-name', steps: [async (out) => {
			const asked = REDZ.ui.prompt({title: 'Rename the folder', label: 'Name', value: 'Tours 2026', required: true, ok: 'Rename'});
			await wait(400);
			const dialog = $('dialog[open]');
			const field = $('input', dialog);
			const start = [document.activeElement === field, field.selectionStart, field.selectionEnd, $('label', dialog).textContent];
			input(field, '');
			$('.dialog-footer > .btn:last-child', dialog).click();
			await wait(50);
			const empty = dialog.open;
			input(field, 'Tours 2027');
			field.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true}));
			const answer = await Promise.race([asked, wait(500).then(() => 'unanswered')]);
			const plain = REDZ.ui.prompt({title: 'Plain?'});
			await wait(100);
			$('dialog[open] .dialog-footer > .btn:first-child').click();
			if (say(start) !== say([true, 0, 10, 'Name']) || !empty || answer !== 'Tours 2027' || await plain !== null || $('dialog[open]') !== null) {
				out.push('a prompt starts ' + say(start) + ', ' + (empty ? 'stays' : 'closes') + ' empty though required, answers ' + say(answer) + ', and Cancel does not answer null');
			}
		}]},
		hash: {target: '#nav-hash', steps: [async (out) => {
			const tabs = $$('#nav-hash [role="tab"]');
			const list = tabs[0].closest('[role="tablist"]');
			const selected = () => tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true');
			const told = [];
			const hear = (event) => told.push(tabs.indexOf(event.detail.tab));
			list.addEventListener('redz:selected', hear);
			tabs[1].click();
			const written = location.hash;
			location.hash = '#nav-hash-history';
			await wait(100);
			const followed = selected();
			const refuse = (event) => {
				event.preventDefault();
				event.detail.respondWith(Promise.resolve(false));
			};
			list.addEventListener('redz:select', refuse, {once: true});
			const refused = await REDZ.ui.select(tabs[0]);
			const kept = selected();
			const taken = await REDZ.ui.select(tabs[0]);
			list.removeEventListener('redz:selected', hear);
			history.replaceState(history.state, '', location.pathname + location.search);
			if (written !== '#nav-hash-payment' || followed !== 2 || refused !== false || kept !== 2 || taken !== true || selected() !== 0 || say(told) !== say([1, 2, 0])) {
				out.push('a choice writes ' + say(written) + ', the address selects tab ' + followed + ', a refused select answers ' + refused + ' leaving tab ' + kept + ', a taken one ' + taken + ', and redz:selected told ' + say(told));
			}
		}]},
		checks: {target: '#menu-checks', steps: [async (out) => {
			const menu = $('#menu-checks-list');
			const item = (words) => $$('.menu-item', menu).find((one) => one.textContent === words);
			const checked = () => $$('.menu-item', menu).map((one) => one.getAttribute('aria-checked')).join(' ');
			const told = [];
			menu.addEventListener('redz:check', (event) => told.push(event.detail.item.textContent + ':' + event.detail.checked));
			$('#menu-checks > button').click();
			await wait(100);
			item('Pickup').click();
			item('Guest').click();
			item('Name').click();
			const open = menu.matches(':popover-open');
			menu.hidePopover();
			const choice = $('#menu-choice-list');
			$('#menu-choice > button').click();
			await wait(100);
			$$('.menu-item', choice)[1].click();
			const one = [$$('.menu-item', choice).map((other) => other.getAttribute('aria-checked')).join(' '), choice.matches(':popover-open')];
			$$('.menu-item', choice)[0].setAttribute('aria-checked', 'true');
			$$('.menu-item', choice)[1].setAttribute('aria-checked', 'false');
			if (checked() !== 'false true true false true' || !open || say(told) !== say(['Pickup:true', 'Guest:false', 'Name:true']) || say(one) !== say(['false true false', false])) {
				out.push('check items read ' + say(checked()) + ' with the menu ' + (open ? 'open' : 'closed') + ', told ' + say(told) + '; a choice of one ' + say(one));
			}
		}]},
		progress: {target: '#progress-window-run', steps: [async (out) => {
			const bar = () => $('.progress-top');
			const open = () => bar()?.matches(':popover-open') ?? false;
			REDZ.ui.progress(wait(50));
			await wait(250);
			const quick = open();
			REDZ.ui.progress(wait(600));
			REDZ.ui.progress(wait(300));
			await wait(300);
			const running = [open(), $$('.progress-top').length, bar()?.getAttribute('aria-hidden')];
			await wait(600);
			if (quick || say(running) !== say([true, 1, 'true']) || open()) {
				out.push('the window\'s bar: a quick request shows it (' + quick + '), two at once show ' + say(running) + ', and after them it is ' + (open() ? 'still open' : 'gone'));
			}
		}]},
		status: {target: '#status-save-line', steps: [async (out) => {
			const line = $('#status-save-line');
			const region = $(':scope > [role="status"]', line);
			if (region === null) {
				out.push('a status line holds no polite status from the load');
			}
			const words = () => line.textContent.trim();
			const kept = REDZ.ui.status(line, wait(700));
			await wait(150);
			const early = words();
			await wait(400);
			const pending = [line.dataset.tone, words(), $('.spinner-border', line) !== null];
			await kept;
			await wait(50);
			const saved = [line.dataset.tone, words(), $('.bi', line)?.classList.contains('bi-check-circle') ?? false];
			if (early !== '' || pending[0] !== 'pending' || pending[1] === '' || !pending[2] || saved[0] !== 'success' || saved[1] === '' || !saved[2]) {
				out.push('a save: ' + say(early) + ' at 150 ms, ' + say(pending) + ' at 550 ms, ' + say(saved) + ' when kept');
			}
			REDZ.ui.status(line, Promise.reject(new Error('The name is taken.'))).catch(() => {});
			await wait(50);
			if (line.dataset.tone !== 'danger' || words() !== 'The name is taken.') {
				out.push('a refused save shows ' + say([line.dataset.tone, words()]));
			}
			REDZ.ui.status(line, {tone: 'warning', text: 'Rebuilding'});
			await wait(20);
			if (line.dataset.tone !== 'warning' || words() !== 'Rebuilding' || $(':scope > [role="status"]', line) !== region) {
				out.push('words of the page show ' + say([line.dataset.tone, words()]) + ', or in another status');
			}
		}]},
		repeat: {target: '#repeat-phones-list', steps: [async (out) => {
			const list = $('#repeat-phones-list');
			const add = $('[command="--add"][aria-controls="repeat-phones-list"]');
			const rows = () => $$(':scope > li', list);
			const off = (button) => button.getAttribute('aria-disabled') === 'true';
			if (rows().length !== 1 || !off($('[command="--remove"]', list)) || off(add)) {
				out.push('at rest with data-min 1: ' + rows().length + ' rows, the only Remove ' + (off($('[command="--remove"]', list)) ? 'off' : 'on') + ', Add ' + (off(add) ? 'off' : 'on'));
			}
			add.click();
			const made = rows()[1];
			const field = made && $('input', made);
			if (!field || field.id !== 'repeat-phones-1' || field.name !== 'phones[1]' || $('label', made).htmlFor !== 'repeat-phones-1' || document.activeElement !== field || off($('[command="--remove"]', list))) {
				out.push('Add makes ' + say(field ? [field.id, field.name, $('label', made).htmlFor] : 'no row') + ', the focus ' + (document.activeElement === field ? 'in' : 'out of') + ' it');
			}
			add.click();
			add.click();
			if (rows().length !== 4 || !off(add)) {
				out.push('at data-max 4 there are ' + rows().length + ' rows, Add ' + (off(add) ? 'off' : 'on'));
			}
			const third = $('input', rows()[2]);
			$('[command="--remove"]', rows()[1]).click();
			if (rows().length !== 3 || document.activeElement !== third || off(add)) {
				out.push('Remove on the second row leaves ' + rows().length + ' rows, the focus ' + (document.activeElement === third ? 'on the next row' : 'elsewhere') + ', Add ' + (off(add) ? 'off' : 'on'));
			}
			list.addEventListener('redz:add', (event) => event.preventDefault(), {once: true});
			add.click();
			const cancelled = rows().length;
			add.click();
			const latest = $('input', rows().at(-1))?.id;
			if (cancelled !== 3 || latest !== 'repeat-phones-4') {
				out.push('a cancelled redz:add leaves ' + cancelled + ' rows, and the next row is ' + say(latest) + ', not a new index');
			}
		}]},
		filter: {target: '#list-group-search-list', steps: [async (out) => {
			const field = $('[data-filter="list-group-search-list"]');
			const list = $('#list-group-search-list');
			const shown = () => $$('.list-group-item:not([data-filter-empty])', list).filter((item) => getComputedStyle(item).display !== 'none').map((item) => item.textContent.trim());
			const empty = $('[data-filter-empty]', list);
			input(field, 'KÓH tao');
			const one = shown();
			input(field, 'chang');
			const search = shown();
			input(field, 'zzz');
			const none = [shown().length, empty.hidden];
			await wait(700);
			const told = $$('[role="status"]').some((status) => /\d/.test(status.textContent));
			field.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true}));
			if (say(one) !== say(['Koh Tao and Koh Nang Yuan']) || say(search) !== say(['Elephant sanctuary']) || none[0] !== 0 || none[1] !== false || !told || field.value !== '' || shown().length !== 4 || !empty.hidden) {
				out.push('a search shows ' + say(one) + ' for "KÓH tao", ' + say(search) + ' for a data-search word, ' + say(none) + ' for none (shown, the empty state hidden), the count ' + (told ? '' : 'not ') + 'said, then Escape leaves ' + say(field.value) + ' and ' + shown().length + ' items');
			}
			const tree = $('[data-filter="tree-current-list"]');
			input(tree, 'night');
			const pages = $$('#tree-current-list .tree-item').map((item) => (item.hasAttribute('data-filtered') ? '-' : '+') + $(':scope > .tree-row > a', item).textContent);
			input(tree, '');
			if (say(pages) !== say(['+Excursions', '-Ang Thong by speedboat', '+Night market and street food'])) {
				out.push('a tree searched for "night" keeps ' + say(pages) + ', not the parent of the match');
			}
		}]},
		tap: {target: '#tooltip-title [aria-disabled="true"][title]', steps: [async (out) => {
			const button = $('#tooltip-title [aria-disabled="true"][title]');
			const title = button.getAttribute('title');
			button.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, pointerType: 'touch'}));
			button.dispatchEvent(new PointerEvent('pointerup', {bubbles: true, pointerType: 'touch'}));
			button.dispatchEvent(new PointerEvent('pointerout', {bubbles: true, pointerType: 'touch'}));
			await wait(200);
			const tip = $('#redz-tooltip');
			const open = tip?.matches(':popover-open') && tip.textContent === title;
			const said = $$('[role="status"]').some((status) => status.textContent === title);
			await wait(3000);
			if (!open || !said || tip.matches(':popover-open')) {
				out.push('a tap on a disabled control ' + (open ? 'shows' : 'does not show') + ' its title, ' + (said ? 'says' : 'does not say') + ' it, and ' + (tip?.matches(':popover-open') ? 'keeps it past' : 'hides it after') + ' three seconds');
			}
		}]},
		hold: {target: '#busy-button', steps: [async (out) => {
			const button = Object.assign(document.createElement('button'), {className: 'btn', type: 'button', textContent: 'Resend the code'});
			$('#busy-button').append(button);
			const off = () => button.getAttribute('aria-disabled');
			const waited = REDZ.ui.busy(button, wait(300));
			button.dataset.cooldown = '1';
			await waited;
			await wait(50);
			const busyEnded = off();
			await wait(1100);
			const countEnded = off();
			button.dataset.cooldown = '1';
			await wait(50);
			const second = REDZ.ui.busy(button, wait(1500));
			await wait(1200);
			const busyLeft = off();
			await second;
			await wait(50);
			button.remove();
			if (busyEnded !== 'true' || countEnded !== null || busyLeft !== 'true' || off() !== null) {
				out.push('busy() and a cooldown on one button leave aria-disabled ' + say([busyEnded, countEnded, busyLeft, off()]) + ' - the wait ended, the count ended, the count ended under a wait, both ended');
			}
		}]},
		rowLink: {target: '#table-links .stretched-link', steps: [async (out) => {
			const row = $('#table-links tbody tr');
			const link = $('.stretched-link', row);
			let followed = 0;
			const opened = [];
			const real = window.open;
			window.open = (url) => {
				opened.push(url);
				return null;
			};
			link.addEventListener('click', (event) => {
				event.preventDefault();
				followed++;
			});
			const cell = row.cells[1];
			cell.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, button: 0}));
			$('.table-actions button', row).dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, button: 0}));
			cell.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, button: 0, ctrlKey: true}));
			cell.dispatchEvent(new MouseEvent('auxclick', {bubbles: true, cancelable: true, button: 1}));
			window.open = real;
			if (followed !== 1 || opened.length !== 2 || opened.some((url) => url !== link.href)) {
				out.push('a click on the row follows its title ' + followed + ' times (a click on its action button among them, or not), and Ctrl and the middle button open ' + say(opened));
			}
		}]},
		confirmRows: {target: '#summary-confirm', steps: [async (out) => {
			const asked = REDZ.ui.confirm({title: 'Pay?', rows: [{label: 'To pay', value: 5850}, {label: 'Note', value: '<b>now</b>'}]});
			await wait(150);
			const dialog = $('dialog[open]');
			const pairs = $$('.dialog-body > dl.summary > *', dialog).map((part) => part.localName + ':' + part.textContent).join(' ');
			$('button[value="cancel"]', dialog).click();
			await asked;
			if (pairs !== 'dt:To pay dd:5850 dt:Note dd:<b>now</b>') {
				out.push('a confirmation with rows shows ' + say(pairs));
			}
		}]},
		chevron: {target: '#collapse-chevron button', steps: [async (out) => {
			const button = $('#collapse-chevron button');
			const chevron = $('.toggle-chevron', button);
			const state = async () => {
				await Promise.all(chevron.getAnimations().map((animation) => animation.finished));
				const shown = (selector) => getComputedStyle($(selector, button)).display === 'none' ? 'hidden' : 'shown';
				return [button.getAttribute('aria-expanded'), getComputedStyle(chevron).rotate, shown('.toggle-open'), shown('.toggle-closed')].join(' ');
			};
			const closed = await state();
			button.click();
			const open = await state();
			button.click();
			if (closed !== 'false none hidden shown' || open !== 'true 180deg shown hidden') {
				out.push('a toggle\'s chevron and words read ' + say(closed) + ' closed and ' + say(open) + ' open');
			}
		}]},
		scroller: {target: '#table-wide .table-scroll', steps: [async (out) => {
			const box = $('#table-wide .table-scroll');
			const first = $('tbody th', box);
			const head = $('thead th:nth-child(2)', box);
			box.style.inlineSize = '20rem';
			box.scrollLeft = box.scrollWidth;
			await wait(50);
			const left = Math.round(first.getBoundingClientRect().left - box.getBoundingClientRect().left);
			box.scrollLeft = 0;
			const wide = box.scrollWidth > box.clientWidth;
			box.style.removeProperty('inline-size');
			const single = CSS.supports('named-feature(single-axis-scroll-container)');
			const top = getComputedStyle(head).insetBlockStart;
			if (!wide || left !== 0 || top !== (single ? '52px' : '0px') || getComputedStyle($('tbody td', box)).position !== 'relative') {
				out.push('a wide table scrolls ' + (wide ? '' : 'not ') + 'sideways, its first column ' + left + ' px from the start when scrolled, its head sticks at ' + top + (single ? ' on one axis' : ''));
			}
			const grouped = [...$$('#table-grouped tbody th')].map((th) => getComputedStyle(th).position);
			if (grouped.some((position) => position === 'sticky')) {
				out.push('a group band or a row header sticks: ' + say(grouped));
			}
		}]},
		follow: {target: '#log-follow-lines', steps: [async (out) => {
			const log = $('#log-follow-lines');
			const line = async (words) => {
				log.append('\n' + words);
				await wait(50);
			};
			const end = () => log.scrollHeight - log.scrollTop - log.clientHeight < 8;
			const loaded = log.scrollHeight > log.clientHeight && end();
			await line('a line while following');
			const followed = end();
			log.scrollTop = 0;
			await wait(50);
			await line('a line while reading above');
			const kept = log.scrollTop === 0;
			log.scrollTop = log.scrollHeight;
			await wait(50);
			await line('a line back at the end');
			if (!loaded || !followed || !kept || !end()) {
				out.push('a followed log ' + (loaded ? '' : 'does not open at its end, ') + (followed ? '' : 'loses its end to a new line, ') + (kept ? '' : 'jumps to the end while read above, ') + (end() ? '' : 'does not follow again from the end'));
			}
			const diff = $('#log-diff-example .diff');
			const signs = $$(':scope > :is(ins, del)', diff).map((line) => getComputedStyle(line, '::before').content).join(' ');
			const gaps = $$(':scope > *', diff).map((line) => Math.round(line.getBoundingClientRect().top));
			const lines = gaps.slice(1).map((top, i) => top - gaps[i]);
			if (signs !== '"-" "+"' || lines.some((step) => step > 24)) {
				out.push('a diff signs its lines ' + say(signs) + ' and steps them by ' + say(lines) + ' px');
			}
		}]},
		live: {target: '#dot-live-example', steps: [async (out) => {
			const [running, done] = $$('#dot-live-example .dot-live');
			const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
			if ((getComputedStyle(running).animationName === 'none') !== still || getComputedStyle(done).animationName !== 'none') {
				out.push('a live dot running is ' + (getComputedStyle(running).animationName === 'none' ? 'still' : 'moving') + ', done ' + (getComputedStyle(done).animationName === 'none' ? 'still' : 'moving') + (still ? ', with reduced motion' : ''));
			}
		}]},
		trend: {target: '#stat-parts-example .stat-delta', steps: [async (out) => {
			const [good, bad] = $$('#stat-parts-example .stat-delta');
			const tone = (name) => {
				const probe = document.createElement('span');
				probe.className = 'text-' + name;
				document.body.append(probe);
				const color = getComputedStyle(probe).color;
				probe.remove();
				return color;
			};
			if (getComputedStyle(good).color !== tone('success') || getComputedStyle(bad).color !== tone('danger')) {
				out.push('a rise that is good is drawn ' + getComputedStyle(good).color + ', a rise of what should fall ' + getComputedStyle(bad).color + ' - not the success and the danger tones');
			}
		}]},
		centered: {target: '#page-center-example .page-center', steps: [async (out) => {
			const page = $('#page-center-example .page-center');
			const middle = (el) => {
				const box = el.getBoundingClientRect();
				return box.left + box.width / 2;
			};
			const off = $$(':scope > :not(.page-center-corner)', page).filter((child) => !near(middle(child), middle(page), 2));
			if (off.length > 0) {
				out.push(off.length + ' children of a centered page stand off its middle: ' + say(off.map((child) => child.className)));
			}
		}]},
		chooser: {target: '#media-pick .media-grid-compact', steps: [async (out) => {
			const [first, second] = $$('#media-pick .media-grid-compact > .media-tile');
			$('img', second).click();
			await wait(50);
			const outlined = (tile) => getComputedStyle(tile).boxShadow !== 'none';
			if (!$('input', second).checked || $('input', first).checked || !outlined(second) || outlined(first)) {
				out.push('a click on a tile\'s image picks ' + ($('input', second).checked ? 'it' : 'nothing') + ', leaves the first ' + ($('input', first).checked ? 'picked' : 'free') + ', and outlines ' + [first, second].filter(outlined).length + ' of them');
			}
			$('img', first).click();
		}]},
		shares: {target: '#chart-rows table.chart-rows', steps: [async (out) => {
			const rows = $('#chart-rows table.chart-rows');
			const roles = [rows, $('caption', rows), rows.tBodies[0], $('thead th', rows), $('tbody th', rows), $('tbody td', rows)].map((el) => el.getAttribute('role')).join(' ');
			const row = $('tbody > tr', rows);
			if (roles !== 'table caption rowgroup columnheader rowheader cell' || row.style.getPropertyValue('--v') !== row.dataset.v) {
				out.push('breakdown rows carry the roles ' + say(roles) + ' and a row of ' + row.dataset.v + ' the share ' + say(row.style.getPropertyValue('--v')));
			}
			const bar = $('#chart-bar table.chart-bar');
			const track = $('tbody > tr', bar).getBoundingClientRect().width;
			const cell = $('tbody td', bar);
			if (!near(cell.getBoundingClientRect().width, Number(cell.dataset.v) * track, 2)) {
				out.push('a share of ' + cell.dataset.v + ' in a bar ' + Math.round(track) + ' px long is ' + Math.round(cell.getBoundingClientRect().width) + ' px');
			}
		}]},
		stored: {target: '#upload-stored .upload', steps: [async (out) => {
			const up = $('#upload-stored .upload');
			const counts = [];
			up.addEventListener('redz:change', (event) => counts.push(event.detail.count));
			const row = (id) => $('[data-file-stored="' + id + '"]', up);
			$('[data-file-remove]', row('42')).click();
			const busy = row('42')?.getAttribute('aria-busy');
			await wait(800);
			$('[data-file-remove]', row('41')).click();
			await wait(800);
			const kept = $$(':scope > .upload-list > *', up).map((item) => item.dataset.fileStored).join(' ');
			const said = $('[data-file-error]', row('41') ?? up)?.textContent ?? '';
			if (busy !== 'true' || row('42') !== null || kept !== '41' || said === '' || say(counts) !== say([1])) {
				out.push('stored files: Remove left the row busy ' + busy + ', the rows ' + say(kept) + ' (41 kept), the refusal ' + say(said) + ', redz:change ' + say(counts));
			}
			const before = counts.length;
			choose($('input[type="file"]', up), files(['notes.pdf'], 'application/pdf'));
			await wait(50);
			if (counts.length !== before + 1 || counts.at(-1) !== 2) {
				out.push('a file chosen beside a stored one: redz:change ' + say(counts.slice(before)) + ', not [2]');
			}
			const image = $('#upload-image .upload-list > *');
			const box = $('img', image).getBoundingClientRect();
			if (getComputedStyle(image).backgroundColor !== 'rgb(255, 255, 255)' || box.height < 100 || getComputedStyle($('#upload-image .upload-zone')).borderStyle.includes('dashed')) {
				out.push('an image field draws its image ' + Math.round(box.height) + ' px tall on ' + getComputedStyle(image).backgroundColor + ', its button zone ' + getComputedStyle($('#upload-image .upload-zone')).borderStyle);
			}
		}]},
		flush: {target: '#card-scrolling .list-group-flush', steps: [async (out) => {
			const current = $('#card-scrolling [aria-current="true"]');
			const plain = $('#list-group-flush .list-group-item');
			const start = (el) => parseFloat(getComputedStyle(el).paddingInlineStart);
			if (start(current) < 8 || start(plain) !== 0) {
				out.push('a flush list\'s current action row starts its words ' + start(current) + ' px in, a plain flush row ' + start(plain) + ' px');
			}
		}]},
		floating: {target: '#input-group-floating .input-group', steps: [async (out) => {
			for (const group of $$('#input-group-floating .input-group')) {
				const floating = $(':scope > .form-floating', group);
				const room = group.getBoundingClientRect().width - $$(':scope > :not(.form-floating, [popover])', group).reduce((sum, el) => sum + el.getBoundingClientRect().width, 0);
				if (floating && !near(floating.getBoundingClientRect().width, room, 3)) {
					out.push('a floating label in an input group takes ' + Math.round(floating.getBoundingClientRect().width) + ' of ' + Math.round(room) + ' px left for it');
				}
			}
		}]},
		rows: {target: '#list-group-moves-rows', steps: [
			() => {
				const list = $('#list-group-moves-rows');
				list.scrollIntoView({block: 'center'});
				const order = values('#list-group-moves-rows tbody > tr');
				return {drag: [...center($('tbody > tr:first-child .drag-handle', list)), ...center($('tbody > tr:last-child', list), 0.5, 0.65)], order};
			},
			(out, last) => {
				const list = $('#list-group-moves-rows');
				const [first, ...rest] = last.order.split(' ');
				const order = values('#list-group-moves-rows tbody > tr');
				const fields = $$(':scope > input[type="hidden"]', list).map((field) => field.value).join(' ');
				const status = $(':scope > .reorder-status', list);
				if (order !== [...rest, first].join(' ') || fields !== order || !status || status.textContent === '' || $$('table input, table .reorder-status', list).length > 0) {
					out.push('a row dragged to the end: ' + say(order) + ', the fields ' + say(fields) + ', the status ' + (status ? say(status.textContent) : 'missing') + ($$('table input, table .reorder-status', list).length > 0 ? ', some of them inside the table' : ''));
				}
			},
		]},
		grid: {target: '#list-group-moves-grid', steps: [
			() => {
				const list = $('#list-group-moves-grid');
				list.scrollIntoView({block: 'center'});
				const [a, b] = $$('[data-value]', list);
				return {drag: [...center($('.drag-handle', a)), ...center(b, 0.8, 0.5)], order: values('#list-group-moves-grid [data-value]')};
			},
			(out, last) => {
				const [a, b, ...rest] = last.order.split(' ');
				const order = values('#list-group-moves-grid [data-value]');
				if (order !== [b, a, ...rest].join(' ')) {
					out.push('a card dragged onto the end half of the next one: ' + say(order) + ', not ' + say([b, a, ...rest].join(' ')));
				}
				document.documentElement.dir = 'rtl';
				const items = $$('#list-group-moves-grid [data-value]');
				return {drag: [...center($('.drag-handle', items.at(-1))), ...center(items[0], 0.8, 0.5)], order};
			},
			(out, last) => {
				const items = last.order.split(' ');
				const order = values('#list-group-moves-grid [data-value]');
				document.documentElement.dir = 'ltr';
				const expected = [items.at(-1), ...items.slice(0, -1)].join(' ');
				if (order !== expected) {
					out.push('right to left, the last card dragged onto the start half of the first one: ' + say(order) + ', not ' + say(expected));
				}
			},
		]},
		opener: {target: '#list-group-moves-list', steps: [async (out) => {
			const menu = $('#list-group-moves-menu');
			const handles = $$('button[commandfor="list-group-moves-menu"]');
			const said = () => handles.map((handle) => handle.getAttribute('aria-expanded') ?? '-').join(' ');
			handles[1].click();
			await wait(100);
			const open = menu.matches(':popover-open');
			const expanded = said();
			handles[1].click();
			await wait(100);
			const closed = said();
			if (!open || expanded !== handles.map((handle, i) => String(i === 1)).join(' ') || closed !== handles.map(() => 'false').join(' ')) {
				out.push('the second of ' + handles.length + ' handles sharing one menu of moves ' + (open ? 'opens it' : 'does not open it') + ': aria-expanded ' + say(expanded) + ' while it is open, ' + say(closed) + ' after - only the handle that opened it is expanded');
			}
		}]},
	};

	const runs = {};
	return {
		targets() {
			return Object.keys(checks).filter((name) => $(checks[name].target) !== null);
		},
		missing() {
			return Object.keys(checks).filter((name) => $(checks[name].target) === null);
		},
		async step(name) {
			const run = runs[name] ??= {at: 0, out: [], last: null};
			try {
				while (run.at < checks[name].steps.length) {
					const answer = await checks[name].steps[run.at++](run.out, run.last);
					if (answer?.drag) {
						run.last = answer;
						return {drag: answer.drag};
					}
				}
			} catch (error) {
				run.out.push('threw ' + (error instanceof Error ? error.name + ': ' + error.message : String(error)));
			}
			return {findings: run.out};
		},
	};
})();

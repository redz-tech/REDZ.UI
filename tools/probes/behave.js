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

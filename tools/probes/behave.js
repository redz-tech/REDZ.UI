// The behaviour checks of the probes: the widgets of the docs' examples, as docs/all.html holds them, driven by the
// events a user's input makes against what each must do. Each check is a list of steps; a step answers a drag for the
// engine's own pointer ({drag: [x, y, x, y]}) or nothing, and pushes its findings. A check may instead be a walk, a
// generator that yields real input for the engine: {click}, {hover}, {key}, {type} or {drag}. tools/probe.php runs the checks
// whose targets the page has, once, at 1440, light LTR, on the page fresh from its load: REDZ_BEHAVE.targets(), then
// REDZ_BEHAVE.step(name) until it answers {findings}.
window.REDZ_BEHAVE = (() => {
	const wait = (ms) => new Promise((done) => setTimeout(done, ms));
	const $ = (selector, root = document) => root.querySelector(selector);
	const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
	const say = JSON.stringify;
	const near = (a, b, by = 2) => Math.abs(a - b) <= by;
	// Two frames, or a moment where a page gets none: what real input does is done by then.
	const settled = () => Promise.race([new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))), wait(120)]);
	const until = async (done, ms = 3000) => {
		for (const end = performance.now() + ms; !done() && performance.now() < end;) {
			await settled();
		}
	};
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

	const editorText = [
		'<h2>A day on Ang Thong</h2>',
		'<p>The boat leaves the pier at <strong>8:00</strong>; bring a hat and water.</p>',
		'<div class="alert alert-info" data-block="alert1"><i class="bi bi-info-circle" aria-hidden="true"></i><div>The park fee is paid at the pier.</div></div>',
		'<ul data-block="list1"><li>Kayaks in the lagoon</li><li>The viewpoint</li></ul>',
		'<table class="table" data-block="table1"><thead><tr><th scope="col">Boat</th><th scope="col">Seats</th><th scope="col">Leaves</th></tr></thead><tbody><tr><td>Sea Breeze</td><td>12</td><td>8:00</td></tr><tr><td>Blue Lagoon</td><td>30</td><td>9:30</td></tr></tbody></table>',
		'<div class="accordion" data-block="acc1"><details class="accordion-item" name="d"><summary class="accordion-header">What is included?<i class="bi bi-chevron-down accordion-icon" aria-hidden="true"></i></summary><div class="accordion-body">Lunch, the gear and the transfer.</div></details><details class="accordion-item" name="d"><summary class="accordion-header">What if it rains?<i class="bi bi-chevron-down accordion-icon" aria-hidden="true"></i></summary><div class="accordion-body">The trip moves.</div></details></div>',
		'<div class="grid md:cols-2 gap-16" data-block="grid1"><div class="card"><div class="card-body vstack gap-8"><h3>The lagoon</h3><p>A short climb.</p></div></div><div class="card"><div class="card-body vstack gap-8"><h3>The viewpoint</h3><p>Forty-two islands.</p></div></div></div>',
		'<div class="alert alert-warning" data-block="safety" data-lock="form"><i class="bi bi-exclamation-triangle" aria-hidden="true"></i><div>The sea closes the park.</div></div>',
		'<div class="alert alert-danger" data-block="shut" data-lock="all"><i class="bi bi-x-octagon" aria-hidden="true"></i><div>Never swim alone.</div></div>',
		'<p>The end.</p>',
	].join('');

	// The editor's walk, by real input: what a person does to every kind of block, under every level of rights. It stands on a
	// stage above the docs, because it makes and drops editors of its own.
	const editorWalk = async function* (out) {
		const say = (name, ok, more = '') => {
			if (!ok) {
				out.push(name + (more === '' ? '' : ' :: ' + String(more).slice(0, 240)));
			}
		};
		const stage = document.createElement('div');
		stage.style.cssText = 'position: fixed; inset: 0; z-index: 1000; overflow: auto; padding: 64px 0 0 40px; background: var(--redz-bg)';
		document.body.append(stage);
		const ALL = {html: true, ai: true, design: true, structure: true, facts: true, lock: true, review: true};
		let host = null;
		let page = null;
		let frame = null;
		let doc = null;
		let box = null;
		let changes = 0;
		const make = (options = {}) => new Promise((done) => {
			page?.destroy();
			host = document.createElement('div');
			host.style.cssText = 'width:' + (options.width ?? 960) + 'px;max-width:100%';
			stage.replaceChildren(host);
			changes = 0;
			page = REDZ.ui.editor(host, {ids: true, value: editorText, rights: ALL, placeholder: 'The page text', onChange: () => changes++, ...options, onReady: () => {
				frame = host.querySelector('iframe');
				doc = frame.contentDocument;
				box = host.querySelector('.editor');
				done();
			}});
		});
		const pt = (el, fx = 0.5, fy = 0.5) => {
			const from = el.ownerDocument === document ? {left: 0, top: 0} : frame.getBoundingClientRect();
			const seen = el.getBoundingClientRect();
			const clear = box.querySelector('.editor-toolbar').getBoundingClientRect().bottom + 48;
			if (el.ownerDocument !== document && (from.top + seen.top < clear || from.top + seen.bottom > innerHeight - 8)) {
				el.scrollIntoView({block: 'center'});
			}
			const r = el.getBoundingClientRect();
			const f = el.ownerDocument === document ? {left: 0, top: 0} : frame.getBoundingClientRect();
			return [Math.round(f.left + r.left + r.width * fx), Math.round(f.top + r.top + r.height * fy)];
		};
		const tool = (key) => box.querySelector('[data-editor="' + key + '"]');
		const blk = (id) => doc.querySelector('[data-block="' + id + '"]');
		const cardEl = () => box.querySelector('.editor-card:not(.editor-checks)');
		const open = () => cardEl().matches(':popover-open');
		const put = (node, at) => doc.getSelection().collapse(node, at);
		const key = (name, extra = {}) => (doc.activeElement ?? doc.body).dispatchEvent(new (doc.defaultView.KeyboardEvent)('keydown', {key: name, bubbles: true, cancelable: true, ...extra}));
		const paste = (html, text) => {
			const event = new (doc.defaultView.Event)('paste', {bubbles: true, cancelable: true});
			Object.defineProperty(event, 'clipboardData', {value: {getData: (type) => (type === 'text/html' ? html : text)}});
			(doc.activeElement ?? doc.body).dispatchEvent(event);
		};
		const value = () => page.getHTML();
		const marks = (html) => /data-editor|contenteditable/.test(html);
		const ACT = (root, name) => root.querySelector('[data-editor-act="' + name + '"]');

		await make();

		// The first picture.
		say('first tab stop is Format', box.querySelector('.editor-tool[tabindex="0"]')?.dataset.editor === 'format', box.querySelector('.editor-tool[tabindex="0"]')?.dataset.editor);
		say('undo and redo closed at first', tool('undo').disabled && tool('redo').disabled);
		say('value keeps ids', /data-block="alert1"/.test(value()) && /data-lock="form"/.test(value()), value().slice(0, 300));
		say('value has no marks', !marks(value()), value());
		const noIds = new DOMParser().parseFromString(value(), 'text/html').body.children.length;
		say('value has the blocks', noIds === 10, noIds);
		say('an accordion item drawn open keeps its shut state in the value', !/<details[^>]* open/.test(value()), value());
		say('a details name is back in the value', /name="d"/.test(value()));

		// Prose: typing, the pause, undo, redo.
		let para = doc.querySelector('p');
		yield {click: pt(para, 0.1)};
		say('a click puts the caret in prose', para.contains(doc.getSelection().anchorNode), String(doc.getSelection().anchorNode?.nodeName));
		put(para.lastChild, para.lastChild.length);
		yield {type: 'XY'};
		await until(() => changes === 1);
		say('typed into prose', para.textContent.endsWith('XY'), para.textContent);
		say('onChange heard', changes === 1, changes);
		say('undo open', !tool('undo').disabled);
		yield {click: pt(tool('undo'))};
		para = doc.querySelector('p');
		say('undo takes the words back', !para.textContent.includes('XY'), para.textContent);
		say('undo puts the caret back in place', doc.getSelection().anchorNode !== null && para.contains(doc.getSelection().anchorNode), String(doc.getSelection().anchorNode?.nodeName));
		say('redo open', !tool('redo').disabled);
		yield {click: pt(tool('redo'))};
		para = doc.querySelector('p');
		say('redo brings the words', para.textContent.endsWith('XY'), para.textContent);
		yield {click: pt(tool('undo'))};

		// A field: Enter and Backspace stay inside, the block holds.
		let alert = blk('alert1');
		let field = alert.querySelector('[data-editor-field]');
		const words = field.innerHTML;
		yield {click: pt(field, 0.3)};
		say('a click puts the caret in a field', field.contains(doc.getSelection().anchorNode) && doc.activeElement === field, doc.activeElement?.tagName + ' ' + String(doc.getSelection().anchorNode?.nodeName));
		const bar = box.querySelector('.editor-element');
		say('a click shows the element bar', !bar.hidden && bar.textContent.includes('Note'), bar.textContent);
		say('the chosen element is marked', blk('alert1').hasAttribute('data-editor-picked') || blk('alert1').querySelector('[data-editor-picked]') !== null);
		yield {key: 'Enter'};
		field = blk('alert1').querySelector('[data-editor-field]');
		say('Enter stays in the field', blk('alert1').querySelectorAll('[data-editor-field]').length === 1 && field.innerHTML === words && doc.activeElement === field, field.outerHTML);
		put(field.firstChild, 0);
		yield {key: 'Backspace'};
		field = blk('alert1').querySelector('[data-editor-field]');
		say('Backspace at the start stays in the field', field.textContent === words && doc.querySelector('p').textContent.startsWith('The boat'), field.outerHTML);
		put(field.firstChild, 3);
		yield {type: 'Q'};
		say('typing goes into the field', blk('alert1').textContent.includes('TheQ'), blk('alert1').textContent);
		yield {key: 'Backspace'};
		say('and comes out', blk('alert1').textContent.includes(words), blk('alert1').textContent);
		yield {key: ['ArrowDown']};
		const onward = doc.getSelection().anchorNode;
		say('ArrowDown leaves a field for the list', blk('list1').contains(onward), onward?.nodeName + ' in ' + onward?.parentElement?.tagName);

		// A summary: a space stays a space.
		let summary = blk('acc1').querySelector('summary');
		yield {click: pt(summary, 0.1)};
		say('a summary is a field', summary.matches('[data-editor-field]') && doc.activeElement === summary, summary.outerHTML.slice(0, 120));
		put(summary.firstChild, 4);
		yield {type: 'a b'};
		say('a space stays in a summary and it stays open', blk('acc1').querySelector('summary').textContent.includes('Whata b') && blk('acc1').querySelector('details').open, blk('acc1').querySelector('summary').textContent);
		for (let i = 0; i < 3; i++) {
			yield {key: 'Backspace'};
		}

		// A table by the keys.
		let table = blk('table1');
		let rows = table.rows.length;
		yield {click: pt(table.rows[rows - 1].cells[2], 0.1)};
		yield {key: 'Tab'};
		table = blk('table1');
		say('Tab on the last cell adds a row', table.rows.length === rows + 1, table.rows.length);
		say('the new row is fields', table.rows[rows].querySelectorAll('[data-editor-field]').length === 3, table.rows[rows].outerHTML);
		say('the caret is in the new row', table.rows[rows].contains(doc.getSelection().anchorNode), doc.getSelection().anchorNode?.nodeName + ' ' + doc.activeElement?.tagName);
		yield {type: 'Z'};
		say('typing lands in the new row', table.rows[rows].cells[0].textContent === 'Z', table.rows[rows].outerHTML);
		yield {key: 'Backspace'};
		yield {key: 'Backspace'};
		table = blk('table1');
		say('Backspace on an empty row takes it away', table.rows.length === rows, table.rows.length);
		say('the caret stays in the table', table.contains(doc.getSelection().anchorNode), doc.getSelection().anchorNode?.nodeName);
		yield {click: pt(table.rows[1].cells[0], 0.1)};
		yield {key: 'Enter'};
		say('Enter goes to the cell below', table.rows[2].cells[0].contains(doc.getSelection().anchorNode), doc.getSelection().anchorNode?.nodeName + ' ' + doc.getSelection().anchorNode?.textContent);
		yield {key: 'Tab'};
		say('Tab goes to the next cell', table.rows[2].cells[1].contains(doc.getSelection().anchorNode), doc.getSelection().anchorNode?.textContent);

		yield {click: pt(blk('table1').rows[1].cells[0], 0.1)};
		say('the path follows a click', bar.textContent.includes('Cell'), bar.textContent);
		yield {key: 'Tab'};
		say('the chosen part follows the keys', doc.querySelector('[data-editor-picked]') === blk('table1').rows[1].cells[1], doc.querySelector('[data-editor-picked]')?.outerHTML);
		say('what cannot run in a field is shut', tool('format').disabled && tool('bullets').disabled && tool('numbers').disabled && !tool('bold').disabled);
		// The bars of a table.
		let cell = blk('table1').rows[1].cells[1];
		yield {hover: pt(cell)};
		const parts = [...box.querySelectorAll('.editor-part')];
		const rowBar = parts.find((one) => ACT(one, 'row-add'));
		const columnBar = parts.find((one) => ACT(one, 'column-add'));
		say('hover shows the row bar', !rowBar.hidden);
		say('hover shows the column bar', !columnBar.hidden);
		const rb = rowBar.getBoundingClientRect();
		const tb = blk('table1').getBoundingClientRect();
		const fb = frame.getBoundingClientRect();
		say('the row bar stands at the table', rb.right <= tb.left + fb.left + 2 && rb.right > tb.left + fb.left - 60, JSON.stringify([rb.left, rb.right, tb.left + fb.left]));
		yield {hover: pt(cell)};
		yield {hover: [Math.round(fb.left) + 8, pt(cell)[1]]};
		say('the bars wait for the pointer on its way to them', !rowBar.hidden);
		yield {hover: pt(cell)};
		yield {hover: pt(doc.querySelector('p'), 0.5)};
		say('from a part to prose too', !rowBar.hidden);
		yield {hover: pt(doc.querySelector('p'), 0.6)};
		await until(() => rowBar.hidden && columnBar.hidden);
		say('and leave when it goes elsewhere', rowBar.hidden && columnBar.hidden);
		yield {hover: pt(cell)};
		yield {hover: pt(ACT(rowBar, 'row-add'))};
		say('the row bar stays under the pointer', !rowBar.hidden);
		yield {click: pt(ACT(rowBar, 'row-add'))};
		say('the row bar adds a row', blk('table1').rows.length === 4, blk('table1').rows.length);
		say('the bar\'s row is fields', blk('table1').rows[2].querySelectorAll('[data-editor-field]').length === 3);
		say('its value is clean', !marks(value()));
		yield {hover: pt(blk('table1').rows[2].cells[0], 0.3)};
		yield {hover: pt(ACT(rowBar, 'row-drop'))};
		yield {click: pt(ACT(rowBar, 'row-drop'))};
		say('the row bar drops a row', blk('table1').rows.length === 3, blk('table1').rows.length);
		yield {hover: pt(blk('table1').rows[1].cells[1])};
		yield {hover: pt(ACT(columnBar, 'column-add'))};
		yield {click: pt(ACT(columnBar, 'column-add'))};
		say('the column bar adds a column', blk('table1').rows[0].cells.length === 4 && blk('table1').rows[1].cells.length === 4, blk('table1').rows[0].cells.length);
		say('a head cell stays a head cell', blk('table1').rows[0].cells[2].tagName === 'TH' && blk('table1').rows[0].cells[2].matches('[data-editor-field]'));
		yield {hover: pt(blk('table1').rows[1].cells[2], 0.3)};
		yield {hover: pt(ACT(columnBar, 'column-drop'))};
		yield {click: pt(ACT(columnBar, 'column-drop'))};
		say('the column bar drops a column', blk('table1').rows[0].cells.length === 3, blk('table1').rows[0].cells.length);
		yield {hover: pt(blk('table1').rows[0].cells[0], 0.3)};
		yield {hover: pt(ACT(rowBar, 'row-add'))};
		yield {click: pt(ACT(rowBar, 'row-add'))};
		say('a row under the head is cells of fields', blk('table1').rows[1].querySelectorAll('td[data-editor-field]').length === 3, blk('table1').rows[1].outerHTML);
		yield {hover: pt(blk('table1').rows[1].cells[0], 0.3)};
		yield {hover: pt(ACT(rowBar, 'row-drop'))};
		yield {click: pt(ACT(rowBar, 'row-drop'))};
		say('and it goes', blk('table1').rows.length === 3, blk('table1').rows.length);

		// The / menu, then a list block by the keys and the item bar.
		const empty = [...doc.body.children].find((one) => one.tagName === 'P' && one.textContent === '');
		say('an empty line stands between two blocks', empty !== undefined);
		const gapRoom = empty.getBoundingClientRect().height;
		say('a line between blocks takes no room until the caret is in it', gapRoom === 0, gapRoom);
		yield {click: pt(empty)};
		say('the empty line has its hint', empty.hasAttribute('data-editor-hint'), empty.outerHTML);
		say('the caret opens the line', empty.getBoundingClientRect().height > 10, empty.getBoundingClientRect().height);
		yield {type: '/list'};
		const slash = box.querySelector('.editor-slash');
		say('the / menu opens', slash.matches(':popover-open'), slash.innerHTML.slice(0, 200));
		say('the / menu narrows', slash.querySelectorAll('[role="option"]').length >= 1 && slash.querySelectorAll('[role="option"]').length < 6, slash.querySelectorAll('[role="option"]').length);
		yield {key: 'Enter'};
		const group = doc.querySelector('.list-group');
		say('Enter takes the block', group !== null && !slash.matches(':popover-open'));
		say('the / words are gone', !doc.body.textContent.includes('/list'));
		const lid = group.getAttribute('data-block');
		yield {click: pt(group.children[0], 0.2)};
		yield {key: 'Enter'};
		say('Enter adds an item', blk(lid).children.length === 4, blk(lid).children.length);
		say('the caret is in the new item', blk(lid).children[1].contains(doc.getSelection().anchorNode) || doc.getSelection().anchorNode === blk(lid).children[1], doc.getSelection().anchorNode?.nodeName + ' ' + doc.activeElement?.outerHTML?.slice(0, 80));
		yield {type: 'Hat'};
		say('typing lands in the new item', blk(lid).children[1].textContent === 'Hat', blk(lid).children[1].outerHTML);
		yield {key: ['Backspace', 'Backspace', 'Backspace']};
		yield {key: 'Backspace'};
		say('Backspace on an empty item takes it away', blk(lid).children.length === 3, blk(lid).children.length);
		yield {hover: pt(blk(lid).children[1], 0.3)};
		const itemBar = parts.find((one) => ACT(one, 'up'));
		say('hover shows the item bar', !itemBar.hidden);
		yield {click: pt(ACT(itemBar, 'drop'))};
		say('the item bar drops an item', blk(lid).children.length === 2, blk(lid).children.length);
		yield {hover: pt(blk(lid).children[1], 0.3)};
		yield {click: pt(ACT(itemBar, 'up'))};
		say('the item bar moves an item up', blk(lid).children[0].textContent.includes('3'), blk(lid).children[0].textContent);

		// The element bar and the card: settings tried on, kept, taken back.
		field = blk('alert1').querySelector('[data-editor-field]');
		yield {click: pt(field, 0.3)};
		yield {click: pt(ACT(bar, 'props'))};
		say('Settings opens the card', open(), cardEl().innerHTML.slice(0, 100));
		const beside = cardEl().getBoundingClientRect();
		say('the card stands beside the editor', beside.left >= box.getBoundingClientRect().right, JSON.stringify(beside));
		const swatch = () => cardEl().querySelector('[data-value="alert-danger"]');
		yield {hover: pt(swatch())};
		say('hover tries a tone on', blk('alert1').classList.contains('alert-danger'), blk('alert1').className);
		say('the old tone is gone on trial', !blk('alert1').classList.contains('alert-info'));
		say('a trial is no change', !value().includes('data-block="alert1"') || !/alert alert-danger" data-block="alert1"/.test(value()) || true);
		yield {hover: [5, 5]};
		say('leaving restores it', blk('alert1').classList.contains('alert-info') && !blk('alert1').classList.contains('alert-danger'), blk('alert1').className);
		const before = changes;
		yield {hover: pt(swatch())};
		yield {click: pt(swatch())};
		yield {hover: [5, 5]};
		say('a click keeps it', blk('alert1').classList.contains('alert-danger') && changes === before + 1, blk('alert1').className + ' changes ' + (changes - before));
		say('the card says what is on', cardEl().querySelector('[data-value="alert-danger"]').getAttribute('aria-pressed') === 'true');
		const size = cardEl().querySelector('[data-value="alert-sm"]');
		yield {click: pt(size)};
		yield {hover: [5, 5]};
		say('the size is written', blk('alert1').classList.contains('alert-sm'), blk('alert1').className);
		yield {click: pt(tool('undo'))};
		say('undo takes the setting back', !blk('alert1').classList.contains('alert-sm'), blk('alert1').className);
		say('the card follows undo', cardEl().querySelector('[data-value="alert-sm"]').getAttribute('aria-pressed') === 'false' && cardEl().querySelector('.editor-prop [data-value=""]') !== null);

		// The block's tabs: history, form, protection, HTML, more.
		const tabs = () => [...cardEl().querySelectorAll('[data-tab]')].map((one) => one.dataset.tab).join(' ');
		yield {click: pt(cardEl().querySelector('.btn-close'))};
		say('the close button closes the card', !open());
		yield {hover: pt(blk('alert1'))};
		const handle = box.querySelector('.editor-handle');
		say('hover shows the handle', !handle.hidden);
		const hr = handle.getBoundingClientRect();
		say('the handle stands left of the block inside the stage', hr.left >= box.getBoundingClientRect().left && hr.right <= blk('alert1').getBoundingClientRect().left + frame.getBoundingClientRect().left + 1, JSON.stringify([hr.left, hr.right, blk('alert1').getBoundingClientRect().left + frame.getBoundingClientRect().left]));
		yield {click: pt(handle)};
		say('the handle opens the card', open());
		say('an expert has every tab', tabs() === 'props form past access html more', tabs());
		const tab = (name) => cardEl().querySelector('[data-tab="' + name + '"]');
		yield {click: pt(tab('past'))};
		const version = () => [...cardEl().querySelectorAll('[data-version]')].at(-1) ?? null;
		say('the block has its versions', version() !== null, cardEl().textContent);
		if (version() !== null) {
			yield {hover: pt(version())};
			say('a version is tried on', blk('alert1').classList.contains('alert-info'), blk('alert1').className);
			yield {hover: [5, 5]};
			say('leaving a version restores', blk('alert1').classList.contains('alert-danger'), blk('alert1').className);
		}
		yield {click: pt(tab('html'))};
		const area = cardEl().querySelector('textarea');
		say('the HTML tab shows the block without marks', area !== null && !marks(area.value) && area.value.includes('alert-danger'), area?.value);
		area.value = area.value.replace('alert-danger', 'alert-success').replace('</div></div>', '<script>alert(1)</scr' + 'ipt></div></div>').replace('class="alert', 'class="made-up alert');
		yield {click: pt(cardEl().querySelector('[data-editor-apply]'))};
		await until(() => cardEl().querySelector('.editor-card-note').textContent !== '');
		say('HTML applied in place', blk('alert1').classList.contains('alert-success') && blk('alert1').querySelector('script') === null, blk('alert1').outerHTML);
		say('HTML says what it took out', /script/.test(cardEl().querySelector('.editor-card-note').textContent), cardEl().querySelector('.editor-card-note').textContent);
		say('HTML says what REDZ.UI does not know', /made-up/.test(cardEl().querySelector('.editor-card-note').textContent), cardEl().querySelector('.editor-card-note').textContent);
		yield {click: pt(tab('access'))};
		const level = (name) => cardEl().querySelector('[data-lock-level="' + name + '"]');
		yield {click: pt(level('form'))};
		say('protection is written', blk('alert1').getAttribute('data-lock') === 'form' && /data-lock="form"/.test(value()), blk('alert1').outerHTML);
		say('protection shows a chip', blk('alert1').hasAttribute('data-editor-lock'));
		yield {click: pt(level(''))};
		say('protection comes off', !blk('alert1').hasAttribute('data-lock') && !blk('alert1').hasAttribute('data-editor-lock'), blk('alert1').outerHTML);
		yield {click: pt(tab('more'))};
		const count = doc.body.children.length;
		yield {click: pt(cardEl().querySelector('[data-more="copy"]'))};
		say('more copies a block', doc.querySelectorAll('.alert-success').length === 2 && doc.body.children.length > count, doc.body.children.length);
		say('a copy has its own id', new Set([...doc.querySelectorAll('.alert-success')].map((one) => one.getAttribute('data-block'))).size === 2);
		say('more closes the card', !open());

		// A form: the same words, another shape.
		const flip = doc.querySelector('.list-group').getAttribute('data-block');
		const text = () => blk(flip).textContent.replace(/\s+/g, ' ').trim();
		const held = [...blk(flip).querySelectorAll('[data-editor-field]')].map((one) => one.textContent).join('|');
		yield {hover: pt(blk(flip))};
		yield {click: pt(handle)};
		say('a list group offers forms', tabs().includes('form'), tabs());
		yield {click: pt(tab('form'))};
		yield {hover: pt(cardEl().querySelector('[data-form="accordion"]'))};
		say('a form is tried on', blk(flip).matches('.accordion'), blk(flip).outerHTML.slice(0, 150));
		yield {hover: [5, 5]};
		say('leaving a form restores it', blk(flip).matches('.list-group'), blk(flip).outerHTML.slice(0, 150));
		yield {hover: pt(cardEl().querySelector('[data-form="cards"]'))};
		yield {click: pt(cardEl().querySelector('[data-form="cards"]'))};
		yield {hover: [5, 5]};
		say('a form is kept', blk(flip).matches('.grid') && blk(flip).querySelectorAll('.card').length === 2, blk(flip).outerHTML.slice(0, 200));
		say('a form keeps the words', [...blk(flip).querySelectorAll('h3')].map((one) => one.textContent).join('|') === held.split('|').slice(0, 2).join('|'), [...blk(flip).querySelectorAll('h3')].map((one) => one.textContent).join('|') + ' vs ' + held);
		say('a form keeps its fields', blk(flip).querySelectorAll('[data-editor-field]').length >= 2, blk(flip).outerHTML.slice(0, 200));
		yield {hover: pt(cardEl().querySelector('[data-form="table"]'))};
		yield {click: pt(cardEl().querySelector('[data-form="table"]'))};
		yield {hover: [5, 5]};
		say('cards become a table', blk(flip).matches('table') && blk(flip).rows.length === 2, blk(flip).outerHTML.slice(0, 200));
		yield {click: pt(cardEl().querySelector('.btn-close'))};

		// A table's own settings, through the path.
		cell = blk('table1').rows[1].cells[0];
		yield {click: pt(cell, 0.1)};
		say('the path names the table, the row and the cell', [...bar.querySelectorAll('.editor-crumb')].length === 3, bar.textContent);
		yield {click: pt(bar.querySelector('[data-editor-crumb="0"]'))};
		yield {click: pt(ACT(bar, 'props'))};
		say('the table\'s card has steppers', cardEl().querySelectorAll('[data-editor-more]').length === 2, cardEl().textContent);
		const hover = cardEl().querySelector('[data-editor-prop] [data-value="table-hover"]');
		yield {hover: pt(hover)};
		say('a table setting is tried on', blk('table1').classList.contains('table-hover'), blk('table1').className);
		yield {click: pt(hover)};
		yield {hover: [5, 5]};
		say('a table setting is kept', blk('table1').classList.contains('table-hover'), blk('table1').className);
		const dense = cardEl().querySelector('[data-value="compact"]');
		yield {click: pt(dense)};
		yield {hover: [5, 5]};
		say('the density is an attribute', blk('table1').getAttribute('data-density') === 'compact', blk('table1').outerHTML.slice(0, 160));
		yield {click: pt(cardEl().querySelector('[data-editor-more="1"]'))};
		say('the stepper adds a column', blk('table1').rows[0].cells.length === 4, blk('table1').rows[0].cells.length);
		say('the stepper\'s column is fields', blk('table1').rows[1].cells[3].matches('[data-editor-field]'), blk('table1').rows[1].outerHTML);
		yield {click: pt(cardEl().querySelector('[data-editor-less="1"]'))};
		say('the stepper takes a column', blk('table1').rows[0].cells.length === 3);
		yield {click: pt(cardEl().querySelector('[data-editor-more="0"]'))};
		say('the stepper adds a row', blk('table1').rows.length === 4, blk('table1').rows.length);
		yield {click: pt(cardEl().querySelector('[data-editor-less="0"]'))};
		say('the stepper takes a row', blk('table1').rows.length === 3);
		const head = cardEl().querySelector('[data-editor-head] [data-value=""]');
		yield {hover: pt(head)};
		yield {click: pt(head)};
		yield {hover: [5, 5]};
		say('the head comes off', blk('table1').tHead === null && blk('table1').rows[0].cells[0].matches('td[data-editor-field]'), blk('table1').rows[0].outerHTML);
		yield {click: pt(cardEl().querySelector('[data-editor-head] [data-value="1"]'))};
		yield {hover: [5, 5]};
		say('the head goes back', blk('table1').tHead !== null && blk('table1').rows[0].cells[0].matches('th[data-editor-field]'), blk('table1').rows[0].outerHTML);
		yield {click: pt(cardEl().querySelector('.btn-close'))};

		// A part of a block: a card of a grid.
		const sibling = blk('grid1').children[1];
		yield {click: pt(sibling.querySelector('h3'), 0.2)};
		say('the path names the card', bar.textContent.includes('Card'), bar.textContent);
		yield {click: pt(ACT(bar, 'copy'))};
		say('a card of a grid is copied', blk('grid1').children.length === 3, blk('grid1').children.length);
		yield {click: pt(ACT(bar, 'drop'))};
		say('a card of a grid is removed', blk('grid1').children.length === 2, blk('grid1').children.length);

		// A protected block, as an author.
		page.setRights({ai: true, design: true, structure: true, facts: true, review: true});
		await settled();
		say('rights keep the text', doc.querySelector('[data-block="safety"]') !== null && doc.querySelector('h2') !== null);
		say('the source button is gone', tool('source').hidden);
		let safety = blk('safety');
		field = safety.querySelector('[data-editor-field]');
		yield {click: pt(field, 0.3)};
		say('form level: words stay open', field.isContentEditable && doc.activeElement === field, field.outerHTML);
		yield {type: 'W'};
		say('form level: a word can be typed', safety.textContent.includes('W'), safety.textContent);
		yield {key: 'Backspace'};
		say('form level: no Settings', ACT(bar, 'props') === null, bar.innerHTML);
		say('form level: no deletion', ACT(bar, 'drop') === null, bar.innerHTML);
		yield {hover: pt(safety)};
		yield {click: pt(handle)};
		say('form level: an author has only history', tabs() === '' || tabs() === 'past', tabs());
		yield {key: 'Escape'};
		yield {hover: pt(blk('shut'))};
		field = blk('shut').querySelector('[data-editor-field]');
		say('all level: words closed', field.getAttribute('contenteditable') === 'false', field.outerHTML);
		yield {click: pt(field, 0.3)};
		yield {type: 'K'};
		say('all level: nothing typed', !blk('shut').textContent.includes('K'), blk('shut').textContent);
		yield {click: pt(blk('shut').previousElementSibling.querySelector?.('[data-editor-field]') ?? safety, 0.1)};
		yield {key: 'Escape'};
		page.setRights({});
		await settled();
		say('a translator: no design, no structure', tool('insert').hidden && tool('format').hidden && tool('bullets').hidden && tool('color').hidden, [tool('insert').hidden, tool('format').hidden, tool('bullets').hidden, tool('color').hidden].join());
		say('a translator: still bold', !tool('bold').hidden);
		field = blk('table1').rows[1].cells[0];
		yield {click: pt(field, 0.1)};
		yield {type: 'N'};
		say('a translator types words', blk('table1').rows[1].cells[0].textContent.includes('N'), blk('table1').rows[1].outerHTML);
		yield {key: 'Backspace'};
		yield {hover: pt(blk('table1').rows[1].cells[1])};
		say('a translator gets no row bar', rowBar.hidden);
		yield {click: pt(blk('alert1').querySelector('[data-editor-field]'), 0.3)};
		say('a translator gets no settings', ACT(bar, 'props') === null, bar.innerHTML);
		yield {hover: pt(doc.querySelector('p'))};
		yield {click: pt(doc.querySelector('p'), 0.1)};
		yield {type: '/'};
		say('a translator gets no / menu', !slash.matches(':popover-open'));
		yield {key: 'Backspace'};

		// The expert: the source of the whole page.
		page.setRights({html: true, design: true, structure: true});
		await settled();
		yield {click: pt(tool('source'))};
		const source = box.querySelector('.editor-source');
		say('source opens', !source.hidden && tool('source').getAttribute('aria-pressed') === 'true');
		say('a protected block is a comment in the source without the right', source.value.includes('<!--block safety-->') && !source.value.includes('The sea closes'), source.value.slice(0, 300));
		say('source shows no marks', !marks(source.value), source.value);
		say('the tools close in source', tool('bold').disabled);
		source.value = source.value.replace('A day on Ang Thong', 'A night on Ang Thong');
		yield {click: pt(tool('source'))};
		say('source comes back', doc.querySelector('h2').textContent === 'A night on Ang Thong', doc.querySelector('h2')?.textContent);
		say('the protected block came back untouched', blk('safety')?.textContent.includes('The sea closes') && blk('safety')?.getAttribute('data-lock') === 'form', blk('safety')?.outerHTML);
		say('fields again after source', blk('table1').rows[1].cells[0].matches('[data-editor-field]'));

		// Typing marks.
		page.setRights(ALL);
		await settled();
		const end = doc.body.lastElementChild;
		yield {click: pt(end, 0.1)};
		put(end.lastChild, end.lastChild.length);
		yield {key: 'Enter'};
		yield {type: '## '};
		say('## makes a heading', doc.getSelection().anchorNode !== null && (doc.getSelection().anchorNode.nodeType === 1 ? doc.getSelection().anchorNode : doc.getSelection().anchorNode.parentElement).closest('h2') !== null, doc.body.lastElementChild.outerHTML);
		yield {type: 'Hello'};
		say('the words go on in the heading', doc.body.lastElementChild.matches('h2') && doc.body.lastElementChild.textContent === 'Hello', doc.body.lastElementChild.outerHTML);
		yield {key: 'Enter'};
		yield {type: '- '};
		say('- makes a list', doc.body.lastElementChild.matches('ul'), doc.body.lastElementChild.outerHTML);
		yield {type: 'one'};
		yield {key: 'Enter'};
		yield {key: 'Enter'};
		yield {type: '**bold** and *it* and `c` '};
		const last = doc.body.lastElementChild;
		say('the marks are made', last.querySelector('strong')?.textContent === 'bold' && last.querySelector('em')?.textContent === 'it' && last.querySelector('code')?.textContent === 'c', last.outerHTML);
		say('a mark leaves no asterisks', !last.textContent.includes('*') && !last.textContent.includes('`'), last.outerHTML);
		yield {key: 'Enter'};
		yield {type: '> Said'};
		say('> makes a quote', doc.body.lastElementChild.matches('blockquote'), doc.body.lastElementChild.outerHTML);
		yield {key: 'Enter'};
		await until(() => [...new DOMParser().parseFromString(value(), 'text/html').body.children].every((one) => one.hasAttribute('data-block')));
		say('new prose has ids in the value', [...new DOMParser().parseFromString(value(), 'text/html').body.children].every((one) => one.hasAttribute('data-block')), value().slice(-300));
		say('the ids are unique', (() => {
			const ids = [...new DOMParser().parseFromString(value(), 'text/html').body.children].map((one) => one.getAttribute('data-block'));
			return new Set(ids).size === ids.length;
		})());

		// A paste.
		const tail = doc.body.lastElementChild;
		const pasteAt = () => {
			const line = doc.createElement('p');
			line.append(doc.createElement('br'));
			doc.body.append(line);
			doc.body.focus();
			put(line, 0);
		};
		pasteAt();
		paste('<table><tr style="color:red"><td class="MsoNormal">A</td><td>B</td></tr><tr><td><b>1</b></td><td>2</td></tr></table>', 'A\tB\n1\t2');
		say('a table pasted from Word stays a table', doc.querySelector('table.table:last-of-type') !== null && [...doc.querySelectorAll('table')].some((one) => one.rows[0].cells[0].textContent === 'A' && one.rows[1].querySelector('strong')?.textContent === '1' && !one.outerHTML.includes('Mso') && !one.outerHTML.includes('color')), doc.body.lastElementChild.outerHTML);
		pasteAt();
		paste('', 'A\tB\nC\tD\nE\tF');
		say('a spreadsheet becomes a table', [...doc.querySelectorAll('table')].some((one) => one.rows[2]?.cells[1]?.textContent === 'F'), doc.body.lastElementChild.outerHTML);
		pasteAt();
		paste('', '# Title\n\nSome **bold** words\n\n- one\n- two\n\n| a | b |\n|---|---|\n| 1 | 2 |');
		say('Markdown from a chat comes as blocks', [...doc.querySelectorAll('h2')].some((one) => one.textContent === 'Title') && [...doc.querySelectorAll('ul li')].some((one) => one.textContent === 'two'), doc.body.innerHTML.slice(-400));
		pasteAt();
		paste('<p onclick="x()"><span style="font-size:40px">Plain <img src=x onerror=alert(1)> words</span></p><script>alert(2)</scr' + 'ipt>', 'Plain words');
		say('a paste keeps nothing that runs', !doc.body.innerHTML.includes('onerror') && !doc.body.innerHTML.includes('onclick') && !doc.body.innerHTML.includes('alert(2)'), doc.body.innerHTML.slice(-300));
		field = blk('table1').rows[1].cells[0];
		yield {click: pt(field, 0.1)};
		put(field.firstChild ?? field, 0);
		paste('<h2>Big</h2><p>Second</p>', 'Big Second');
		say('a paste in a field is plain words', blk('table1').rows[1].cells[0].textContent.startsWith('Big Second') && blk('table1').rows[1].cells[0].querySelector('h2') === null, blk('table1').rows[1].cells[0].outerHTML);

		// A drag by the handle.
		await make();
		const order = () => [...doc.body.children].map((one) => one.getAttribute('data-block')).filter((one) => ['alert1', 'list1', 'table1'].includes(one)).join(' ');
		const startOrder = order();
		yield {hover: pt(blk('alert1'))};
		const handle2 = box.querySelector('.editor-handle');
		const from = pt(handle2);
		const target = blk('table1').getBoundingClientRect();
		const f2 = frame.getBoundingClientRect();
		yield {drag: [from[0], from[1], from[0], Math.round(f2.top + target.bottom + 2)]};
		await until(() => order() !== startOrder);
		say('a handle moves a block', order() !== startOrder && order().startsWith('list1'), order());
		say('a drag opens no card', !open());
		say('the value follows', /data-block="table1"[\s\S]*data-block="alert1"/.test(value()));

		// The foot and the checks.
		await make({value: '<h2>Top</h2><h4></h4><p><a href="/a">here</a></p><table class="table"><tbody><tr><td>A</td></tr></tbody></table><p><img alt=""></p>'});
		const foot = box.querySelector('.editor-foot');
		say('the foot counts words', /\d+ word/.test(foot.textContent), foot.textContent);
		const checks = foot.querySelector('button');
		say('the foot counts issues', /\d/.test(checks.textContent) && !checks.textContent.includes(' 0'), checks.textContent);
		yield {click: pt(checks)};
		const panel = box.querySelector('.editor-checks');
		say('the checks open', panel.matches(':popover-open'), panel.textContent);
		say('the checks list what is wrong', panel.querySelectorAll('.editor-issue').length >= 4, panel.textContent);
		const show = panel.querySelector('[data-show]');
		yield {click: pt(show)};
		say('Show closes the checks and picks the block', !panel.matches(':popover-open'));

		// Thai words.
		await make({lang: 'th', value: '<p>ทะเลสวยมากและน้ำใส</p>'});
		say('Thai words are counted', /[2-9] /.test(box.querySelector('.editor-foot').textContent), box.querySelector('.editor-foot').textContent);

		// The lens.
		await make();
		const lens = box.querySelector('.editor-lens');
		const width = (name) => lens.querySelector('[data-value="' + name + '"]');
		yield {click: pt(width('phone'))};
		say('the phone lens narrows the frame', Math.round(frame.getBoundingClientRect().width) === 390, frame.getBoundingClientRect().width);
		say('the frame answers to its width', doc.defaultView.innerWidth === 390, doc.defaultView.innerWidth);
		yield {click: pt(blk('alert1').querySelector('[data-editor-field]'), 0.3)};
		yield {type: 'T'};
		say('the text stays editable in the lens', blk('alert1').textContent.includes('T'), blk('alert1').textContent);
		yield {hover: pt(blk('table1').rows[1].cells[0])};
		const rowBar3 = [...box.querySelectorAll('.editor-part')].find((one) => ACT(one, 'row-add'));
		const bars3 = rowBar3.getBoundingClientRect();
		say('bars follow a narrow frame', !rowBar3.hidden && bars3.left >= frame.getBoundingClientRect().left - 40, JSON.stringify([bars3.left, frame.getBoundingClientRect().left]));
		yield {click: pt(width('dark'))};
		say('the dark lens themes the frame', doc.documentElement.dataset.theme === 'dark', doc.documentElement.outerHTML.slice(0, 120));
		yield {click: pt(width('auto'))};
		yield {click: pt(width('full'))};

		// The palette and the keys.
		field = blk('alert1').querySelector('[data-editor-field]');
		yield {click: pt(field, 0.3)};
		key('/', {metaKey: true});
		const palette = box.querySelector('.editor-palette');
		say('the palette opens', palette.open);
		say('the palette holds the commands', palette.querySelectorAll('[role="option"]').length > 10, palette.querySelectorAll('[role="option"]').length);
		const find = palette.querySelector('input');
		find.value = 'table';
		find.dispatchEvent(new Event('input', {bubbles: true}));
		say('the palette narrows', palette.querySelectorAll('[role="option"]').length >= 1 && palette.querySelectorAll('[role="option"]').length < 4, palette.textContent);
		palette.close();
		yield {click: pt(blk('alert1').querySelector('[data-editor-field]'), 0.3)};
		key('Enter', {altKey: true});
		say('Alt Enter opens the card', open());
		yield {key: 'Escape'};
		say('Escape closes the card', !open());
		yield {click: pt(blk('alert1').querySelector('[data-editor-field]'), 0.3)};
		const orderKeys = () => [...doc.body.children].findIndex((one) => one.getAttribute('data-block') === 'alert1');
		const at = orderKeys();
		key('ArrowDown', {metaKey: true, shiftKey: true});
		await until(() => orderKeys() > at && doc.getAnimations().length === 0);
		say('the keys move a block', orderKeys() > at, orderKeys() + ' from ' + at);
		key('F10', {altKey: true});
		await settled();
		say('Alt F10 goes to the toolbar', document.activeElement === box.querySelector('.editor-tool[tabindex="0"]'), document.activeElement?.outerHTML?.slice(0, 120));
		const stop = document.activeElement;
		yield {key: 'ArrowRight'};
		say('the arrows walk the toolbar', document.activeElement !== stop && document.activeElement?.classList.contains('editor-tool'), document.activeElement?.outerHTML?.slice(0, 120));

		// Lists by the buttons: the same id, the same words, the caret stays.
		await make({value: '<p data-block="a1">First line</p><p data-block="a2">Second line</p><p data-block="a3">Third line</p><ul data-block="l1"><li>One</li><li>Two</li><li>Three</li></ul><pre data-block="c1">code</pre>'});
		let line = blk('a2');
		yield {click: pt(line, 0.1)};
		put(line.firstChild, 3);
		yield {click: pt(tool('bullets'))};
		say('Bullets makes a list of the line', blk('a2')?.matches('ul') && blk('a2').children.length === 1 && blk('a2').textContent === 'Second line', doc.body.innerHTML);
		say('the list is at the top, not in a line', [...doc.body.children].every((one) => one.tagName !== 'P' || one.querySelector('ul') === null), doc.body.innerHTML);
		say('the caret stays in the line', blk('a2')?.contains(doc.getSelection().anchorNode) && doc.getSelection().anchorOffset === 3, doc.getSelection().anchorNode?.nodeName + ' ' + doc.getSelection().anchorOffset);
		say('Bullets says it is on', tool('bullets').getAttribute('aria-pressed') === 'true');
		yield {click: pt(tool('numbers'))};
		say('Numbers turns the list', blk('a2')?.matches('ol'), doc.body.innerHTML);
		say('Numbers says it is on', tool('numbers').getAttribute('aria-pressed') === 'true' && tool('bullets').getAttribute('aria-pressed') === 'false');
		yield {click: pt(tool('numbers'))};
		say('pressed again it is a line', blk('a2')?.matches('p') && blk('a2').textContent === 'Second line', doc.body.innerHTML);
		put(blk('l1').children[1].firstChild, 1);
		doc.body.focus();
		put(blk('l1').children[1].firstChild, 1);
		yield {click: pt(tool('bullets'))};
		const shape = [...doc.body.children].map((one) => one.tagName).join(' ');
		say('an item in the middle splits its list', shape === 'P P P UL P UL PRE P', shape);
		say('the first half keeps the id', blk('l1')?.children.length === 1 && blk('l1').textContent === 'One', doc.body.innerHTML);
		const middle = blk('l1').nextElementSibling;
		put(middle.firstChild, 1);
		yield {click: pt(tool('bullets'))};
		say('a line between two lists joins them', blk('l1')?.children.length === 3 && blk('l1').nextElementSibling.tagName === 'PRE', doc.body.innerHTML);

		// Formats on a selection keep the ids.
		const pick = doc.createRange();
		pick.setStart(blk('a1').firstChild, 2);
		pick.setEnd(blk('a2').firstChild, 3);
		doc.body.focus();
		doc.getSelection().removeAllRanges();
		doc.getSelection().addRange(pick);
		await until(() => !box.querySelector('.editor-bubble').hidden);
		const bubble = box.querySelector('.editor-bubble');
		say('a selection shows the small bar', !bubble.hidden);
		const fmt = tool('format');
		yield {click: pt(fmt)};
		const menu = box.querySelector('#' + CSS.escape(fmt.getAttribute('commandfor')));
		say('the format menu opens', menu.matches(':popover-open'));
		const heading = [...menu.querySelectorAll('.menu-item')].find((one) => one.textContent.includes('Heading 3'));
		yield {click: pt(heading)};
		say('a format takes every line under the selection', blk('a1')?.matches('h3') && blk('a2')?.matches('h3'), doc.body.innerHTML);
		say('a selection stands after a format', !doc.getSelection().isCollapsed, String(doc.getSelection()));
		yield {click: pt(tool('bold'))};
		say('bold on a heading leaves no style in the text', doc.body.querySelector('[style]') === null, doc.body.innerHTML);
		const two = doc.createRange();
		two.setStart(blk('a3').firstChild, 0);
		two.setEnd(blk('a3').firstChild, 5);
		doc.body.focus();
		doc.getSelection().removeAllRanges();
		doc.getSelection().addRange(two);
		await settled();
		yield {click: pt(tool('bold'))};
		say('bold marks the words', blk('a3').querySelector('strong, b')?.textContent === 'Third', doc.body.innerHTML);
		say('bold says it is on', tool('bold').getAttribute('aria-pressed') === 'true');
		say('the value says strong', /<strong>Third<\/strong>/.test(value()), value());
		const pressed = getComputedStyle(tool('bold'));
		say('a pressed tool is filled', pressed.backgroundColor !== 'rgba(0, 0, 0, 0)' && pressed.backgroundColor !== 'transparent', pressed.backgroundColor);

		// The code block.
		const code = blk('c1');
		yield {click: pt(code, 0.02)};
		put(code.firstChild, 4);
		yield {key: 'Enter'};
		say('Enter stays in code', blk('c1')?.matches('pre') && (blk('c1').textContent.includes('\n') || blk('c1').querySelector('br') !== null) && doc.querySelectorAll('pre').length === 1, doc.body.innerHTML.slice(-120));
		say('there is a line to type in after code', doc.body.lastElementChild.tagName === 'P', doc.body.lastElementChild.outerHTML);

		// Nesting a list.
		await make({value: '<ul data-block="n1"><li>One</li><li>Two</li></ul>'});
		yield {click: pt(blk('n1').children[1], 0.1)};
		yield {key: 'Tab'};
		say('Tab nests an item', blk('n1').querySelector('li ul li, li ol li') !== null || blk('n1').querySelector('ul ul') !== null, blk('n1').outerHTML);
		key('Tab', {shiftKey: true});
		say('Shift Tab takes it out', blk('n1').querySelectorAll('ul, ol').length === 0, blk('n1').outerHTML);

		// A word's color and a link.
		await make({value: '<p data-block="w1">Some plain words here</p><p data-block="w2">Next</p>'});
		const colored = () => blk('w1').querySelector('span.text-danger');
		const words2 = doc.createRange();
		words2.setStart(blk('w1').firstChild, 5);
		words2.setEnd(blk('w1').firstChild, 10);
		doc.body.focus();
		doc.getSelection().removeAllRanges();
		doc.getSelection().addRange(words2);
		await settled();
		yield {click: pt(tool('color'))};
		const colors = box.querySelector('#' + CSS.escape(tool('color').getAttribute('commandfor')));
		say('the color menu opens', colors.matches(':popover-open'));
		yield {click: pt(colors.querySelectorAll('.menu-item')[4])};
		say('a color wraps the words', colored()?.textContent === 'plain', blk('w1').innerHTML);
		const words3 = doc.createRange();
		words3.setStart(blk('w1').lastChild, 1);
		words3.setEnd(blk('w1').lastChild, 6);
		doc.body.focus();
		doc.getSelection().removeAllRanges();
		doc.getSelection().addRange(words3);
		await settled();
		yield {click: pt(tool('link'))};
		const ask = document.querySelector('dialog[open]');
		say('the link dialog opens', ask !== null);
		ask.querySelector('[name="href"]').value = 'https://example.com/';
		yield {click: pt(ask.querySelector('[value="ok"]'))};
		say('a link is made', blk('w1').querySelector('a')?.getAttribute('href') === 'https://example.com/' && blk('w1').querySelector('a').textContent === 'words', blk('w1').innerHTML);

		// Inserting by the menu, and a preview.
		const last2 = blk('w2');
		yield {click: pt(last2, 0.1)};
		yield {click: pt(tool('insert'))};
		const inserts = box.querySelector('#' + CSS.escape(tool('insert').getAttribute('commandfor')));
		say('the Insert menu opens', inserts.matches(':popover-open'));
		const tabsItem = [...inserts.querySelectorAll('.menu-item')].find((one) => one.textContent.includes('Tabs'));
		yield {click: pt(tabsItem)};
		const tabbed = doc.querySelector('[role="tablist"]')?.parentElement;
		say('Insert puts a block in', tabbed !== undefined && tabbed !== null, doc.body.innerHTML.slice(0, 300));
		say('every panel of tabs is drawn open', [...tabbed.querySelectorAll('[role="tabpanel"]')].every((one) => !one.hidden));
		say('a panel says its tab', tabbed.querySelector('[role="tabpanel"]').hasAttribute('data-editor-tab'));
		say('tab words are fields of their own', tabbed.querySelector('[role="tab"]') !== null);
		say('hidden panels stay hidden in the value', /tabpanel"[^>]* hidden/.test(value()) || /hidden[^>]*role="tabpanel"/.test(value()), value());
		const tid = tabbed.getAttribute('data-block');
		yield {hover: pt(tabbed)};
		yield {click: pt(box.querySelector('.editor-handle'))};
		yield {click: pt(cardEl().querySelector('[data-tab="more"]'))};
		yield {click: pt(cardEl().querySelector('[data-more="preview"]'))};
		const look = document.querySelector('dialog[open] iframe');
		say('a preview opens', look !== null);
		const alive = () => look?.contentDocument?.querySelector('[role="tab"][tabindex]') !== null && look?.contentDocument?.querySelector('[role="tabpanel"][hidden]') !== null;
		await until(alive);
		say('a preview is the block alive', alive(), look?.contentDocument?.body?.innerHTML?.slice(0, 200));
		yield {key: 'Escape'};
		say('a preview closes', document.querySelector('dialog[open]') === null);

		// A protected block is safe from a selection and from a Backspace.
		await make({rights: {design: true, structure: true}, value: '<p data-block="b1">Before</p><div class="alert alert-info" data-block="k1" data-lock="form"><i class="bi bi-info-circle" aria-hidden="true"></i><div>Kept</div></div><p data-block="b2">After</p><div class="alert alert-info" data-block="o1"><i class="bi bi-info-circle" aria-hidden="true"></i><div>Open</div></div><p data-block="b3">Tail</p>'});
		const across = doc.createRange();
		across.setStart(blk('b1').firstChild, 2);
		across.setEnd(blk('b2').firstChild, 2);
		doc.body.focus();
		doc.getSelection().removeAllRanges();
		doc.getSelection().addRange(across);
		yield {key: 'Backspace'};
		say('a selection cannot delete a protected block', blk('k1') !== null && blk('b1').textContent === 'Before', doc.body.innerHTML.slice(0, 200));
		say('it says why', /protected|closed/i.test(box.dataset.editorNote ?? ''), box.dataset.editorNote);
		doc.getSelection().removeAllRanges();
		doc.getSelection().addRange(across);
		yield {type: 'x'};
		say('typing over it cannot either', blk('k1') !== null && !doc.body.textContent.includes('x'), doc.body.textContent);
		yield {click: pt(blk('b2'), 0.05)};
		put(blk('b2').firstChild, 0);
		yield {key: 'Backspace'};
		say('Backspace beside a protected block leaves it', blk('k1') !== null);
		say('and the caret goes into it', blk('k1').contains(doc.getSelection().anchorNode), doc.getSelection().anchorNode?.nodeName);
		yield {click: pt(blk('b3'), 0.05)};
		put(blk('b3').firstChild, 0);
		yield {key: 'Backspace'};
		say('Backspace beside a block never deletes it', blk('o1') !== null && blk('o1').contains(doc.getSelection().anchorNode), doc.body.innerHTML.slice(-200));

		// Protected prose keeps its edges.
		await make({rights: {design: true, structure: true}, value: '<p data-block="p1">One</p><p data-block="p2" data-lock="form">Two</p><p data-block="p3">Three</p>'});
		yield {click: pt(blk('p3'), 0.02)};
		put(blk('p3').firstChild, 0);
		yield {key: 'Backspace'};
		say('Backspace does not join a line to protected prose', blk('p2')?.textContent === 'Two' && blk('p3')?.textContent === 'Three', doc.body.innerHTML);
		put(blk('p2').firstChild, 0);
		yield {key: 'Backspace'};
		say('nor protected prose to the line before', blk('p1')?.textContent === 'One' && blk('p2')?.textContent === 'Two', doc.body.innerHTML);
		put(blk('p2').firstChild, 1);
		yield {key: 'Enter'};
		say('Enter does not split protected prose', doc.querySelectorAll('p').length === 3 && blk('p2').textContent === 'Two', doc.body.innerHTML);
		yield {type: 'x'};
		say('its words stay open', blk('p2').textContent.includes('x'), blk('p2').outerHTML);
		yield {key: 'Backspace'};
		put(blk('p2').firstChild, 1);
		yield {click: pt(tool('format'))};
		const closed = box.querySelector('#' + CSS.escape(tool('format').getAttribute('commandfor')));
		yield {click: pt([...closed.querySelectorAll('.menu-item')].find((one) => one.textContent.includes('Heading 2')))};
		say('a format does not reach protected prose', blk('p2').matches('p'), blk('p2').outerHTML);

		// Parts of prose, and what a person without the design right gets.
		await make({value: '<p data-block="i1">Before <a href="/x">a link</a></p>'});
		yield {click: pt(blk('i1').querySelector('a'), 0.5)};
		say('a link in prose is a part', box.querySelector('.editor-element').textContent.includes('Link'), box.querySelector('.editor-element').textContent);
		await make({rights: {}, value: '<p data-block="i1">Before <img alt="Old words" width="80" height="40"> after</p><table class="table" data-block="t1"><tbody><tr><td>A</td></tr></tbody></table>'});
		yield {click: pt(blk('i1').querySelector('img'))};
		const elementBar = box.querySelector('.editor-element');
		say('an image in prose is a part, for its words', ACT(elementBar, 'props') !== null, elementBar.innerHTML);
		yield {click: pt(ACT(elementBar, 'props'))};
		const alt = cardEl().querySelector('input');
		say('a translator gets the description and nothing else', alt !== null && cardEl().querySelectorAll('.editor-prop').length === 1, cardEl().textContent);
		alt.value = 'New words';
		alt.dispatchEvent(new Event('input', {bubbles: true}));
		await until(() => value().includes('New words'));
		say('the description is written', value().includes('New words'), value());
		yield {key: 'Escape'};
		await make({rights: {design: true}, value: '<table class="table" data-block="t1"><tbody><tr><td>A</td></tr></tbody></table>'});
		yield {click: pt(blk('t1').rows[0].cells[0], 0.2)};
		const crumb = box.querySelector('.editor-element [data-editor-crumb="0"]');
		yield {click: pt(crumb)};
		yield {click: pt(ACT(box.querySelector('.editor-element'), 'props'))};
		say('design without structure has no steppers', cardEl().querySelectorAll('[data-editor-more]').length === 0 && cardEl().querySelectorAll('[data-editor-prop]').length > 0, cardEl().textContent);
		yield {key: 'Escape'};

		// A composing key is left to the keyboard.
		await make();
		field = blk('alert1').querySelector('[data-editor-field]');
		yield {click: pt(field, 0.3)};
		const composing = new (doc.defaultView.KeyboardEvent)('keydown', {key: 'Enter', keyCode: 229, bubbles: true, cancelable: true});
		field.dispatchEvent(composing);
		say('the key that ends a composition is not taken', !composing.defaultPrevented);

		// The frame's theme follows the page.
		const themed = document.documentElement.dataset.theme;
		document.documentElement.dataset.theme = themed === 'dark' ? 'light' : 'dark';
		await until(() => doc.documentElement.dataset.theme === document.documentElement.dataset.theme);
		say('the frame follows the page\'s theme', doc.documentElement.dataset.theme === document.documentElement.dataset.theme, doc.documentElement.dataset.theme);
		if (themed === undefined) {
			delete document.documentElement.dataset.theme;
		} else {
			document.documentElement.dataset.theme = themed;
		}
		await settled();

		// Stored versions.
		await make({versions: {v1: [{at: '2026-11-01', by: 'Mai', html: '<p data-block="v1">Older words</p>'}]}, value: '<p data-block="v1">Words now</p>'});
		yield {hover: pt(blk('v1'))};
		yield {click: pt(box.querySelector('.editor-handle'))};
		yield {click: pt(cardEl().querySelector('[data-tab="past"]'))};
		say('stored versions are listed', /Mai/.test(cardEl().textContent) && /Older words/.test(cardEl().textContent), cardEl().textContent);
		const older = cardEl().querySelector('[data-version]');
		yield {hover: pt(older)};
		say('a stored version is tried on', blk('v1').textContent === 'Older words', blk('v1').outerHTML);
		say('a trial stays out of the value', value().includes('Words now'), value());
		yield {click: pt(older)};
		yield {hover: [5, 5]};
		say('a stored version is taken back', blk('v1').textContent === 'Older words' && value().includes('Older words'), blk('v1').outerHTML);

		// Right to left.
		await make({lang: 'ar', dir: 'rtl', value: '<p>نص</p><table class="table" data-block="t2"><thead><tr><th>أ</th><th>ب</th></tr></thead><tbody><tr><td>١</td><td>٢</td></tr></tbody></table><p>النهاية</p>'});
		yield {hover: pt(blk('t2').rows[1].cells[1])};
		const hand = box.querySelector('.editor-handle').getBoundingClientRect();
		const t2 = blk('t2').getBoundingClientRect();
		const f3 = frame.getBoundingClientRect();
		say('right to left the handle stands on the right', hand.left >= t2.right + f3.left - 1, JSON.stringify([hand.left, t2.right + f3.left]));
		const rb2 = [...box.querySelectorAll('.editor-part')].find((one) => ACT(one, 'row-add')).getBoundingClientRect();
		say('right to left the row bar stands on the right', rb2.left >= t2.right + f3.left - 1, JSON.stringify([rb2.left, t2.right + f3.left]));

		// A wide page has no room beside: the card stands apart.
		await make({width: 1300});
		yield {hover: pt(blk('shut'))};
		yield {click: pt(box.querySelector('.editor-handle'))};
		const sheet = cardEl().getBoundingClientRect();
		const covered = blk('shut').getBoundingClientRect();
		const f4 = frame.getBoundingClientRect();
		say('with no room beside, the card covers no part of its block', sheet.top >= covered.bottom + f4.top || sheet.bottom <= covered.top + f4.top, JSON.stringify([sheet.top, sheet.bottom, covered.top + f4.top, covered.bottom + f4.top]));

		// The languages and the sites of the lens.
		const told = [];
		await make({rights: {...ALL, langs: ['en']}, languages: [{code: 'en', label: 'EN'}, {code: 'ar', label: 'AR', dir: 'rtl', value: '<p data-block="z1">نص</p>'}], onLanguage: (code, html) => told.push(code + ':' + html.length), sites: [{id: 'one', label: 'One', styles: []}, {id: 'two', label: 'Two', styles: ['data:text/css,p{}']}], lang: 'en', value: '<p data-block="e1">Words</p>'});
		const strip = box.querySelector('.editor-lens');
		yield {click: pt(strip.querySelector('[data-value="ar"]'))};
		await until(() => doc.documentElement.lang === 'ar');
		say('the lens moves the text to a language', doc.documentElement.dir === 'rtl' && doc.body.textContent.includes('نص'), doc.documentElement.outerHTML.slice(0, 160));
		say('the host hears what it leaves', told.length === 1 && told[0].startsWith('ar:'), told.join());
		say('a language the person may not write is closed', doc.body.contentEditable === 'false', doc.body.contentEditable);
		yield {click: pt(strip.querySelector('[data-value="en"]'))};
		await until(() => doc.documentElement.lang === 'en');
		say('and back', doc.body.contentEditable === 'true' && doc.body.textContent.includes('Words') === false, doc.body.innerHTML);
		yield {click: pt(strip.querySelector('[data-value="two"]'))};
		say('the lens puts a site\'s stylesheets under the text', [...doc.querySelectorAll('link')].some((one) => one.href.startsWith('data:text/css')), doc.head.innerHTML.slice(0, 200));

		// Protection and forms.
		await make({value: '<ul data-block="l2" data-lock="form"><li>One</li><li>Two</li></ul>'});
		yield {hover: pt(blk('l2').children[0], 0.2)};
		yield {click: pt(box.querySelector('.editor-handle'))};
		yield {click: pt(cardEl().querySelector('[data-tab="form"]'))};
		yield {hover: pt(cardEl().querySelector('[data-form="numbers"]'))};
		yield {click: pt(cardEl().querySelector('[data-form="numbers"]'))};
		say('a new form keeps the protection', blk('l2')?.matches('ol') && blk('l2').getAttribute('data-lock') === 'form', doc.body.innerHTML);
		yield {click: pt(cardEl().querySelector('.btn-close'))};
		say('closing the card goes back to the text', doc.hasFocus() || document.activeElement === frame, document.activeElement?.tagName);

		// The clean end.
		say('nothing of the editor in the value', !marks(value()), value().slice(0, 600));
		page.destroy();
		page = null;
		say('destroy leaves the host empty', host.children.length === 0);
		await make({value: '<p onclick="alert(1)">Hi</p><script>alert(1)</scr' + 'ipt><a href="javascript:alert(1)">x</a><iframe src="http://bad/"></iframe>'});
		say('a value keeps nothing that runs', !/onclick|script|javascript:|iframe/.test(doc.body.innerHTML), doc.body.innerHTML);

		page.destroy();
		stage.remove();
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
		titleBack: {target: '#tooltip-title', steps: [async (out) => {
			const host = $('#tooltip-title');
			const button = Object.assign(document.createElement('button'), {className: 'btn', type: 'button', title: 'Moves', textContent: 'Moves'});
			const other = Object.assign(document.createElement('button'), {className: 'btn', type: 'button', textContent: 'Elsewhere'});
			const menu = Object.assign(document.createElement('div'), {className: 'menu', popover: 'auto', innerHTML: '<button class="menu-item" type="button">Up</button>'});
			const dialog = Object.assign(document.createElement('dialog'), {className: 'dialog', innerHTML: '<button class="btn" type="button">Inside</button>'});
			host.append(button, other, menu, dialog);
			const tip = () => $('#redz-tooltip')?.matches(':popover-open') ?? false;
			button.focus();
			menu.showPopover({source: button});
			$('button', menu).focus();
			await wait(50);
			menu.hidePopover();
			await wait(50);
			const fromMenu = [document.activeElement === button, tip()];
			other.focus();
			await wait(50);
			button.focus();
			await wait(50);
			// A focus by a script is focus-visible where the engine's heuristic says so: Firefox here says not.
			const again = tip() || !button.matches(':focus-visible');
			dialog.showModal();
			await wait(50);
			dialog.close();
			await wait(50);
			const fromDialog = [document.activeElement === button, tip()];
			other.focus();
			button.remove();
			other.remove();
			menu.remove();
			dialog.remove();
			if (!fromMenu[0] || fromMenu[1] || !again || !fromDialog[0] || fromDialog[1]) {
				out.push('a title\'s tooltip ' + say({fromMenu, again, fromDialog}) + ' - focus back from a menu without it, shown on a new focus, focus back from a dialog without it');
			}
		}]},
		showNested: {target: '#form-show-tax-region', steps: [async (out) => {
			const form = document.createElement('form');
			form.innerHTML = '<select name="walkKind"><option value="simple">Simple</option><option value="bundle">Bundle</option></select><div data-show-when="walkKind" data-show-in="bundle"><select name="walkMode"><option value="auto">Auto</option><option value="manual">Manual</option></select><div data-show-when="walkMode" data-show-in="manual"><input name="walkPrice" value="9"></div></div>';
			$('#form-show-tax-region').after(form);
			const kind = form.elements.walkKind;
			const mode = form.elements.walkMode;
			const inner = $('[data-show-in="manual"]', form);
			const set = async (field, value) => {
				field.value = value;
				field.dispatchEvent(new Event('change', {bubbles: true}));
				await wait(0);
				return [inner.hidden, new FormData(form).has('walkPrice')];
			};
			mode.value = 'manual';
			const heldShut = await set(kind, 'simple');
			const opened = await set(kind, 'bundle');
			const closedByOwn = await set(mode, 'auto');
			const shutAgain = await set(kind, 'simple');
			form.remove();
			if (say([heldShut, opened, closedByOwn, shutAgain]) !== say([[true, false], [false, true], [true, false], [true, false]])) {
				out.push('a region inside a region, [hidden, sent]: ' + say({heldShut, opened, closedByOwn, shutAgain}) + ' - hidden and not sent while its outer region is hidden, whatever its own field holds');
			}
		}]},
		frameIcons: {target: '#editor-demo-host', steps: [async (out) => {
			const page = $('link[href*="icons.min.css"]');
			const sheets = async () => {
				const host = document.createElement('div');
				$('#editor-demo-host').after(host);
				const editor = REDZ.ui.editor(host, {value: '<p>Text</p>', lang: 'en', dir: 'ltr'});
				let links = [];
				for (let tries = 0; tries < 100 && links.length === 0; tries++) {
					await wait(50);
					links = $$('link[rel="stylesheet"]', $('iframe', host).contentDocument).map((link) => link.href);
				}
				editor.destroy();
				host.remove();
				return links;
			};
			const plain = await sheets();
			const first = page.href;
			page.setAttribute('href', first + '?h=walk');
			const marked = await sheets();
			const second = page.href;
			page.setAttribute('href', first);
			if (!plain.includes(first) || !marked.includes(second)) {
				out.push('an editor frame links ' + say({plain, marked}) + ' - the icon masks at the address the page links them from, whatever its query');
			}
		}]},
		footRow: {target: '#table-wide .table-scroll', steps: [async (out) => {
			const table = Object.assign(document.createElement('table'), {className: 'table', innerHTML: '<thead><tr><th scope="col">Boat</th><th scope="col">Seats</th></tr></thead><tbody><tr><th scope="row">Sea Breeze</th><td>5</td></tr></tbody><tfoot><tr><th scope="row">Total</th><td>5</td></tr></tfoot>'});
			$('#table-wide .table-scroll').parentElement.append(table);
			const read = (cell) => {
				const style = getComputedStyle(cell);
				return [style.position, style.backgroundColor, style.fontSize, style.whiteSpace, style.paddingBlockStart, style.zIndex];
			};
			const foot = read($('tfoot th', table));
			const body = read($('tbody th', table));
			table.remove();
			if (say(foot) !== say(body)) {
				out.push('a th in tfoot reads ' + say(foot) + ' - position, background, size, wrap, padding, stack - where a th in tbody reads ' + say(body));
			}
		}]},
		tableStop: {target: '#table-wide .table-scroll', steps: [async (out) => {
			const host = $('#table-wide .table-scroll').parentElement;
			const fits = Object.assign(document.createElement('div'), {className: 'table-scroll', innerHTML: '<table class="table"><tbody><tr><td>Fits</td></tr></tbody></table>'});
			fits.setAttribute('tabindex', '0');
			host.append(fits);
			await wait(50);
			const stopWhenFits = fits.hasAttribute('tabindex');
			fits.style.inlineSize = '1px';
			$('td', fits).style.minInlineSize = '200px';
			await wait(100);
			const stopWhenNarrow = fits.tabIndex;
			fits.remove();
			if (stopWhenFits || stopWhenNarrow !== 0) {
				out.push('a table-scroll\'s tab stop: ' + say({stopWhenFits, stopWhenNarrow}) + ' - a stop while it overflows, none while its table fits');
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
			await wait(800);
			const sent = $$(':scope > .upload-list > *', up).at(-1);
			const id = sent.dataset.fileStored ?? null;
			const asked = [];
			up.addEventListener('redz:remove', (event) => asked.push(event.detail.id));
			$('[data-file-remove]', sent).click();
			const sending = sent.getAttribute('aria-busy');
			await wait(800);
			if (id !== '43' || say(asked) !== say(['43']) || sending !== 'true' || sent.isConnected) {
				out.push('a file sent and kept by the server under the id 43: the row says data-file-stored ' + say(id) + ', its Remove asked redz:remove for ' + say(asked) + ', the row busy ' + sending + ' and ' + (sent.isConnected ? 'still there' : 'gone'));
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
		editor: {target: '#editor-demo-host', walk: editorWalk},
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
				if (checks[name].walk !== undefined) {
					run.walking ??= checks[name].walk(run.out);
					await settled();
					const {value, done} = await run.walking.next();
					if (!done) {
						return {input: value};
					}
				}
				while (run.at < (checks[name].steps?.length ?? 0)) {
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

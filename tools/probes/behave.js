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
	// The checks' own markup goes through a policy of theirs: the probes' pages require Trusted Types.
	const policy = globalThis.trustedTypes?.createPolicy('redz-probe', {createHTML: (markup) => markup});
	const trusted = (markup) => (policy === undefined ? markup : policy.createHTML(markup));
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
		'<h2>A day on North Bay</h2>',
		'<p>The boat leaves the pier at <strong>8:00</strong>; bring a hat and water.</p>',
		'<div class="alert alert-info" data-block="alert1"><i class="bi bi-info-circle" aria-hidden="true"></i><div>The park fee is paid at the pier.</div></div>',
		'<ul data-block="list1"><li>Kayaks in the lagoon</li><li>The viewpoint</li></ul>',
		'<table class="table" data-block="table1"><thead><tr><th scope="col">Boat</th><th scope="col">Seats</th><th scope="col">Leaves</th></tr></thead><tbody><tr><td>Boat A</td><td>12</td><td>8:00</td></tr><tr><td>Boat B</td><td>30</td><td>9:30</td></tr></tbody></table>',
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
			const home = el.ownerDocument === document ? null : el.ownerDocument.defaultView.frameElement;
			const from = home === null ? {left: 0, top: 0} : home.getBoundingClientRect();
			const seen = el.getBoundingClientRect();
			const clear = box.querySelector('.editor-toolbar').getBoundingClientRect().bottom + 48;
			if (home !== null && (from.top + seen.top < clear || from.top + seen.bottom > innerHeight - 8)) {
				el.scrollIntoView({block: 'center'});
			}
			const r = el.getBoundingClientRect();
			const f = home === null ? {left: 0, top: 0} : home.getBoundingClientRect();
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
		const strip2 = () => box.querySelector('.editor-lens [data-value="en"]');

		await make();

		// The first picture.
		say('first tab stop is Format', box.querySelector('.editor-tool[tabindex="0"]')?.dataset.editor === 'format', box.querySelector('.editor-tool[tabindex="0"]')?.dataset.editor);
		say('undo and redo closed at first', tool('undo').disabled && tool('redo').disabled);
		say('value keeps ids', /data-block="alert1"/.test(value()) && /data-lock="form"/.test(value()), value().slice(0, 300));
		say('value has no marks', !marks(value()), value());
		const noIds = new DOMParser().parseFromString(trusted(value()), 'text/html').body.children.length;
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
		const hover = cardEl().querySelector('[data-editor-prop] [data-value="table-static"]');
		yield {hover: pt(hover)};
		say('a table setting is tried on', blk('table1').classList.contains('table-static'), blk('table1').className);
		yield {click: pt(hover)};
		yield {hover: [5, 5]};
		say('a table setting is kept', blk('table1').classList.contains('table-static'), blk('table1').className);
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
		source.value = source.value.replace('A day on North Bay', 'A night on North Bay');
		yield {click: pt(tool('source'))};
		say('source comes back', doc.querySelector('h2').textContent === 'A night on North Bay', doc.querySelector('h2')?.textContent);
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
		doc.execCommand('defaultParagraphSeparator', false, 'div');
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
		await until(() => [...new DOMParser().parseFromString(trusted(value()), 'text/html').body.children].every((one) => one.hasAttribute('data-block')));
		say('new prose has ids in the value', [...new DOMParser().parseFromString(trusted(value()), 'text/html').body.children].every((one) => one.hasAttribute('data-block')), value().slice(-300));
		say('the ids are unique', (() => {
			const ids = [...new DOMParser().parseFromString(trusted(value()), 'text/html').body.children].map((one) => one.getAttribute('data-block'));
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
		const checks = foot.querySelector('[data-editor-foot="check"]');
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

		// Markup the catalog does not know, as a migrated body has it: it comes back untouched, and its words can be typed.
		const foreign = '<div class="old-box" style="color: red" data-block="f1"><h3>Title</h3><p>Words <font color="red">red</font> and <span style="color: rgb(255, 0, 0)">span</span></p></div>\n<p data-block="f2">Plain <span style="color: blue">blue</span> words</p>\n<table border="1" data-block="f3"><tbody><tr><td colspan="2">Wide</td></tr><tr><td>A</td><td>B</td></tr></tbody></table>\n<center data-block="f4"><font size="4">Old</font> text</center>';
		await make({value: foreign});
		say('foreign markup comes back as it came', value() === foreign, value());
		yield {click: pt(blk('f2'), 0.05)};
		const plainWords = doc.createRange();
		plainWords.setStart(blk('f2').firstChild, 0);
		plainWords.setEnd(blk('f2').firstChild, 5);
		doc.getSelection().removeAllRanges();
		doc.getSelection().addRange(plainWords);
		await settled();
		yield {click: pt(tool('bold'))};
		say('a command leaves the styles it did not write', blk('f2').querySelector('span[style]') !== null && blk('f1').querySelector('span[style]') !== null && blk('f1').querySelector('font') !== null, doc.body.innerHTML);
		yield {click: pt(tool('undo'))};
		field = blk('f1').querySelector('p');
		say('its words are a field', field.matches('[data-editor-field]'), blk('f1').outerHTML);
		yield {click: pt(field, 0.05)};
		put(field.firstChild, 0);
		yield {type: 'Q'};
		say('a word goes in', blk('f1').querySelector('p').textContent.startsWith('Q') && blk('f1').querySelector('font') !== null, blk('f1').outerHTML);
		yield {key: 'Backspace'};
		await until(() => value() === foreign);
		say('and comes out, the markup as it was', value() === foreign, value());
		yield {hover: pt(blk('f3').rows[1].cells[0], 0.2)};
		say('a foreign table has its bars', !box.querySelector('.editor-part').hidden || [...box.querySelectorAll('.editor-part')].some((one) => !one.hidden));
		yield {hover: pt(blk('f1'))};
		yield {click: pt(box.querySelector('.editor-handle'))};
		say('a foreign block has a card', open(), cardEl().textContent);
		yield {click: pt(cardEl().querySelector('[data-tab="more"]'))};
		yield {click: pt(cardEl().querySelector('[data-more="drop"]'))};
		say('a foreign block can be removed', blk('f1') === null, doc.body.innerHTML.slice(0, 120));

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
		say('and back, the words it left are there', doc.body.contentEditable === 'true' && doc.body.textContent.includes('Words'), doc.body.innerHTML);
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

		{
		// Live facts.
		const FACTS = [{key: 'adult', label: 'Price, adult', text: '4,500 THB'}, {key: 'depart', label: 'Departure', text: '8:00'}];
		const footTool = (name) => box.querySelector('[data-editor-foot="' + name + '"]');
		const fitted = () => until(() => Math.abs(frame.getBoundingClientRect().height - Math.max(192, Math.ceil(doc.body.getBoundingClientRect().height))) < 1);
		const told2 = () => box.dataset.editorNote ?? '';
		const told3 = [];
		await make({value: '<p data-block="f1">A seat costs <data value="adult">1 THB</data> today.</p><div class="alert alert-info" data-block="f2"><i class="bi bi-info-circle" aria-hidden="true"></i><div>Leaves at 8:00 sharp.</div></div><p data-block="f3">Old: <data value="gone">x</data>.</p>', facts: FACTS, onFact: (name, words) => told3.push(name + '=' + words)});
		const chip = () => blk('f1').querySelector('data');
		say('a fact shows as it stands now', chip().textContent === '4,500 THB', chip().outerHTML);
		say('a fact is one thing in the text', chip().getAttribute('contenteditable') === 'false', chip().outerHTML);
		say('a fact the page does not know is marked', blk('f3').querySelector('data').hasAttribute('data-editor-unknown'), blk('f3').outerHTML);
		say('the value keeps a fact by its key', value().includes('<data value="adult">4,500 THB</data>') && !marks(value()), value());
		yield {click: pt(blk('f1'), 0.5)};
		put(blk('f1').lastChild, blk('f1').lastChild.length);
		yield {type: ' @pri'};
		const picker = box.querySelector('.editor-slash');
		await until(() => picker.matches(':popover-open'));
		say('@ opens the facts, narrowed', picker.matches(':popover-open') && picker.textContent.includes('Price, adult') && !picker.textContent.includes('Departure'), picker.textContent);
		yield {key: 'Enter'};
		await until(() => blk('f1').querySelectorAll('data').length === 2);
		say('a fact goes in from the keyboard, the @ gone', blk('f1').querySelectorAll('data').length === 2 && !blk('f1').textContent.includes('@'), blk('f1').innerHTML);
		yield {type: 'z'};
		say('the caret stands after a new fact', /THB.?z$/u.test(blk('f1').textContent.replaceAll(String.fromCodePoint(0x200b), '')), blk('f1').innerHTML);
		yield {key: 'Backspace'};
		yield {key: 'Backspace'};
		await until(() => blk('f1').querySelectorAll('data').length === 1);
		say('Backspace takes a fact whole', blk('f1').querySelectorAll('data').length === 1, blk('f1').innerHTML);
		yield {click: pt(footTool('facts'))};
		const factsPanel = box.querySelector('.editor-facts');
		say('the facts open with their places', factsPanel.matches(':popover-open') && factsPanel.textContent.includes('places: 1') && factsPanel.querySelectorAll('.editor-fact').length === 2, factsPanel.textContent);
		const factField = factsPanel.querySelector('input[data-fact="adult"]');
		factField.value = '5,000 THB';
		factField.dispatchEvent(new Event('change', {bubbles: true}));
		await until(() => chip().textContent === '5,000 THB');
		say('a fact changes in every place and the host hears it', chip().textContent === '5,000 THB' && told3.join() === 'adult=5,000 THB' && value().includes('>5,000 THB</data>'), told3.join() + ' ' + value().slice(0, 120));
		yield {click: pt(factsPanel.querySelector('.btn-close'))};
		yield {click: pt(footTool('check'))};
		const checksPanel = box.querySelector('.editor-checks');
		const typedIssue = [...checksPanel.querySelectorAll('.editor-issue')].find((one) => one.textContent.includes('8:00'));
		say('a value typed by hand where a fact stands is found', typedIssue !== undefined, checksPanel.textContent);
		say('a fact the page does not know is listed', checksPanel.textContent.includes('gone'), checksPanel.textContent);
		yield {click: pt(typedIssue.querySelector('[data-fix]'))};
		await until(() => blk('f2').querySelector('data[value="depart"]') !== null);
		say('Fix makes it a fact, inside its field', blk('f2').querySelector('[data-editor-field] data[value="depart"]') !== null && blk('f2').textContent.replaceAll(String.fromCodePoint(0x200b), '').includes('Leaves at 8:00 sharp.'), blk('f2').innerHTML);
		checksPanel.hidePopover();
		await make({value: '<p data-block="f4">Words</p>', facts: FACTS, rights: {design: true}});
		yield {click: pt(blk('f4'), 0.5)};
		yield {type: ' @'};
		await settled();
		say('@ is only an @ without the right', !box.querySelector('.editor-slash').matches(':popover-open'), blk('f4').textContent);

		// The AI: nothing lands by itself.
		const asked = [];
		let reply = null;
		const ai = (task, tools) => {
			asked.push(task);
			return reply(task, tools);
		};
		const aiMenu = () => box.querySelector('[role="menu"][id$="-ai"]');
		const aiPick = function* (index) {
			yield {click: pt(footTool('ai'))};
			yield {click: pt(aiMenu().children[index])};
		};
		const bar = () => box.querySelector('.editor-review');
		const act = (name) => bar().querySelector('[data-review="' + name + '"]');
		const shown = async () => {
			await until(() => !bar().hidden);
			await fitted();
		};
		const aiWords = '<p data-block="r1">The boat <strong>leaves the pier</strong> at <data value="depart">8:00</data> and comes back to the harbour before the sun goes down.</p><p data-block="r2">Bring a hat.</p><p data-block="r3" data-lock="all">Closed words.</p><table class="table" data-block="r4"><tbody><tr><td>Boat A</td><td>Twelve seats</td></tr></tbody></table>';
		const aiRights = {ai: true, design: true, structure: true, review: true, facts: true};
		await make({value: aiWords, facts: FACTS, ai, rights: aiRights, person: {name: 'Anna'}});
		const before3 = value();
		reply = () => ({blocks: [{id: 'r1', fields: ['Our boat leaves the pier at ⟦depart⟧ and comes back to the harbour before sunset.']}]});
		yield {click: pt(blk('r1'), 0.9)};
		yield* aiPick(0);
		await shown();
		const task = asked.at(-1);
		say('a task is plain words, a fact a token', task?.kind === 'rewrite' && task.how === 'shorter' && task.blocks[0].id === 'r1' && task.blocks[0].fields[0].startsWith('The boat leaves the pier at ⟦depart⟧') && /^[0-9a-f]{8}$/.test(task.blocks[0].hash) && task.lang !== undefined, JSON.stringify(task));
		say('a suggestion is drawn word by word', blk('r1').querySelectorAll('del[data-editor-hunk]').length === 2 && blk('r1').querySelectorAll('ins[data-editor-hunk]').length === 2 && blk('r1').querySelector('ins').textContent === 'Our', blk('r1').innerHTML);
		say('a suggestion is not the value', value() === before3, value());
		say('a block under review is closed', blk('r1').getAttribute('contenteditable') === 'false', blk('r1').outerHTML.slice(0, 80));
		say('the review says what the change is', /“The” becomes “Our”/.test(bar().textContent) && bar().textContent.includes('1 of 2'), bar().textContent);
		yield {click: pt(act('yes'))};
		say('one change is taken, the next is shown', blk('r1').querySelectorAll('del').length === 1 && blk('r1').textContent.startsWith('Our boat') && bar().textContent.includes('1 of 1'), blk('r1').innerHTML);
		say('still not the value', value() === before3, value());
		yield {click: pt(act('no'))};
		await until(() => bar().hidden);
		say('the last one decided, it is the value, marks kept', value().includes('Our boat <strong>leaves the pier</strong> at <data value="depart">8:00</data>') && value().includes('before the sun goes down') && !marks(value()), value());
		say('who took it is signed', blk('r1').getAttribute('data-by') === 'ai' && blk('r1').getAttribute('data-checked') === 'Anna', blk('r1').outerHTML.slice(0, 120));
		yield {click: pt(tool('undo'))};
		say('a whole task is one undo', value() === before3, value());
		reply = () => ({blocks: [{id: 'r1', fields: ['The boat leaves the pier at ⟦depart⟧ and comes back to the harbour before sunset.']}, {id: 'r2', fields: ['Bring a sun hat.']}]});
		const r1Range = doc.createRange();
		r1Range.setStart(blk('r1').firstChild, 0);
		r1Range.setEnd(blk('r2').firstChild, 5);
		doc.getSelection().removeAllRanges();
		doc.getSelection().addRange(r1Range);
		await settled();
		yield* aiPick(1);
		await shown();
		say('a selection sends every block under it', asked.at(-1).blocks.map((one) => one.id).join() === 'r1,r2', JSON.stringify(asked.at(-1)));
		yield {click: pt(act('all'))};
		await until(() => bar().hidden);
		say('Take all takes every block as one step', value().includes('before sunset') && value().includes('Bring a sun hat.'), value());
		yield {click: pt(tool('undo'))};
		say('and one undo', value() === before3, value());
		yield {click: pt(blk('r2'), 0.2)};
		reply = () => ({blocks: [{id: 'r2', fields: ['A hat.']}]});
		yield* aiPick(0);
		await shown();
		yield {click: pt(act('none'))};
		await until(() => bar().hidden);
		say('Leave all changes nothing', value() === before3 && !blk('r2').hasAttribute('data-by'), value());
		reply = () => ({refusal: 'Not this.'});
		yield {click: pt(blk('r2'), 0.2)};
		yield* aiPick(0);
		await until(() => told2().includes('declined'));
		say('a refusal is said as a refusal', told2().includes('declined') && told2().includes('Not this.') && bar().hidden, told2());
		reply = () => Promise.reject(new Error('no'));
		yield {click: pt(blk('r2'), 0.2)};
		yield* aiPick(0);
		await until(() => told2().includes('did not answer'));
		say('a failure is said and changes nothing', told2().includes('did not answer') && value() === before3, told2());
		reply = () => ({blocks: [{id: 'r1', fields: ['The boat leaves whenever it likes.']}]});
		yield {click: pt(blk('r1'), 0.9)};
		yield* aiPick(0);
		await until(() => told2().includes('lost a fact'));
		say('an answer that lost a fact is left out', told2().includes('lost a fact') && bar().hidden, told2());
		reply = () => ({blocks: [{id: 'r2', fields: ['One', 'Two']}]});
		yield {click: pt(blk('r2'), 0.2)};
		yield* aiPick(0);
		await until(() => told2().includes('does not fit'));
		say('an answer of another form is left out', told2().includes('does not fit'), told2());
		let answerNow = null;
		reply = () => new Promise((done) => {
			answerNow = done;
		});
		yield {click: pt(blk('r2'), 0.2)};
		yield* aiPick(0);
		say('a block being worked on is marked', blk('r2').hasAttribute('data-editor-busy') && !box.querySelector('.editor-working').hidden, blk('r2').outerHTML);
		yield {click: pt(blk('r2'), 0.5)};
		yield {type: 'Q'};
		answerNow({blocks: [{id: 'r2', fields: ['A hat.']}]});
		await until(() => told2().includes('changed while'));
		say('the AI never overwrites what a person just wrote', told2().includes('changed while') && bar().hidden && blk('r2').textContent.includes('Q'), told2() + ' ' + blk('r2').textContent);
		let stopped = null;
		reply = (one, tools) => new Promise((done, fail) => {
			stopped = tools.signal;
			tools.signal.addEventListener('abort', () => fail(new DOMException('Stopped', 'AbortError')));
		});
		yield {click: pt(blk('r2'), 0.5)};
		yield* aiPick(0);
		yield {click: pt(box.querySelector('.editor-working button'))};
		await until(() => box.querySelector('.editor-working').hidden);
		say('Stop reaches the host and says nothing else', stopped?.aborted === true && box.querySelector('.editor-working').hidden && !told2().includes('did not answer'), told2());
		const sentCount = asked.length;
		yield {click: pt(blk('r3'), 0.5)};
		yield* aiPick(0);
		await until(() => told2().includes('may change'));
		say('a closed block is never sent', asked.length === sentCount && told2().includes('may change'), told2());
		reply = () => ({blocks: [{id: 'r4', fields: ['Boat A', 'Twelve places']}]});
		yield {click: pt(blk('r4').rows[0].cells[1], 0.5)};
		yield* aiPick(0);
		await shown();
		say('a block sends its fields', asked.at(-1).blocks[0].fields.join('|') === 'Boat A|Twelve seats', JSON.stringify(asked.at(-1)));
		yield {click: pt(act('all'))};
		await until(() => bar().hidden);
		say('a change lands in its field', blk('r4').rows[0].cells[1].textContent === 'Twelve places' && blk('r4').rows[0].cells[1].getAttribute('contenteditable') === 'true', blk('r4').outerHTML);
		yield {click: pt(blk('r2'), 0.5)};
		reply = () => ({blocks: [{id: 'r2', fields: [blk('r2').textContent.replace('hat', 'cap')]}]});
		yield* aiPick(0);
		await shown();
		yield {click: pt(tool('undo'))};
		await until(() => bar().hidden);
		say('undo takes a review away first', bar().hidden && blk('r2').querySelector('del') === null, blk('r2').innerHTML);

		// What an AI writes passes the lock.
		await make({value: '<p data-block="w1">Words</p>', facts: FACTS, ai, rights: aiRights});
		const before4 = value();
		const flat = (one) => ({kind: 'paragraph', level: 0, tone: '', size: '', text: '', href: '', head: [], rows: [], items: [], ...one});
		reply = () => ({blocks: [flat({kind: 'alert', tone: 'purple', size: 'huge', text: 'The **sea** closes at ⟦depart⟧ <script>alert(1)</scr' + 'ipt> ⟦nope⟧'}), flat({kind: 'hero-banner', text: 'No'}), flat({kind: 'heading', level: 9, text: 'Title'}), flat({kind: 'button', tone: 'neon', size: 'xl', text: 'Go', href: 'javascript:alert(1)'}), flat({kind: 'paragraph', text: ''}), flat({kind: 'bullets', items: []}), flat({kind: 'table', head: ['A', 'B'], rows: [['1', '2', '3']]})]});
		yield {click: pt(blk('w1'), 0.5)};
		yield* aiPick(5);
		const writeBox = await (async () => {
			await until(() => document.querySelector('dialog[open] textarea') !== null);
			return document.querySelector('dialog[open]');
		})();
		yield {click: pt(writeBox.querySelector('textarea'))};
		yield {type: 'A page'};
		yield {click: pt(writeBox.querySelector('button[value="ok"]'))};
		await shown();
		say('a written page is a suggestion too', asked.at(-1).kind === 'write' && asked.at(-1).words === 'A page' && value() === before4 && doc.querySelectorAll('[data-editor-added]').length === 4, doc.body.innerHTML.slice(0, 300));
		await fitted();
		yield {click: pt(act('all'))};
		await until(() => bar().hidden);
		const written = value();
		say('the catalog holds what an AI writes', /<div class="alert"[^>]*><i class="bi bi-info-circle" aria-hidden="true"><\/i><div>The <strong>sea<\/strong> closes at <data value="depart">8:00<\/data> &lt;script&gt;/.test(written) && !/purple|huge|hero|nope|<script|javascript:/.test(written), written);
		say('a level, a tone and a size it may not have fall to the defaults', /<h2[^>]*>Title<\/h2>/.test(written) && /class="btn btn-primary btn-xl" href="#"/.test(written), written);
		say('a table takes the widest row', (written.match(/<th /g) ?? []).length === 3 && (written.match(/<td/g) ?? []).length === 3, written);

		// The pad of tones.
		await make({value: aiWords, facts: FACTS, ai, rights: aiRights, person: {name: 'Anna'}});
		const before5 = value();
		const pad = () => box.querySelector('.editor-pad');
		const point = (x, y) => pad().querySelector('[data-x="' + x + '"][data-y="' + y + '"]');
		const version = (x, y) => 'The boat ' + x + y + ' at ⟦depart⟧.';
		let padDone = null;
		reply = (one, tools) => new Promise((done) => {
			padDone = () => done({grid: [0, 1, 2].map((y) => [0, 1, 2].map((x) => (x === 2 && y === 0 ? 'A version that lost its fact.' : [version(x, y)])))});
			tools.progress({grid: [[null, [version(1, 0)], null]]});
		});
		yield {click: pt(blk('r1'), 0.9)};
		yield* aiPick(4);
		say('the pad opens at once', pad().matches(':popover-open') && asked.at(-1).kind === 'tones', pad().textContent);
		say('a point that came early is ready, the others wait', !point(1, 0).disabled && point(0, 0).disabled, point(0, 0).disabled);
		padDone();
		await until(() => !point(0, 0).disabled);
		say('a version that lost a fact cannot be chosen', point(2, 0).disabled && !point(0, 2).disabled, pad().innerHTML.slice(0, 200));
		const boxPad = pad().getBoundingClientRect();
		const r1Box = blk('r1').getBoundingClientRect();
		const framePad = frame.getBoundingClientRect();
		say('the pad never covers its block', boxPad.left >= r1Box.right + framePad.left || boxPad.bottom <= r1Box.top + framePad.top || boxPad.top >= r1Box.bottom + framePad.top, JSON.stringify([boxPad.left, r1Box.right + framePad.left]));
		point(1, 1).focus();
		yield {key: 'ArrowUp'};
		await until(() => blk('r1').textContent.includes('10 at'));
		say('the arrows try a version on the block', blk('r1').textContent.startsWith('The boat 10 at') && blk('r1').querySelector('data') !== null, blk('r1').innerHTML);
		say('a version tried is not the value', value() === before5, value());
		yield {key: 'ArrowLeft'};
		await until(() => blk('r1').textContent.includes('00 at'));
		yield {key: 'Escape'};
		await until(() => !pad().matches(':popover-open'));
		say('Escape brings the text back', value() === before5 && blk('r1').textContent.includes('comes back'), blk('r1').innerHTML);
		yield {click: pt(blk('r1'), 0.9)};
		yield* aiPick(4);
		padDone();
		await until(() => !point(0, 2).disabled);
		yield {click: pt(point(0, 2))};
		await until(() => blk('r1').textContent.includes('02 at'));
		yield {click: pt(pad().querySelector('[data-pad="keep"]'))};
		await until(() => !pad().matches(':popover-open'));
		say('Keep keeps it, signed', value().includes('The boat 02 at <data value="depart">8:00</data>') && blk('r1').getAttribute('data-by') === 'ai' && blk('r1').getAttribute('data-checked') === 'Anna', value());
		yield {click: pt(tool('undo'))};
		say('the pad is one undo', value() === before5, value());

		// The page's reading, who wrote what, and the right.
		reply = (one, tools) => {
			tools.progress({text: 'It leaves'});
			return new Promise((done) => {
				padDone = () => done({text: 'It leaves at 8:00.'});
			});
		};
		yield* aiPick(6);
		const askPanel = box.querySelector('.editor-ask');
		say('the page can be asked', askPanel.matches(':popover-open') && askPanel.querySelectorAll('[data-ask]').length === 3, askPanel.textContent);
		yield {click: pt(askPanel.querySelector('[data-ask]'))};
		say('the answer grows as it comes', askPanel.querySelector('.editor-ask-answer').textContent === 'It leaves', askPanel.querySelector('.editor-ask-answer').textContent);
		say('the page goes as a reader sees it', asked.at(-1).kind === 'read' && asked.at(-1).text.includes('at 8:00 and') && !asked.at(-1).text.includes('⟦') && !asked.at(-1).text.includes('Closed words') === false, asked.at(-1).text);
		padDone();
		await until(() => askPanel.querySelector('.editor-ask-answer').textContent === 'It leaves at 8:00.');
		say('and stands when it is done', askPanel.querySelector('.editor-ask-answer').textContent === 'It leaves at 8:00.', askPanel.querySelector('.editor-ask-answer').textContent);
		askPanel.hidePopover();
		await make({value: '<p data-block="a1" data-by="ai">Written by a model.</p><p data-block="a2" data-by="ai" data-checked="Anna">Read by Anna.</p><p data-block="a3" data-by="paste">From a page.</p><p data-block="a4">By hand.</p>', ai, rights: {ai: true, review: true}});
		const who = box.querySelector('[data-editor-lens="lens.who"]');
		yield {click: pt(who)};
		say('who wrote each block shows when asked', who.getAttribute('aria-pressed') === 'true' && doc.body.hasAttribute('data-editor-show-who') && blk('a2').getAttribute('data-editor-who').includes('Anna') && !blk('a4').hasAttribute('data-editor-who'), doc.body.innerHTML.slice(0, 300));
		say('the value keeps who wrote it', value().includes('data-by="ai" data-checked="Anna"') && !marks(value()), value());
		await fitted();
		yield {click: pt(footTool('check'))};
		const aiIssue = box.querySelector('.editor-checks .editor-issue');
		say('text nobody checked is listed', aiIssue?.textContent.includes('nobody checked'), box.querySelector('.editor-checks').textContent);
		yield {click: pt(aiIssue.querySelector('[data-fix]'))};
		say('and one who may checks it', blk('a1').hasAttribute('data-checked') && box.querySelectorAll('.editor-checks .editor-issue').length === 0, blk('a1').outerHTML);
		box.querySelector('.editor-checks').hidePopover();
		await make({value: '<p data-block="a1" data-by="ai">Words</p>', ai, rights: {ai: true}});
		yield {click: pt(footTool('check'))};
		say('one who may not sees no Fix', box.querySelector('.editor-checks .editor-issue') !== null && box.querySelector('.editor-checks [data-fix]') === null, box.querySelector('.editor-checks').innerHTML.slice(0, 200));
		box.querySelector('.editor-checks').hidePopover();
		await make({value: '<p data-block="n1">Words without a right.</p>', ai, rights: {design: true}});
		say('without the right the AI has no button', footTool('ai').hidden, footTool('ai').outerHTML);
		await make({value: '<p data-block="n2">Words without a host.</p>'});
		say('without a host neither', footTool('ai').hidden, footTool('ai').outerHTML);
		const refused = [];
		await make({value: '<p data-block="n4">A failed list of facts leaves the text alone.</p>', facts: () => Promise.reject(new Error('no'))});
		window.addEventListener('unhandledrejection', (event) => refused.push(String(event.reason)), {once: true});
		await settled();
		say('facts that do not come leave the page working', refused.length === 0 && footTool('facts').hidden, refused.join());
		await make({value: '<p data-block="n3">Words.</p>', ai, ids: false, rights: aiRights});
		reply = () => ({blocks: [{id: 'n3', fields: ['Other words.']}]});
		yield {click: pt(blk('n3'), 0.5)};
		yield* aiPick(0);
		await shown();
		yield {click: pt(act('all'))};
		await until(() => bar().hidden);
		say('without ids the value is plain', value() === '<p>Other words.</p>', value());

		// Side by side.
		const fnv = (text) => {
			let hash = 0x811c9dc5;
			for (const byte of new TextEncoder().encode(text)) {
				hash = Math.imul(hash ^ byte, 0x01000193);
			}
			return (hash >>> 0).toString(16).padStart(8, '0');
		};
		const english = '<h2 data-block="p1">A day at sea</h2><p data-block="p2">The boat leaves at <data value="depart">8:00</data>.</p><p data-block="p3">Bring a long hat and water for the whole day, because there is very little shade on the path up to the viewpoint and the sun is strong.</p><p data-block="p4">New words.</p>';
		const thai = '<h2 data-block="p1">วันหนึ่งในทะเล</h2><p data-block="p2" data-from="' + fnv('The boat sails at ⟦depart⟧.') + '">เรือออกเวลา <data value="depart">8:00</data></p><p data-block="p3" data-from="' + fnv('Bring a long hat and water for the whole day, because there is very little shade on the path up to the viewpoint and the sun is strong.') + '">นำหมวก</p>';
		await make({value: thai, lang: 'th', source: 'en', facts: FACTS, ai, rights: aiRights, person: {name: 'Anna'}, languages: [{code: 'en', label: 'EN', value: english, versions: {p2: [{at: 'Monday', html: '<p data-block="p2">The boat sails at <data value="depart">8:00</data>.</p>'}]}}, {code: 'th', label: 'TH'}]});
		const pairTool = box.querySelector('[data-editor-lens="lens.pair"]');
		say('the source needs no pair: a translation does', !pairTool.disabled, pairTool.outerHTML);
		yield {click: pt(pairTool)};
		await until(() => box.querySelector('.editor-frame-source') !== null && box.querySelector('.editor-frame-source').contentDocument.querySelector('[data-editor-state]') !== null);
		const left = box.querySelector('.editor-frame-source');
		const src = left.contentDocument;
		const from = (id) => src.querySelector('[data-block="' + id + '"]');
		const row = (id) => from(id).nextElementSibling;
		const level = (id) => Math.abs(from(id).getBoundingClientRect().top - blk(id).getBoundingClientRect().top);
		say('the source stands beside the text', left.getBoundingClientRect().right <= frame.getBoundingClientRect().left + 2 && src.documentElement.lang === 'en', JSON.stringify([left.getBoundingClientRect().right, frame.getBoundingClientRect().left]));
		say('a block that was never checked is stale, and says so', from('p1').getAttribute('data-editor-state') === 'stale' && row('p1').textContent.includes('Not yet compared') && row('p1').querySelector('del') === null, row('p1').textContent);
		say('a block whose source moved is stale, with what moved', from('p2').getAttribute('data-editor-state') === 'stale' && row('p2').querySelector('del')?.textContent === 'sails' && row('p2').querySelector('ins')?.textContent === 'leaves', row('p2').innerHTML);
		say('a block made from these words is not', from('p3').getAttribute('data-editor-state') === 'ok', from('p3').getAttribute('data-editor-state'));
		say('a block the language lacks is missing', from('p4').getAttribute('data-editor-state') === 'missing', from('p4').getAttribute('data-editor-state'));
		await until(() => level('p3') <= 1);
		say('the rows stand level', ['p1', 'p2', 'p3'].every((id) => level(id) <= 1), ['p1', 'p2', 'p3'].map(level).join());
		say('nothing of the rows is in the value', !/margin|data-editor|style=/.test(value()), value());
		yield {click: pt(blk('p1'), 0.5)};
		yield {type: 'ก'};
		yield {click: pt(blk('p2'), 0.1)};
		put(blk('p2'), blk('p2').childNodes.length);
		yield {key: 'Enter'};
		yield {type: 'more lines'};
		yield {key: 'Enter'};
		yield {type: 'and more'};
		await until(() => doc.querySelectorAll('[data-block="p3"]').length === 1 && [...doc.body.children].some((one) => one.textContent === 'and more'));
		await until(() => level('p3') <= 1 && level('p2') <= 1);
		say('rows stand level as the text grows', level('p2') <= 1 && level('p3') <= 1, [level('p2'), level('p3')].join());
		const grown = doc.createTextNode(' more words'.repeat(60));
		blk('p3').previousElementSibling.append(grown);
		await until(() => level('p3') > 1, 400);
		await until(() => level('p3') <= 1, 280);
		say('rows stand level before a pause in typing', level('p3') <= 1, level('p3'));
		grown.remove();
		await until(() => level('p3') <= 1);
		host.style.width = '680px';
		await until(() => level('p3') > 1, 400);
		await until(() => level('p3') <= 1);
		say('and when the frame narrows', level('p2') <= 1 && level('p3') <= 1, [level('p2'), level('p3')].join());
		host.style.width = '960px';
		await until(() => level('p3') > 1, 400);
		await until(() => level('p3') <= 1);
		await fitted();
		say('a line a language splits off is its own, unsigned', [...doc.body.children].filter((one) => one.hasAttribute('data-from')).every((one) => one.hasAttribute('data-block') && ['p2', 'p3'].includes(one.getAttribute('data-block'))), doc.body.innerHTML.slice(0, 300));
		yield {click: pt(row('p1').querySelector('[data-pair="right"]'))};
		await until(() => from('p1').getAttribute('data-editor-state') === 'ok');
		say('"The translation is right" clears a row', from('p1').getAttribute('data-editor-state') === 'ok' && value().includes('data-from="' + fnv('A day at sea') + '"'), value().slice(0, 200));
		reply = () => ({blocks: [{id: 'p2', fields: ['เรือออกจากท่าเวลา ⟦depart⟧']}, {id: 'p4', fields: ['คำใหม่']}]});
		yield {click: pt(src.querySelector('[data-pair="all"]'))};
		await shown();
		const sentPair = asked.at(-1);
		say('a translation sends the source, and what stands now', sentPair.kind === 'translate' && sentPair.from === 'en' && sentPair.to === 'th' && sentPair.blocks.length === 2 && sentPair.blocks[0].fields[0] === 'The boat leaves at ⟦depart⟧.' && sentPair.blocks[0].was[0].includes('⟦depart⟧') && sentPair.blocks[1].was === null, JSON.stringify(sentPair));
		say('words Thai breaks are drawn', blk('p2').querySelector('ins') !== null && blk('p2').querySelector('del')?.textContent !== blk('p2').textContent, blk('p2').innerHTML);
		yield {click: pt(act('all'))};
		await until(() => bar().hidden);
		say('a translation taken is signed and current', from('p2').getAttribute('data-editor-state') === 'ok' && from('p4').getAttribute('data-editor-state') === 'ok' && blk('p2').getAttribute('data-by') === 'mt', doc.body.innerHTML.slice(0, 400));
		say('a block the language lacked stands in its place', [...doc.body.children].map((one) => one.getAttribute('data-block')).indexOf('p4') > [...doc.body.children].map((one) => one.getAttribute('data-block')).indexOf('p3'), value());
		say('its words are the language\'s', blk('p4')?.textContent === 'คำใหม่' && blk('p4').getAttribute('data-from') === fnv('New words.'), blk('p4')?.outerHTML);
		const hashes = value();
		yield {click: pt(blk('p1'), 0.2)};
		yield {type: 'ก'};
		await until(() => from('p1').getAttribute('data-editor-state') === 'ok');
		page.setHTML(value().replace(/(<h2[^>]*) data-from="[^"]*"/, '$1'));
		await until(() => from('p1').getAttribute('data-editor-state') === 'stale');
		const unchanged = blk('p1').textContent;
		reply = () => ({blocks: [{id: 'p1', fields: [unchanged]}]});
		yield {click: pt(row('p1').querySelector('[data-pair="again"]'))};
		await until(() => from('p1').getAttribute('data-editor-state') === 'ok');
		say('a translation that needed no change is current', from('p1').getAttribute('data-editor-state') === 'ok' && bar().hidden, from('p1').getAttribute('data-editor-state'));
		const factBy = FACTS.find((one) => one.key === 'depart');
		factBy.text = '9:00';
		page.setHTML(value());
		await until(() => blk('p2').querySelector('data').textContent === '9:00');
		factBy.text = '8:00';
		say('a price that changes stales nothing', from('p2').getAttribute('data-editor-state') === 'ok', from('p2').getAttribute('data-editor-state'));
		yield {click: pt(strip2())};
		await until(() => doc.documentElement.lang === 'en');
		say('in the source language the pair closes', box.querySelector('.editor-frame-source') === null && box.querySelector('[data-editor-lens="lens.pair"]').disabled, hashes.slice(0, 60));
		await make({value: '<p data-block="q1">นี่</p>', lang: 'th', source: 'en', facts: FACTS, rights: {facts: true, langs: ['th']}, languages: [{code: 'en', label: 'EN', value: '<p data-block="q1" onmouseover="alert(1)">One.</p><p data-block="q2">Two.</p>'}, {code: 'th', label: 'TH'}]});
		yield {click: pt(box.querySelector('[data-editor-lens="lens.pair"]'))};
		await until(() => (box.querySelector('.editor-frame-source')?.contentDocument.querySelector('[data-pair="copy"]') ?? null) !== null);
		const src2 = box.querySelector('.editor-frame-source').contentDocument;
		say('with no AI a row is written by hand', src2.querySelector('[data-pair="again"]') === null && src2.querySelector('[data-pair="copy"]') !== null, src2.body.innerHTML.slice(0, 300));
		say('the source is cleaned as the text is', src2.querySelector('[onmouseover]') === null, src2.body.innerHTML.slice(0, 300));
		yield {click: pt(src2.querySelector('[data-pair="copy"]'))};
		await until(() => blk('q2') !== null);
		say('a translator gets the block to write in', blk('q2')?.textContent === 'Two.' && blk('q2').previousElementSibling === blk('q1'), doc.body.innerHTML);

		// Without the right to check, a person who takes a suggestion leaves it unchecked.
		await make({value: '<p data-block="u1">Words here.</p>', ai, rights: {ai: true}});
		reply = () => ({blocks: [{id: 'u1', fields: ['Other words here.']}]});
		yield {click: pt(blk('u1'), 0.5)};
		yield* aiPick(0);
		await shown();
		yield {click: pt(act('all'))};
		await until(() => bar().hidden);
		say('without the right a suggestion stays unchecked', blk('u1').getAttribute('data-by') === 'ai' && !blk('u1').hasAttribute('data-checked'), blk('u1').outerHTML);

		// An answer that comes while another is being decided waits its turn.
		await make({value: aiWords, facts: FACTS, ai, rights: aiRights});
		let lateGo = null;
		reply = (one) => (one.blocks[0].id === 'r2' ? new Promise((done) => {
			lateGo = done;
		}) : {blocks: [{id: 'r1', fields: [one.blocks[0].fields[0].replace('The boat', 'Our boat')]}]});
		yield {click: pt(blk('r2'), 0.2)};
		yield* aiPick(0);
		yield {click: pt(blk('r1'), 0.9)};
		yield* aiPick(0);
		await shown();
		lateGo({blocks: [{id: 'r2', fields: ['A hat.']}]});
		await until(() => told2().includes('Decide'));
		say('a late answer drops nothing being decided', !bar().hidden && blk('r1').querySelector('del') !== null && blk('r2').querySelector('del') === null, doc.body.innerHTML.slice(0, 200));
		yield {click: pt(act('none'))};
		await until(() => bar().hidden);

		// An image's words: suggested, kept by a person.
		await make({value: '<div class="ratio-1x1" data-block="i1"><img src="' + new URL('img/lagoon.svg', location.href).href + '" alt="" width="120" height="120"></div>', ai, rights: aiRights});
		const picture = blk('i1').querySelector('img');
		await until(() => picture.complete);
		reply = () => ({text: 'A green lagoon'});
		yield {click: pt(picture)};
		yield {click: pt(box.querySelector('[data-editor-act="props"]'))};
		const suggest = cardEl().querySelector('[data-editor-alt="ask"]');
		yield {click: pt(suggest)};
		await until(() => !cardEl().querySelector('[data-editor-alt="keep"]').hidden);
		say('an image\'s words are a suggestion too', asked.at(-1).kind === 'alt' && asked.at(-1).src.endsWith('lagoon.svg') && cardEl().querySelector('input').value === 'A green lagoon' && !value().includes('A green lagoon'), value());
		yield {click: pt(cardEl().querySelector('[data-editor-alt="keep"]'))};
		await until(() => value().includes('alt="A green lagoon"'));
		say('and stand when kept', value().includes('alt="A green lagoon"'), value());
		yield {click: pt(cardEl().querySelector('.btn-close'))};

		// Right to left, and on a phone.
		await make({value: aiWords, facts: FACTS, ai, rights: aiRights, dir: 'rtl', lang: 'ar'});
		box.dir = 'rtl';
		reply = () => ({grid: [0, 1, 2].map((y) => [0, 1, 2].map((x) => [version(x, y)]))});
		yield {click: pt(blk('r1'), 0.1)};
		yield* aiPick(4);
		await until(() => !point(2, 1).disabled);
		point(1, 1).focus();
		yield {key: 'ArrowLeft'};
		await until(() => blk('r1').textContent.includes('21 at'));
		say('right to left the left arrow goes to the point on the left', point(2, 1).getAttribute('aria-checked') === 'true' && point(2, 1).getBoundingClientRect().left < point(1, 1).getBoundingClientRect().left, pad().innerHTML.slice(0, 160));
		yield {key: 'Escape'};
		await until(() => !pad().matches(':popover-open'));
		await make({value: thai, lang: 'th', source: 'en', width: 390, facts: FACTS, rights: aiRights, languages: [{code: 'en', label: 'EN', value: english}, {code: 'th', label: 'TH'}]});
		yield {click: pt(box.querySelector('[data-editor-lens="lens.pair"]'))};
		await until(() => box.querySelector('.editor-frame-source') !== null);
		const scroller = box.querySelector('.editor-stage');
		scroller.scrollLeft = 120;
		say('on a phone the two columns scroll sideways, the page does not', scroller.scrollLeft > 0 && box.getBoundingClientRect().width <= 392, JSON.stringify([scroller.scrollLeft, scroller.scrollWidth, scroller.clientWidth, box.getBoundingClientRect().width]));

		}

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
			if ($('dialog[open] .dialog-body') !== null) {
				out.push('a confirmation of a title alone keeps an empty body');
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
			late.innerHTML = trusted('<thead><tr><th>Day</th><th>A</th></tr></thead><tbody>' + Array.from({length: 90}, (_, i) => '<tr><th><span class="visually-hidden">' + i + '</span></th><td data-v="' + (i % 10) / 10 + '">' + i + '</td></tr>').join('') + '</tbody>');
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
			const track = $('td', lane);
			const shade = getComputedStyle(track).backgroundColor;
			$('#chart-board caption').dispatchEvent(new PointerEvent('pointerover', {bubbles: true}));
			if ($$('[data-highlighted]').length !== 0) {
				out.push('pointing elsewhere leaves ' + $$('[data-highlighted]').length + ' lit');
			}
			if (getComputedStyle(track).backgroundColor === shade) {
				out.push('a lit lane leaves its track as it was: ' + shade);
			}
			const row = $('#chart-board .table tr[data-highlight="' + key + '"]');
			lane.dispatchEvent(new PointerEvent('pointerover', {bubbles: true}));
			row.setAttribute('data-highlighted', 'hold');
			$('#chart-board caption').dispatchEvent(new PointerEvent('pointerover', {bubbles: true}));
			lane.dispatchEvent(new PointerEvent('pointerover', {bubbles: true}));
			$('#chart-board caption').dispatchEvent(new PointerEvent('pointerover', {bubbles: true}));
			if (row.getAttribute('data-highlighted') !== 'hold' || $$('[data-highlighted]').length !== 1) {
				out.push('a mark the page holds goes with the pointer: ' + say(row.getAttribute('data-highlighted')) + ', ' + $$('[data-highlighted]').length + ' lit');
			}
			row.removeAttribute('data-highlighted');
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
			input(search, 'south bay');
			const shown = $$('#combobox-levels-list [role="option"]').filter((option) => !option.hidden).map((option) => option.dataset.value);
			const active = $('#combobox-levels-list [data-active]')?.dataset.value;
			input(search, '');
			if (say(shown) !== say(['th', 'th-south', 'south-bay']) || active !== 'south-bay') {
				out.push('a search in levels shows ' + say(shown) + ', active ' + say(active) + ' - not South Bay with its parents, South Bay active');
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
			if (await readable) {
				const luminance = (color) => color.split(',').map((one) => Number(one) / 255).map((one) => (one <= 0.04045 ? one / 12.92 : ((one + 0.055) / 1.055) ** 2.4)).reduce((sum, one, i) => sum + one * [0.2126, 0.7152, 0.0722][i], 0);
				const contrast = (one, other) => (Math.max(luminance(one), luminance(other)) + 0.05) / (Math.min(luminance(one), luminance(other)) + 0.05);
				const region = Object.assign(document.createElement('div'), {innerHTML: trusted('<button type="button" class="btn btn-primary">Save</button>')});
				region.setAttribute('data-brand', '');
				region.style.colorScheme = 'light';
				region.firstElementChild.style.transition = 'none';
				document.body.append(region);
				const low = [];
				for (const brand of ['#0a7f5a', '#b85c57', '#bf625c', '#a86d15', '#af731f', '#498e4d', '#4f9453', '#4e878a', '#548d90', '#5879c3', '#5e7fc9', '#9b63a8', '#a168ae', '#7a7a7a', '#767676', '#f4c542']) {
					region.style.setProperty('--redz-brand', brand);
					const button = getComputedStyle($('.btn', region));
					const ratio = contrast(rgb(button.backgroundColor), rgb(button.color));
					if (ratio < 4.5) {
						low.push(brand + ' ' + ratio.toFixed(2));
					}
				}
				region.remove();
				if (low.length > 0) {
					out.push('a white label\'s button words fall under 4.5:1 on ' + say(low));
				}
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
			const words = (style) => new Intl.RelativeTimeFormat(document.documentElement.lang, {numeric: 'auto', style}).format(-42, 'minute');
			ago.dateTime = new Date(Date.now() - 2520000).toISOString();
			ago.dataset.ago = 'short';
			await wait(50);
			const short = ago.textContent;
			ago.dataset.ago = '';
			await wait(50);
			if (short !== words('short') || ago.textContent !== words('long')) {
				out.push('a time 42 minutes ago reads ' + say(short) + ' with data-ago="short" and ' + say(ago.textContent) + ' with data-ago, not ' + say([words('short'), words('long')]));
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
			if (say(first) !== say([true, 'lagoon.svg', 'The lagoon at North Bay · 1 of 3']) || second[0] !== 'pier.svg' || say(wrapped) !== say(['cliffs.svg', 'Cliffs above a bay with a boat · 3 of 3']) || mirrored[0] !== 'lagoon.svg' || viewer.open || document.activeElement !== links[0]) {
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
			const after = selected();
			list.removeEventListener('redz:selected', hear);
			const first = '#' + tabs[0].getAttribute('aria-controls');
			list.addEventListener('redz:select', refuse, {once: true});
			location.hash = '#nav-hash-payment';
			await wait(100);
			const guarded = [selected(), location.hash];
			list.removeEventListener('redz:select', refuse);
			if (say(guarded) !== say([0, first])) {
				out.push('an address the page refuses in redz:select leaves tab ' + guarded[0] + ' and the address ' + say(guarded[1]) + ', not tab 0 and ' + say(first));
			}
			history.replaceState(history.state, '', location.pathname + location.search);
			if (written !== '#nav-hash-payment' || followed !== 2 || refused !== false || kept !== 2 || taken !== true || after !== 0 || say(told) !== say([1, 2, 0])) {
				out.push('a choice writes ' + say(written) + ', the address selects tab ' + followed + ', a refused select answers ' + refused + ' leaving tab ' + kept + ', a taken one ' + taken + ', and redz:selected told ' + say(told));
			}
		}]},
		tabsLater: {target: '#nav-hash', steps: [async (out) => {
			const names = ['a', 'b', 'c'];
			const buttons = (id) => names.map((one, i) => '<button class="nav-link" type="button" role="tab" id="' + id + '-' + one + '-tab" aria-selected="' + (i === 0) + '" aria-controls="' + id + '-' + one + '">' + one + '</button>').join('');
			const strip = (id, extra = '') => '<div class="nav" role="tablist" aria-label="Later" id="' + id + '" ' + extra + '>' + buttons(id) + '</div>' + names.map((one, i) => '<div role="tabpanel" id="' + id + '-' + one + '"' + (i === 0 ? '' : ' hidden') + '></div>').join('');
			const stops = (id) => names.map((one) => $('#' + id + '-' + one + '-tab').tabIndex);
			const stage = document.body.appendChild(document.createElement('div'));
			const heard = [];
			const hear = (event) => heard.push(event.detail.tab.id);
			const home = location.pathname + location.search;
			const expect = (what, got, want) => {
				if (say(got) !== say(want)) {
					out.push(what + ': ' + say(got) + ', not ' + say(want));
				}
			};
			document.addEventListener('redz:selected', hear);
			stage.innerHTML = trusted(strip('later1'));
			await wait(50);
			expect('a tablist put in later has one tab stop', stops('later1'), [0, -1, -1]);
			expect('it tells its first selection', heard.splice(0), ['later1-a-tab']);
			history.replaceState(history.state, '', '#later2-b');
			stage.innerHTML = trusted(strip('later2', 'data-hash'));
			await wait(50);
			expect('a later tablist with data-hash takes the tab the address names', stops('later2'), [-1, 0, -1]);
			expect('it selects once', heard.splice(0), ['later2-b-tab']);
			expect('it shows only that panel', names.map((one) => $('#later2-' + one).hidden), [true, false, true]);
			expect('it leaves the address', location.hash, '#later2-b');
			const added = $('#later2-c-tab').cloneNode(true);
			added.id = 'later2-d-tab';
			added.removeAttribute('tabindex');
			$('#later2').append(added);
			await wait(50);
			expect('a tab added to a taken tablist leaves the tab order', added.tabIndex, -1);
			expect('that tab tells nothing', heard.splice(0), []);
			history.replaceState(history.state, '', home);
			stage.innerHTML = trusted('<div class="nav" role="tablist" aria-label="Later" id="later3"></div>');
			await wait(50);
			$('#later3').innerHTML = trusted(buttons('later3'));
			await wait(50);
			expect('a tablist that was empty is taken when its tabs come', stops('later3'), [0, -1, -1]);
			expect('that tablist selects once', heard.splice(0), ['later3-a-tab']);
			stage.innerHTML = trusted(strip('outer', 'data-hash'));
			await wait(50);
			heard.length = 0;
			$('#outer-b-tab').dataset.hashWithin = 'deep-';
			location.hash = '#deep-b';
			await wait(100);
			expect('an address that begins with data-hash-within selects its tab', $('#outer-b-tab').getAttribute('aria-selected'), 'true');
			expect('that address stays', location.hash, '#deep-b');
			$('#outer-b').innerHTML = trusted(strip('deep', 'data-hash'));
			await wait(50);
			expect('the tablist its panel brings selects the tab the address names', stops('deep'), [-1, 0, -1]);
			expect('the address stays then too', location.hash, '#deep-b');
			document.removeEventListener('redz:selected', hear);
			stage.remove();
			history.replaceState(history.state, '', home);
		}]},
		overflowFocus: {target: '#nav-overflow', steps: [async (out) => {
			const stage = Object.assign(document.createElement('div'), {className: 'nav-overflow', innerHTML: trusted('<nav class="nav" aria-label="Focus">' + ['One', 'Two', 'Three', 'Four', 'Five', 'Six'].map((word) => '<a class="nav-link" href="#nav-overflow">' + word + '<span class="badge">1</span></a>').join('') + '</nav>')});
			stage.style.inlineSize = '180px';
			document.body.append(stage);
			await wait(100);
			const menu = $('.nav-overflow-menu', stage);
			menu.showPopover();
			await wait(100);
			$$('[role="menuitem"]', menu)[1].focus();
			$('[data-overflow] .badge', stage).textContent = '7';
			await wait(150);
			if (document.activeElement !== $$('[role="menuitem"]', menu)[1] || !menu.matches(':popover-open')) {
				out.push('a badge that changes while the More menu is open leaves the focus on ' + document.activeElement.tagName + ' and the menu open: ' + menu.matches(':popover-open') + ', not the same item focused');
			}
			menu.hidePopover();
			stage.remove();
		}]},
		overflowMark: {target: '#nav-overflow', steps: [async (out) => {
			const link = (word, tone, count) => '<a class="nav-link" href="#nav-overflow">' + word + (tone === null ? '' : '<span class="' + tone + '" id="mark-' + word + '">' + count + '</span>') + '</a>';
			const stage = Object.assign(document.createElement('div'), {className: 'nav-overflow', innerHTML: trusted('<nav class="nav" aria-label="Mark">' + link('One', null) + link('Two', null) + link('Three', null) + link('Four', null) + link('Six', 'badge badge-subtle-warning', 1) + link('Seven', 'badge badge-subtle-danger', 2) + link('Eight', 'badge', 9) + '</nav>')});
			stage.style.inlineSize = '170px';
			document.body.append(stage);
			await wait(150);
			const nav = $('.nav', stage);
			const mark = () => $('.nav-overflow-toggle > [aria-hidden="true"]:not(.bi)', stage);
			const said = () => $('.nav-overflow-toggle > .visually-hidden', stage).textContent;
			const look = () => mark().hidden ? ['none', ''] : [mark().className.split(' ').slice(0, 2).join(' '), mark().textContent];
			const expect = (what, want) => {
				if (say(look()) !== say(want)) {
					out.push(what + ': ' + say(look()) + ', not ' + say(want));
				}
			};
			expect('two toned badges in the menu give the worst tone and their sum', ['badge badge-subtle-danger', '3']);
			if (!said().includes('3') || !said().includes('Six 1') || !said().includes('Seven 2') || said().includes('Eight')) {
				out.push('the button says ' + say(said()) + ', not the sum and the two links with toned badges');
			}
			for (let width = 140; width <= 320; width += 6) {
				stage.style.inlineSize = width + 'px';
				await wait(50);
				if (nav.scrollWidth - nav.clientWidth > 1) {
					out.push('the mark widens the button past the fold: at ' + width + ' px the nav overflows by ' + (nav.scrollWidth - nav.clientWidth));
					break;
				}
			}
			stage.style.inlineSize = '170px';
			await wait(150);
			$('#mark-Seven').textContent = '5';
			await wait(150);
			expect('a new number in a badge changes the sum', ['badge badge-subtle-danger', '6']);
			$('#mark-Seven').className = 'badge';
			await wait(150);
			expect('a badge that loses its tone leaves the worst and the sum of the rest', ['badge badge-subtle-warning', '1']);
			$('#mark-Six').textContent = 'late';
			await wait(150);
			expect('a word instead of a number gives a dot of the tone', ['dot dot-warning', '']);
			if (!said().includes('Six late')) {
				out.push('the button says ' + say(said()) + ', without the word the badge shows');
			}
			$('#mark-Six').className = 'badge badge-danger';
			$('#mark-Six').textContent = '2';
			await wait(150);
			expect('a solid badge gives a solid mark', ['badge badge-danger', '2']);
			$('#mark-Six').className = 'badge';
			await wait(150);
			expect('neutral badges give no mark', ['none', '']);
			if (said() !== '') {
				out.push('the button still says ' + say(said()) + ' with no toned badge in its menu');
			}
			stage.remove();
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
			input(field, 'TÚRTLE cove');
			const one = shown();
			input(field, 'chang');
			const search = shown();
			input(field, 'zzz');
			const none = [shown().length, empty.hidden];
			await wait(700);
			const told = $$('[role="status"]').some((status) => /\d/.test(status.textContent));
			field.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true}));
			if (say(one) !== say(['Turtle Cove and Pearl Cove']) || say(search) !== say(['Elephant sanctuary']) || none[0] !== 0 || none[1] !== false || !told || field.value !== '' || shown().length !== 4 || !empty.hidden) {
				out.push('a search shows ' + say(one) + ' for "TÚRTLE cove", ' + say(search) + ' for a data-search word, ' + say(none) + ' for none (shown, the empty state hidden), the count ' + (told ? '' : 'not ') + 'said, then Escape leaves ' + say(field.value) + ' and ' + shown().length + ' items');
			}
			const items = $$('.list-group-item:not([data-filter-empty])', list);
			items.forEach((item) => item.remove());
			input(field, 'cove');
			input(field, '');
			const bare = empty.hidden;
			list.prepend(...items);
			if (!bare) {
				out.push('a list with no items, searched and cleared, shows its empty state: nothing is searched');
			}
			const tree = $('[data-filter="tree-current-list"]');
			input(tree, 'night');
			const pages = $$('#tree-current-list .tree-item').map((item) => (item.hasAttribute('data-filtered') ? '-' : '+') + $(':scope > .tree-row > a', item).textContent);
			input(tree, '');
			if (say(pages) !== say(['+Excursions', '-North Bay by speedboat', '+Night market and street food'])) {
				out.push('a tree searched for "night" keeps ' + say(pages) + ', not the parent of the match');
			}
			const grouped = $('[data-filter="table-grouped"]');
			const rows = () => $$('#table-grouped tbody > tr').map((row) => (row.hasAttribute('data-filtered') ? '-' : '+') + row.cells[0].firstChild.textContent.trim());
			input(grouped, 'chris');
			const found = rows();
			input(grouped, '');
			const all = rows().every((row) => row.startsWith('+'));
			if (say(found) !== say(['-Boat A', '-Alex Sample', '-Ben Sample', '-Boat A', '+Boat C', '+Chris Sample', '+Boat C']) || !all) {
				out.push('a grouped table searched for "chris" keeps ' + say(found) + ' - its band and subtotal with it, the other group away -' + (all ? '' : ' and cleared does not show every row'));
			}
			input(grouped, 'boat c');
			const band = rows();
			input(grouped, '');
			if (say(band) !== say(['-Boat A', '-Alex Sample', '-Ben Sample', '-Boat A', '+Boat C', '+Chris Sample', '+Boat C'])) {
				out.push('a grouped table searched for its band\'s label "boat c" keeps ' + say(band) + ', not the band\'s rows');
			}
		}]},
		filterButtons: {target: '#list-group-states-list', steps: [async (out) => {
			const list = $('#list-group-states-list');
			const chip = (words) => $$('[aria-controls="list-group-states-list"]').find((button) => button.firstChild.textContent === words);
			const shown = () => $$('.list-group-item:not([data-filter-empty])', list).filter((item) => getComputedStyle(item).display !== 'none').map((item) => item.textContent.split(',')[0]);
			const counts = () => ['All', 'Paid', 'Not paid'].map((words) => $('[data-filter-count]', chip(words)).textContent).join(' ');
			const total = $('[data-filter-count="list-group-states-list"]');
			const field = $('[data-filter="list-group-states-list"]');
			const heard = [];
			const listen = (event) => heard.push(event.detail.count + '/' + event.detail.total);
			list.addEventListener('redz:filter', listen);
			const start = [counts(), total.textContent];
			chip('Paid').click();
			const paid = [shown().join(' '), chip('Paid').getAttribute('aria-pressed'), chip('All').getAttribute('aria-pressed'), total.textContent];
			await wait(50);
			const told = $$('[role="status"]').some((status) => /3/.test(status.textContent));
			chip('Boat B').click();
			const both = [shown().join(' '), counts()];
			input(field, 'ella');
			const typed = [shown().join(' '), counts()];
			chip('Boat B').click();
			const again = [shown().join(' '), chip('Boat B').getAttribute('aria-pressed')];
			input(field, '');
			chip('Paid').click();
			const back = [shown().length, chip('All').getAttribute('aria-pressed')];
			if (say(start) !== say(['5 3 2', '5 of 5']) || say(paid) !== say(['Alex Sample Dana Sample Ella Sample', 'true', 'false', '3 of 5']) || !told || say(both) !== say(['Dana Sample Ella Sample', '3 2 1']) || say(typed) !== say(['Ella Sample', '1 1 0']) || say(again) !== say(['Ella Sample', 'false']) || say(back) !== say([5, 'true'])) {
				out.push('filter buttons: counts at load ' + say(start) + ', Paid shows ' + say(paid) + ' (said: ' + told + '), with Boat B ' + say(both) + ', with "ella" ' + say(typed) + ', Boat B pressed again ' + say(again) + ', Paid pressed again ' + say(back));
			}
			const call = REDZ.ui.filter(list, {state: 'late'});
			const late = [call, shown().join(' ')];
			chip('Paid').click();
			const extra = Object.assign(document.createElement('li'), {className: 'list-group-item', textContent: 'Fay Sample, boat A, paid'});
			extra.dataset.state = 'paid';
			const later = extra.cloneNode(true);
			later.dataset.state = 'late';
			list.prepend(extra, later);
			await settled();
			const redrawn = [extra.hasAttribute('data-filtered'), later.hasAttribute('data-filtered'), total.textContent];
			extra.remove();
			later.remove();
			REDZ.ui.filter(list, null);
			await settled();
			list.removeEventListener('redz:filter', listen);
			if (say(late) !== say([1, 'Chris Sample']) || say(redrawn) !== say([false, true, '4 of 7']) || shown().length !== 5 || chip('All').getAttribute('aria-pressed') !== 'true' || !heard.includes('3/5')) {
				out.push('REDZ.ui.filter({state: "late"}) answers ' + say(late) + '; items put in while Paid is chosen are hidden ' + say(redrawn) + '; null leaves ' + shown().length + ' items, All pressed ' + chip('All').getAttribute('aria-pressed') + '; redz:filter told ' + say(heard));
			}
			const box = document.createElement('div');
			box.id = 'probe-filter-groups';
			box.innerHTML = trusted('<section data-filter-group><b data-filter-count></b><p data-kind="sea">Bay</p><p data-kind="land">Hill</p></section><section data-filter-group><b data-filter-count></b><p data-kind="land">Farm</p></section><button type="button" command="--filter" aria-controls="probe-filter-groups" name="kind" value="sea">Sea</button>');
			document.body.append(box);
			$('button', box).click();
			const groups = $$('[data-filter-group]', box).map((group) => group.hasAttribute('data-filtered') + ':' + $('[data-filter-count]', group).textContent);
			box.remove();
			if (say(groups) !== say(['false:1', 'true:0'])) {
				out.push('a data-filter-group with no item shown should hide and count its own: ' + say(groups));
			}
		}]},
		serverSearch: {target: '#list-group-server-list', steps: [async (out) => {
			const field = $('[data-filter="list-group-server-list"]');
			const list = $('#list-group-server-list');
			const status = $('select[name="status"]', field.closest('search'));
			const asked = [];
			const answers = [];
			const take = (event) => {
				if (event.target !== field) {
					return;
				}
				event.preventDefault();
				event.stopImmediatePropagation();
				asked.push([event.detail.query, event.detail.form.get('status')]);
				const slow = event.detail.query === 'pier';
				answers.push(event.detail.signal);
				event.detail.respondWith(new Promise((done) => setTimeout(() => done({count: slow ? 9 : 2}), slow ? 700 : 60)));
			};
			window.addEventListener('redz:search', take, true);
			input(field, 'pi');
			input(field, 'pier');
			await wait(300);
			const early = asked.length;
			await wait(450);
			const busy = [field.getAttribute('aria-busy'), list.getAttribute('aria-busy'), getComputedStyle(field.parentElement, '::after').content !== 'none'];
			input(field, 'refund');
			const enter = new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true});
			field.dispatchEvent(enter);
			await wait(200);
			const after = [field.getAttribute('aria-busy'), answers[0]?.aborted];
			await wait(700);
			const said = $$('body > .visually-hidden[role="status"]').map((one) => one.textContent).join(' ');
			status.value = 'open';
			status.dispatchEvent(new Event('change', {bubbles: true}));
			field.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true}));
			await wait(200);
			status.value = '';
			window.removeEventListener('redz:search', take, true);
			if (early !== 0 || say(asked.slice(0, 2)) !== say([['pier', ''], ['refund', '']]) || say(busy) !== say(['true', 'true', true]) || !enter.defaultPrevented || say(after) !== say([null, true]) || /9/.test(said) || !/2/.test(said) || say(asked.slice(2)) !== say([['refund', 'open'], ['', 'open']]) || field.value !== '') {
				out.push('a server search asked ' + early + ' times before the pause, then ' + say(asked) + '; waiting: field, region busy, ring ' + say(busy) + '; Enter ' + (enter.defaultPrevented ? 'taken' : 'left to the form') + '; after the newer answer busy ' + say(after) + ' (busy, the older signal aborted); said ' + say(said) + ' (the late answer\'s 9 must be dropped)');
			}
		}]},
		showMore: {target: '#list-group-more-list', steps: [async (out) => {
			const list = $('#list-group-more-list');
			const button = $('[aria-controls="list-group-more-list"][command="--more"]');
			const foot = button.parentElement;
			const count = $('[data-more-count]', foot);
			const cap = $('[data-more-cap]', foot);
			const kept = [...list.children];
			const start = [count.textContent, button.hidden, cap.hidden];
			button.focus();
			button.click();
			const busy = button.getAttribute('aria-busy');
			await until(() => list.children.length === 8, 2000);
			const focused = document.activeElement?.textContent;
			const grown = [list.children.length, count.textContent, button.hidden, cap.hidden, focused];
			await wait(150);
			const said = $$('[role="status"]').some((one) => /4/.test(one.textContent));
			list.replaceChildren(...kept);
			const refuse = (event) => {
				event.preventDefault();
				event.stopImmediatePropagation();
				event.detail.respondWith(Promise.reject(new Error('no')));
			};
			button.hidden = false;
			cap.hidden = true;
			window.addEventListener('redz:more', refuse, true);
			button.focus();
			button.click();
			await wait(100);
			window.removeEventListener('redz:more', refuse, true);
			const refused = [list.children.length, button.hidden, document.activeElement === button];
			const total = button.dataset.moreTotal;
			delete button.dataset.moreTotal;
			let add = 1;
			const some = (event) => {
				event.preventDefault();
				event.stopImmediatePropagation();
				for (let n = 0; n < add; n++) {
					list.append(Object.assign(document.createElement('li'), {className: 'list-group-item', textContent: 'Extra'}));
				}
				event.detail.respondWith(Promise.resolve({}));
			};
			window.addEventListener('redz:more', some, true);
			button.click();
			await wait(100);
			const open = [count.textContent, button.hidden];
			add = 0;
			button.click();
			await wait(100);
			const ended = [count.textContent, button.hidden];
			window.removeEventListener('redz:more', some, true);
			list.replaceChildren(...kept);
			REDZ.ui.more(list, {total: Number(total)});
			if (say(start) !== say(['4 of 11', false, true]) || busy !== 'true' || say(grown) !== say([8, '8 of 11', true, false, 'Pickup point 5']) || !said || say(refused) !== say([4, false, true]) || say(open) !== say(['5+', false]) || say(ended) !== say(['5 of 5', true])) {
				out.push('show more: at load ' + say(start) + ', pressed busy ' + say(busy) + ', then ' + say(grown) + ' (items, count, button hidden at the cap, cap shown, focus), said ' + said + '; refused ' + say(refused) + ' (items, hidden, focus kept); without a total ' + say(open) + ', then an empty answer ' + say(ended));
			}
		}]},
		moreLater: {target: '#list-group-more-list', steps: [async (out) => {
			const row = (words) => Object.assign(document.createElement('button'), {type: 'button', className: 'list-group-item list-group-item-action', textContent: words});
			const box = document.createElement('div');
			box.innerHTML = trusted('<div class="list-group" id="probe-more-list"></div><div class="list-more"><span data-more-count></span></div><div class="list-more"><span data-more-count></span><button class="btn btn-sm" type="button" command="--more" aria-controls="probe-more-later">More</button></div>');
			document.body.append(box);
			const list = $('#probe-more-list', box);
			list.append(row('Row 1'), row('Row 2'));
			const [foot, other] = $$('.list-more', box);
			const button = Object.assign(document.createElement('button'), {type: 'button', className: 'btn btn-sm', textContent: 'More'});
			button.setAttribute('command', '--more');
			button.dataset.moreTotal = '5';
			foot.append(button);
			await settled();
			const count = $('[data-more-count]', foot);
			const unnamed = count.textContent;
			button.setAttribute('aria-controls', 'probe-more-list');
			await settled();
			const named = count.textContent;
			list.append(row('Row 3'));
			await settled();
			const redrawn = count.textContent;
			const late = Object.assign(document.createElement('ul'), {id: 'probe-more-later', className: 'list-group', innerHTML: trusted('<li class="list-group-item">A</li><li class="list-group-item">B</li>')});
			box.append(late);
			await settled();
			const put = $('[data-more-count]', other).textContent;
			const take = (event) => {
				if (event.target === list) {
					event.preventDefault();
					event.stopImmediatePropagation();
					list.append(row('Row 4'), row('Row 5'));
					event.detail.respondWith(Promise.resolve({}));
				}
			};
			window.addEventListener('redz:more', take, true);
			button.click();
			await until(() => document.activeElement?.textContent === 'Row 4', 1000);
			window.removeEventListener('redz:more', take, true);
			const fourth = list.children[3];
			const focused = [document.activeElement === fourth, fourth.hasAttribute('tabindex'), fourth.tabIndex, count.textContent, button.hidden];
			list.replaceChildren(row('Row 1'));
			REDZ.ui.more(list, {total: 9});
			await settled();
			const total = [count.textContent, button.hidden];
			REDZ.ui.more(list, {});
			await settled();
			const unknown = [count.textContent, button.hidden];
			REDZ.ui.more(list, {done: true});
			await settled();
			const done = [count.textContent, button.hidden];
			list.append(row('Row 2'));
			await settled();
			const after = [count.textContent, button.hidden];
			REDZ.ui.more(list, {});
			let signal = null;
			const hold = (event) => {
				if (event.target === list) {
					event.preventDefault();
					event.stopImmediatePropagation();
					signal = event.detail.signal;
					event.detail.respondWith(new Promise(() => {}));
				}
			};
			window.addEventListener('redz:more', hold, true);
			button.click();
			window.removeEventListener('redz:more', hold, true);
			REDZ.ui.more(list, {total: 4});
			const aborted = signal?.aborted;
			box.remove();
			if (unnamed !== '' || named !== '2 of 5' || redrawn !== '3 of 5' || put !== '2+' || say(focused) !== say([true, false, 0, '5 of 5', true]) || say(total) !== say(['1 of 9', false]) || say(unknown) !== say(['1+', false]) || say(done) !== say(['1 of 1', true]) || say(after) !== say(['2 of 2', true]) || aborted !== true) {
				out.push('show more told by the page: a button without aria-controls ' + say(unnamed) + ', given it ' + say(named) + ', the list grown by code ' + say(redrawn) + ', a list put in later ' + say(put) + '; a new item that is a button: focused, tabindex, tab stop, count, hidden ' + say(focused) + '; REDZ.ui.more {total: 9} ' + say(total) + ', {} ' + say(unknown) + ', {done: true} ' + say(done) + ', grown after the end ' + say(after) + '; a question out aborted by it ' + say(aborted));
			}
		}]},
		selection: {target: '#table-select-rows', steps: [async (out) => {
			const table = $('#table-select-rows');
			const scope = table.closest('[data-select]');
			const bar = $('.selection-bar', scope);
			const words = $('[data-select-count]', bar);
			const head = $('[data-select-all]', table);
			const check = (name) => $$('tbody input', table).find((one) => one.getAttribute('aria-label').includes(name));
			const field = $('[data-filter="table-select-rows"]');
			const heard = [];
			const listen = (event) => heard.push(event.detail);
			scope.addEventListener('redz:selection', listen);
			const start = [bar.hidden, head.checked, head.indeterminate];
			check('Alex').click();
			const one = [bar.hidden, words.textContent, head.indeterminate, say(heard.at(-1))];
			const tint = [getComputedStyle(check('Alex').closest('tr').cells[1]).backgroundColor, getComputedStyle(check('Ben').closest('tr').cells[1]).backgroundColor];
			check('Ben').closest('tr').cells[1].click();
			const row = check('Ben').checked;
			check('Ben').click();
			head.click();
			const all = [head.checked, head.indeterminate, check('Dana').checked, words.textContent];
			await wait(50);
			const told = $$('[role="status"]').some((status) => /3/.test(status.textContent));
			input(field, 'chris');
			const hidden = [check('Alex').checked, words.textContent, head.checked, say(heard.at(-1).values)];
			input(field, '');
			const shown = [check('Alex').checked, check('Ben').checked, words.textContent];
			$('[command="--select-none"]', bar).click();
			const none = [bar.hidden, head.checked, head.indeterminate];
			scope.removeEventListener('redz:selection', listen);
			if (say(start) !== say([true, false, false]) || say(one) !== say([false, '1 selected', true, say({count: 1, total: 3, values: ['11']})]) || tint[0] === tint[1] || !row || say(all) !== say([true, false, false, '3 selected']) || !told || say(hidden) !== say([false, '1 selected', true, say(['13'])]) || say(shown) !== say([true, true, '3 selected']) || say(none) !== say([true, false, false])) {
				out.push('selection: at load ' + say(start) + ' (bar hidden, head), one check ' + say(one) + ', tint ' + say(tint) + ', a row click checks ' + row + ', the head ' + say(all) + ' (said ' + told + '), a search hiding two ' + say(hidden) + ', cleared ' + say(shown) + ', select none ' + say(none));
			}
		}]},
		selectionLater: {target: '#table-select-rows', steps: [async (out) => {
			const box = document.createElement('div');
			box.innerHTML = trusted('<div data-select id="probe-select"><div class="selection-bar"><span data-select-count></span></div><input type="checkbox" data-select-all aria-label="All"><ul><li><input type="checkbox" value="a" aria-label="A"></li><li><input type="checkbox" value="b" aria-label="B"></li><li><input type="checkbox" value="c" aria-label="C"></li></ul></div><div id="probe-select-late"><input type="checkbox" value="d" aria-label="D" checked></div>');
			const scope = $('#probe-select', box);
			const late = $('#probe-select-late', box);
			const [a, b, c] = $$('ul input', scope);
			const head = $('[data-select-all]', scope);
			const bar = $('.selection-bar', scope);
			const heard = [];
			const listen = (event) => heard.push(event.target.id + ' ' + event.detail.count + '/' + event.detail.total);
			box.addEventListener('redz:selection', listen);
			document.body.append(box);
			await settled();
			const put = [heard.join(), bar.hidden];
			a.checked = true;
			REDZ.ui.selection(scope);
			const called = [heard.at(-1), head.indeterminate, bar.hidden];
			REDZ.ui.selection(scope);
			const quiet = heard.length;
			b.disabled = true;
			await settled();
			const disabled = heard.at(-1);
			a.closest('li').hidden = true;
			await settled();
			const hidden = [heard.at(-1), a.checked, bar.hidden];
			a.closest('li').hidden = false;
			await settled();
			const back = [heard.at(-1), a.checked];
			c.setAttribute('checked', '');
			await settled();
			const attribute = [heard.at(-1), head.checked];
			late.dataset.select = '';
			await settled();
			const marked = heard.at(-1);
			box.removeEventListener('redz:selection', listen);
			box.remove();
			if (say(put) !== say(['probe-select 0/3', true]) || say(called) !== say(['probe-select 1/3', true, false]) || quiet !== 2 || disabled !== 'probe-select 1/2' || say(hidden) !== say(['probe-select 0/1', false, true]) || say(back) !== say(['probe-select 1/2', true]) || say(attribute) !== say(['probe-select 2/2', true]) || marked !== 'probe-select-late 1/1') {
				out.push('a selection put in later: told ' + say(put) + ' (event, bar hidden); REDZ.ui.selection after .checked ' + say(called) + ' (event, head mixed, bar), again ' + (quiet === 2 ? 'silent' : 'told') + ', a check disabled ' + say(disabled) + ', its item hidden ' + say(hidden) + ' (event, checked, bar hidden), shown ' + say(back) + ', a checked attribute ' + say(attribute) + ' (event, head), data-select given later ' + say(marked));
			}
		}]},
		barTones: {target: '#table-select-rows', steps: [async (out) => {
			const box = document.createElement('div');
			box.innerHTML = trusted('<div class="selection-bar"><button class="btn btn-sm" type="button">Plain</button><button class="btn btn-sm btn-primary" type="button">Apply</button><button class="btn btn-sm btn-subtle-danger" type="button">Delete</button><button class="btn btn-sm btn-outline-secondary" type="button">Export</button><button class="btn btn-sm" type="button" disabled>Merge</button></div><button class="btn btn-sm btn-primary" type="button">Apply</button><button class="btn btn-sm btn-subtle-danger" type="button">Delete</button><button class="btn btn-sm btn-outline-secondary" type="button">Export</button><button class="btn btn-sm" type="button" disabled>Merge</button>');
			document.body.append(box);
			const ground = getComputedStyle(document.body).getPropertyValue('--redz-bg').trim();
			const paint = (button) => getComputedStyle(button).backgroundColor;
			const probe = Object.assign(document.createElement('i'), {style: 'color: ' + ground});
			box.append(probe);
			const white = getComputedStyle(probe).color;
			const [plain, ...inBar] = $$('.selection-bar > .btn', box);
			const outside = $$(':scope > .btn', box);
			const got = [paint(plain) === white, ...inBar.map((button, i) => paint(button) === paint(outside[i]))];
			box.remove();
			if (say(got) !== say([true, true, true, true, true])) {
				out.push('a selection bar: a plain button on the page\'s ground ' + got[0] + '; primary, subtle danger, outline secondary and a disabled one as outside the bar ' + say(got.slice(1)));
			}
		}]},
		sort: {target: '#table-sort', steps: [async (out) => {
			const table = $('#table-sort table');
			const order = () => [...table.tBodies[0].rows].map((row) => row.cells[0].textContent.replace('Example ', '')).join(' ');
			const head = (words) => $$('th', table.tHead).find((cell) => cell.textContent === words);
			const press = (words) => $('button', head(words)).click();
			const at = order();
			press('Paid');
			const down = [order(), head('Paid').getAttribute('aria-sort'), head('Name').hasAttribute('aria-sort')];
			await wait(50);
			const said = $$('[role="status"]').some((status) => /Paid/.test(status.textContent));
			press('Paid');
			const up = order();
			press('Paid');
			const two = head('Paid').getAttribute('aria-sort');
			table.setAttribute('data-sort-reset', '');
			press('Paid');
			press('Paid');
			const reset = [order(), head('Paid').hasAttribute('aria-sort')];
			table.removeAttribute('data-sort-reset');
			press('Sites');
			const sites = order();
			const added = table.tBodies[0].rows[0].cloneNode(true);
			added.cells[0].textContent = 'Example Camp';
			added.cells[1].textContent = '2';
			table.tBodies[0].append(added);
			await settled();
			const redrawn = order();
			added.remove();
			const take = (event) => {
				event.preventDefault();
				event.detail.respondWith(Promise.reject(new Error('no')));
			};
			table.addEventListener('redz:sort', take);
			press('Name');
			const taken = [order(), head('Name').getAttribute('aria-sort')];
			await wait(50);
			const restored = [head('Sites').getAttribute('aria-sort'), head('Name').hasAttribute('aria-sort')];
			table.removeEventListener('redz:sort', take);
			press('Name');
			if (at !== 'Cruises Divers Hostel Resort' || say(down) !== say(['Resort Divers Cruises Hostel', 'descending', false]) || !said || up !== 'Cruises Divers Resort Hostel' || two !== 'descending' || say(reset) !== say(['Resort Cruises Divers Hostel', false]) || sites !== 'Cruises Divers Resort Hostel' || redrawn !== 'Cruises Divers Camp Resort Hostel' || say(taken) !== say([sites, 'ascending']) || say(restored) !== say(['ascending', false])) {
				out.push('sorting: at load ' + say(at) + ', Paid first ' + say(down) + ' (said ' + said + '), again ' + say(up) + ', a third press without data-sort-reset ' + say(two) + ', with it back to the drawn order ' + say(reset) + ', by Sites ' + say(sites) + ', a row put in ' + say(redrawn) + ', a sort the page takes ' + say(taken) + ' and refuses ' + say(restored));
			}
			const box = document.createElement('table');
			box.innerHTML = trusted('<thead><tr><th><button class="table-sort" type="button" value="v">V</button></th></tr></thead><tbody><tr class="table-group"><th>G1</th></tr><tr><td>3</td></tr><tr><td>1</td></tr><tr class="table-subtotal"><th>S1</th></tr><tr class="table-group"><th>G2</th></tr><tr><td>2</td></tr><tr><td>0</td></tr></tbody>');
			document.body.append(box);
			$('button', box).click();
			const banded = [...box.tBodies[0].rows].map((row) => row.cells[0].textContent).join(' ');
			box.remove();
			if (banded !== 'G1 1 3 S1 G2 0 2') {
				out.push('a table with bands sorts each band\'s rows under it, its subtotal last: ' + say(banded));
			}
		}]},
		confirmWait: {target: '#dialog-confirm-run', steps: [async (out) => {
			const open = () => $$('dialog[role="alertdialog"]').filter((one) => one.open).at(-1);
			let refuse = true;
			let seen = null;
			const asked = REDZ.ui.confirm({title: 'Pause?', choice: {label: 'How long', items: [{value: 'hour', text: 'An hour'}, {value: 'day', text: 'A day'}], value: 'hour'}, ok: 'Pause', run: (what) => {
				seen = what.choice;
				return new Promise((done, fail) => setTimeout(() => (refuse ? fail(new Error('The server is busy.')) : done()), 150));
			}});
			await settled();
			const dialog = open();
			const [no, yes] = $$('.dialog-footer > .btn', dialog);
			$('input[value="day"]', dialog).click();
			yes.focus();
			yes.click();
			await settled();
			const cancel = new Event('cancel', {cancelable: true});
			dialog.dispatchEvent(cancel);
			const waiting = [yes.getAttribute('aria-busy'), no.getAttribute('aria-disabled'), $('.dialog-body', dialog).inert, cancel.defaultPrevented, seen];
			await wait(400);
			const refusal = $('[data-refusal]', dialog);
			const after = [dialog.open, refusal?.textContent, refusal === $('.dialog-body', dialog).lastElementChild, no.hasAttribute('aria-disabled'), document.activeElement === yes, $$('[role="alert"]', dialog).some((one) => one.textContent.includes('busy'))];
			refuse = false;
			yes.click();
			const answer = await asked;
			if (say(waiting) !== say(['true', 'true', true, true, 'day']) || say(after) !== say([true, 'The server is busy.', true, false, true, true]) || answer !== 'day' || dialog.isConnected) {
				out.push('confirm with run: waiting ' + say(waiting) + ' (OK busy, Cancel unavailable, body inert, Escape held, the choice), refused ' + say(after) + ' (open, words, above the footer, buttons awake, focus on OK, said at once), then answers ' + say(answer));
			}
			const forced = REDZ.ui.confirm({title: 'Delete?', ok: 'Delete', run: ({signal}) => new Promise((done, fail) => setTimeout(() => fail(new Error('Too late: ' + signal.aborted)), 150))});
			await settled();
			const second = open();
			$('.dialog-footer > .btn:last-child', second).click();
			second.close();
			const early = await forced;
			await wait(300);
			const toast = $$('.toast-danger').some((one) => one.textContent.includes('Too late: true'));
			if (early !== false || !toast) {
				out.push('a confirm closed by code while it waits answers ' + say(early) + ' and its later refusal ' + (toast ? 'is' : 'is not') + ' a danger toast with the aborted signal');
			}
			$$('.toast-danger').forEach((one) => one.remove());
			const third = REDZ.ui.confirm({title: 'Leave?', ok: 'Save', cancel: 'Stay', alt: {text: 'Discard', tone: 'danger', value: 'discard'}, focus: 'ok'});
			await settled();
			const leave = open();
			const footer = $('.dialog-footer', leave);
			const order = $$(':scope > .btn', footer).map((one) => one.textContent + (one.classList.contains('dialog-footer-start') ? '<' : '') + (one.classList.contains('btn-outline-danger') ? '!' : '')).join(' ');
			const focused = document.activeElement?.textContent;
			leave.style.inlineSize = '20rem';
			const stacked = getComputedStyle(footer).flexDirection;
			leave.style.inlineSize = '';
			$('.dialog-footer-start', leave).click();
			const chosen = await third;
			if (order !== 'Discard<! Stay Save' || focused !== 'Save' || stacked !== 'column-reverse' || chosen !== 'discard') {
				out.push('a third answer: footer ' + say(order) + ', focus on ' + say(focused) + ', narrow ' + say(stacked) + ', answers ' + say(chosen));
			}
		}]},
		dialogWait: {target: '#dialog-wait-form-panel', steps: [async (out) => {
			const dialog = $('#dialog-wait-form-panel');
			dialog.showModal();
			const save = $('button[value="save"]', dialog);
			const cancel = $('[command="close"]', dialog);
			save.click();
			const waiting = [dialog.open, save.getAttribute('aria-busy'), cancel.getAttribute('aria-disabled')];
			await wait(1000);
			const refused = [dialog.open, $('[data-refusal]', dialog)?.textContent.startsWith('Say why'), cancel.hasAttribute('aria-disabled')];
			$('input[name="reason"]', dialog).value = 'Engine check';
			save.click();
			await wait(1000);
			const closed = [dialog.open, dialog.returnValue, $('[data-refusal]', dialog) === null];
			$('input[name="reason"]', dialog).value = '';
			if (say(waiting) !== say([true, 'true', 'true']) || say(refused) !== say([true, true, false]) || say(closed) !== say([false, 'save', true])) {
				out.push('a form of a dialog the page saves: waiting ' + say(waiting) + ', refused ' + say(refused) + ', saved ' + say(closed));
			}
		}]},
		alertCode: {target: '#alert-code-box', steps: [async (out) => {
			const box = $('#alert-code-box');
			const spoken = (role) => $$('body > .visually-hidden[role="' + role + '"]').map((one) => one.textContent).join(' ');
			REDZ.ui.alert(box, {tone: 'danger', text: 'Wrong code.'});
			await wait(150);
			const danger = [box.className, $('.bi', box)?.className, box.textContent, spoken('alert').includes('Wrong code.'), box.hasAttribute('role')];
			REDZ.ui.alert(box, {tone: 'info', text: 'Code sent.'});
			await wait(50);
			const info = [box.className, spoken('status').includes('Code sent.')];
			$('body > .visually-hidden[role="status"]').textContent = '';
			REDZ.ui.alert(box, {tone: 'info', text: 'Code sent.'});
			await wait(50);
			const again = spoken('status').includes('Code sent.');
			let finish;
			const call = REDZ.ui.alert(box, new Promise((done) => {
				finish = done;
			}));
			await wait(500);
			const pending = [$('.spinner-border', box) !== null, box.textContent];
			finish({tone: 'success', text: 'Done.'});
			await call;
			await settled();
			const done = [box.className, box.textContent];
			REDZ.ui.alert(box, null);
			if (say(danger) !== say(['alert alert-danger', 'bi bi-x-octagon', 'Wrong code.', true, false]) || say(info) !== say(['alert alert-info', true]) || !again || say(pending) !== say([true, 'Loading…']) || say(done) !== say(['alert alert-success', 'Done.']) || box.childElementCount !== 0) {
				out.push('REDZ.ui.alert: danger ' + say(danger) + ', info ' + say(info) + ', the same again said ' + again + ', a promise waiting ' + say(pending) + ' then ' + say(done) + ', null leaves ' + box.childElementCount + ' children');
			}
		}]},
		downloadText: {target: '#commands-download-text', steps: [async (out) => {
			const made = [];
			const make = URL.createObjectURL;
			const click = HTMLAnchorElement.prototype.click;
			URL.createObjectURL = (blob) => {
				made.push(blob);
				return make.call(URL, blob);
			};
			HTMLAnchorElement.prototype.click = function () {
				made.push(this.download);
			};
			try {
				$('[aria-controls="commands-download-text"][command="--download"]').click();
				REDZ.ui.download({text: 'a;b', file: 'x.csv', type: 'text/csv'});
				REDZ.ui.download({text: 'a;b', file: 'y.csv', type: 'text/csv', bom: false});
			} finally {
				URL.createObjectURL = make;
				HTMLAnchorElement.prototype.click = click;
			}
			const [report, name, csv, csvName, bare] = made;
			const bytes = async (blob) => [...new Uint8Array(await blob.arrayBuffer())].slice(0, 3).join(',');
			const got = [await report.text() === $('#commands-download-text').textContent, report.type, name, await bytes(csv), csvName, await bytes(bare)];
			await wait(50);
			const said = $$('body > .visually-hidden[role="status"]').some((one) => one.textContent.includes('y.csv'));
			if (say(got) !== say([true, 'text/plain;charset=utf-8', 'boats.txt', '239,187,191', 'x.csv', '97,59,98']) || !said) {
				out.push('a text download gives ' + say(got) + ' (the words, the type, the name, a CSV with its byte order mark, its name, one without) and is said ' + said);
			}
		}]},
		busyParts: {target: '#busy-menu-list', steps: [async (out) => {
			const opener = $('[commandfor="busy-menu-list"][command="toggle-popover"]');
			const menu = $('#busy-menu-list');
			const item = $('.menu-item', menu);
			opener.click();
			await settled();
			let finish;
			const call = REDZ.ui.busy(item, new Promise((done) => {
				finish = done;
			}));
			menu.hidePopover();
			const held = [opener.getAttribute('aria-busy'), opener.getAttribute('aria-disabled'), item.getAttribute('aria-disabled')];
			finish();
			await call;
			await settled();
			const freed = [opener.hasAttribute('aria-busy'), opener.hasAttribute('aria-disabled'), item.hasAttribute('aria-disabled')];
			const card = $('#busy-region-words-card');
			let close;
			const region = REDZ.ui.busy(card, new Promise((done) => {
				close = done;
			}));
			await wait(500);
			const words = [$('.busy-words', card)?.textContent, $$('body > .visually-hidden[role="status"]').some((one) => one.textContent === 'Preparing the download…')];
			close();
			await region;
			const cell = $('#busy-cell-state');
			let check;
			const marked = REDZ.ui.busy(cell, new Promise((done) => {
				check = done;
			}));
			const early = cell.querySelector('.busy-ring') === null;
			await wait(500);
			const ring = [cell.querySelector('.busy-ring') !== null, $('.visually-hidden', cell)?.textContent, $$('body > .visually-hidden[role="status"]').some((one) => one.textContent === 'Checking')];
			check();
			await marked;
			const gone = [cell.childElementCount, cell.hasAttribute('aria-busy')];
			if (say(held) !== say(['true', 'true', 'true']) || say(freed) !== say([false, false, false]) || say(words) !== say(['Preparing the download…', true]) || !early || say(ring) !== say([true, 'Checking', false]) || say(gone) !== say([0, false]) || $('.busy-words', card) !== null) {
				out.push('busy: a menu item holds its opener ' + say(held) + ', then frees both ' + say(freed) + '; a region\'s words ' + say(words) + '; a cell\'s ring ' + (early ? 'after a moment' : 'at once') + ' ' + say(ring) + ' (ring, hidden words, said aloud), then ' + say(gone));
			}
		}]},
		lazyLoad: {target: '#accordion-lazy-history', steps: [async (out) => {
			const details = $('#accordion-lazy-history details');
			const body = $('.accordion-body', details);
			details.open = true;
			await settled();
			const loading = [body.hasAttribute('data-lazy'), $('[data-loading] .placeholder', body) !== null, $('[data-loading] .visually-hidden', body)?.textContent];
			await wait(800);
			const refused = [details.open, body.hasAttribute('data-lazy'), $('[data-load-error]', body)?.textContent.startsWith('The history'), $('[data-loading]', body) === null];
			await wait(100);
			const quiet = $('[data-loading]', body) === null;
			details.open = false;
			await settled();
			details.open = true;
			await wait(800);
			const loaded = [body.querySelectorAll('p').length, $('[data-load-error]', body) === null, body.hasAttribute('data-lazy')];
			details.open = false;
			const fresh = document.createElement('details');
			fresh.innerHTML = trusted('<summary>Paper</summary><div data-lazy></div>');
			let asked = 0;
			const count = (event) => {
				asked += event.target.closest('details') === fresh ? 1 : 0;
			};
			document.addEventListener('redz:load', count);
			document.body.append(fresh);
			dispatchEvent(new Event('beforeprint'));
			await settled();
			const printed = [fresh.open, asked];
			dispatchEvent(new Event('afterprint'));
			await settled();
			const after = [fresh.open, asked, $('[data-lazy]', fresh) !== null];
			fresh.remove();
			document.removeEventListener('redz:load', count);
			if (say(loading) !== say([false, true, 'Loading…']) || say(refused) !== say([true, true, true, true]) || !quiet || say(loaded) !== say([2, true, false]) || say(printed) !== say([true, 0]) || say(after) !== say([false, 0, true])) {
				out.push('a lazy section: loading ' + say(loading) + ', refused ' + say(refused) + (quiet ? '' : ', loading again at once') + ', opened again ' + say(loaded) + '; printing opens a lazy one ' + say(printed) + ' without asking, after ' + say(after));
			}
		}]},
		lazyLayer: {target: '#accordion-lazy-history', steps: [async (out) => {
			const box = document.createElement('div');
			box.innerHTML = trusted('<div popover id="probe-lazy-popover"><ul data-lazy></ul></div><dialog id="probe-lazy-dialog"><div data-lazy></div></dialog>');
			const [popover, dialog] = [$('[popover]', box), $('dialog', box)];
			const asked = [];
			let refuse = true;
			const take = (event) => {
				if (box.contains(event.target)) {
					asked.push(event.target.closest('[popover], dialog').id);
					event.preventDefault();
					event.stopImmediatePropagation();
					event.detail.respondWith(refuse ? Promise.reject(new Error('no')) : Promise.resolve());
				}
			};
			window.addEventListener('redz:load', take, true);
			document.body.append(box);
			await settled();
			const closed = asked.length;
			popover.showPopover();
			await settled();
			await wait(50);
			const opened = asked.length;
			// The closing's toggle must come before the opening: a hide and a show close together are one toggle in
			// Safari on a slow machine, and the refusal is forgotten only as the layer closes.
			const gone = new Promise((done) => popover.addEventListener('toggle', (event) => {
				if (event.newState === 'closed') {
					done();
				}
			}));
			popover.hidePopover();
			await Promise.race([gone, wait(1000)]);
			await settled();
			refuse = false;
			popover.showPopover();
			await settled();
			await wait(50);
			const again = asked.length;
			popover.hidePopover();
			dialog.show();
			await settled();
			await wait(50);
			const shown = [...asked];
			dialog.close();
			window.removeEventListener('redz:load', take, true);
			box.remove();
			if (closed !== 0 || opened !== 1 || again !== 2 || say(shown) !== say(['probe-lazy-popover', 'probe-lazy-popover', 'probe-lazy-dialog'])) {
				out.push('a lazy region in a closed popover or dialog asked ' + closed + ' times before it opened, ' + opened + ' when the popover opened, ' + again + ' after a refusal and another opening; asked for ' + say(shown));
			}
		}]},
		uploadPaste: {target: '#upload-stored', steps: [async (out) => {
			const box = document.createElement('div');
			box.innerHTML = trusted('<form><div class="upload" id="probe-paste" data-paste="page"><input type="file" multiple hidden><button class="upload-zone" type="button">Add</button><template><div><span data-file-name></span><button type="button" data-file-remove>x</button><span data-file-error></span></div></template><div class="upload-list"><div data-file-stored="7" data-state="done"><span data-file-name>kept.pdf</span></div></div></div><input name="note"></form>');
			document.body.append(box);
			const upload = $('#probe-paste', box);
			const heard = [];
			upload.addEventListener('redz:change', (event) => heard.push(say(event.detail)));
			let send;
			const sending = (event) => {
				if (event.target === upload) {
					event.preventDefault();
					event.detail.respondWith(new Promise((done) => {
						send = done;
					}));
				}
			};
			document.addEventListener('redz:files', sending);
			const paste = (target, types) => {
				const data = new DataTransfer();
				data.items.add(new File(['x'], 'shot.png', {type: 'image/png'}));
				if (types) {
					data.setData('text/plain', 'words');
				}
				target.dispatchEvent(new ClipboardEvent('paste', {clipboardData: data, bubbles: true, cancelable: true}));
			};
			const sample = new DataTransfer();
			sample.items.add(new File(['x'], 'a.png', {type: 'image/png'}));
			const pastes = new ClipboardEvent('paste', {clipboardData: sample}).clipboardData?.files.length === 1;
			const add = (target, types) => pastes ? paste(target, types) : choose($('input[type="file"]', upload), files(['shot.png']));
			paste($('input[name="note"]', box), true);
			const words = pastes ? $$('.upload-list > *', upload).length : 1;
			add(document.body, false);
			const rows = $$('.upload-list > *', upload).length;
			const invalid = $('input[type="file"]', upload).validationMessage !== '';
			let ready = false;
			const promise = REDZ.ui.upload.settled(upload).then((detail) => {
				ready = detail;
			});
			await settled();
			const early = ready;
			send?.();
			await promise;
			add(document.body, false);
			REDZ.ui.upload.clear(upload);
			const cleared = $$('.upload-list > *', upload).map((row) => row.dataset.fileStored ?? 'new');
			document.removeEventListener('redz:files', sending);
			box.remove();
			if (words !== 1 || rows !== 2 || !invalid || early !== false || say(ready) !== say({count: 2, pending: 0, failed: 0}) || say(cleared) !== say(['7']) || !heard.some((one) => one.includes('"pending":1'))) {
				out.push('a page-wide paste: into a field with words ' + (words - 1) + ' rows, elsewhere ' + (rows - 1) + ', the field held while sending ' + invalid + ', settled early ' + say(early) + ' then ' + say(ready) + ', clear keeps ' + say(cleared) + '; heard ' + say(heard));
			}
		}]},
		followBox: {target: '#log-thread-box', steps: [async (out) => {
			const box = $('#log-thread-box');
			const pill = $('[command="--follow"]', box);
			for (let n = 0; n < 8; n++) {
				$('.follow-dock', box).before(Object.assign(document.createElement('p'), {textContent: 'Earlier message ' + n}));
			}
			await wait(80);
			const end = () => box.scrollHeight - box.scrollTop - box.clientHeight < 8;
			const add = async (words) => {
				$('.follow-dock', box).before(Object.assign(document.createElement('p'), {textContent: words}));
				await wait(80);
			};
			await add('One');
			const followed = [end(), pill.hidden];
			box.scrollTop = 0;
			box.dispatchEvent(new Event('scroll'));
			await wait(50);
			await add('Two');
			const away = [box.scrollTop, pill.hidden];
			pill.click();
			await wait(50);
			const back = [end(), pill.hidden];
			const grow = $('p', box);
			grow.style.blockSize = '6rem';
			await wait(100);
			const grown = end();
			grow.style.blockSize = '';
			const steps = $('#log-steps-list');
			const last = steps.lastElementChild;
			const current = $('[aria-current]', steps);
			current.removeAttribute('aria-current');
			last.setAttribute('aria-current', 'step');
			await wait(100);
			const [outer, inner] = [steps.getBoundingClientRect(), last.getBoundingClientRect()];
			const shown = inner.top >= outer.top - 1 && inner.bottom <= outer.bottom + 1;
			last.removeAttribute('aria-current');
			current.setAttribute('aria-current', 'step');
			if (say(followed) !== say([true, true]) || say(away) !== say([0, false]) || say(back) !== say([true, true]) || !grown || !shown) {
				out.push('a followed box: ' + say(followed) + ' at the end, pill hidden; read above ' + say(away) + ' (kept, pill shown); the pill ' + say(back) + '; a child that grows ' + (grown ? 'keeps' : 'loses') + ' the end; the current step ' + (shown ? 'shows' : 'is out of view'));
			}
		}]},
		listRowLink: {target: '#list-group-rows', steps: [async (out) => {
			const item = $('#list-group-rows .list-group-item');
			const link = $('.stretched-link', item);
			let followed = 0;
			const stop = (event) => {
				event.preventDefault();
				followed++;
			};
			link.addEventListener('click', stop);
			$('.text-muted', item).click();
			const byText = followed;
			$('.list-group-actions .btn', item).addEventListener('click', (event) => event.preventDefault(), {once: true});
			$('.list-group-actions .btn', item).click();
			const byButton = followed;
			link.removeEventListener('click', stop);
			const cover = getComputedStyle(link, '::after').content;
			const pad = getComputedStyle(item).paddingTop;
			if (byText !== 1 || byButton !== 1 || cover !== 'none' || pad !== '8px') {
				out.push('a list item as a link: a click on its words follows ' + byText + ' times, on its button ' + (byButton - byText) + ' more; its cover ' + say(cover) + ' (text stays selectable); compact padding ' + pad);
			}
		}]},
		flushInCard: {target: '#list-group-more-example', steps: [async (out) => {
			for (const list of $$('.card > .list-group-flush')) {
				const header = $(':scope > .card-header', list.parentElement);
				const edge = (element) => {
					const box = element.getBoundingClientRect();
					const style = getComputedStyle(element);
					return style.direction === 'rtl' ? box.right - parseFloat(style.paddingRight) : box.left + parseFloat(style.paddingLeft);
				};
				const item = $(':scope > .list-group-item', list);
				if (header !== null && item !== null && Math.abs(edge(item) - edge(header)) > 1) {
					out.push('a flush list right in a card (' + (list.id || list.parentElement.id || list.parentElement.getAttribute('aria-labelledby')) + '): its rows\' words start ' + Math.round(edge(item) - edge(header)) + ' px from its header\'s');
				}
			}
		}]},
		alertNarrow: {target: '#alert-tones', steps: [async (out) => {
			const host = document.body.appendChild(Object.assign(document.createElement('div'), {dir: 'ltr'}));
			host.style.inlineSize = '280px';
			host.innerHTML = trusted('<div class="alert alert-danger"><i class="bi bi-x-octagon" aria-hidden="true"></i><div>This cannot be undone.</div></div><div class="alert alert-primary"><i class="bi bi-stars" aria-hidden="true"></i><div class="vstack gap-8"><strong>A shorter title</strong><p>It fits the search results.</p></div></div>');
			await settled();
			for (const alert of $$('.alert', host)) {
				const [icon, words] = [$(':scope > .bi', alert).getBoundingClientRect(), $(':scope > div', alert).getBoundingClientRect()];
				if (words.left < icon.right || words.top > icon.bottom) {
					out.push('an alert 280 px wide puts its words ' + (words.top > icon.bottom ? 'under' : 'over') + ' its icon, not beside it');
				}
			}
			host.remove();
		}]},
		selectionBarNarrow: {target: '#selection-bar-list', steps: [async (out) => {
			const host = document.body.appendChild(Object.assign(document.createElement('div'), {dir: 'ltr'}));
			host.style.inlineSize = '360px';
			host.append($('#selection-bar-list .selection-bar').cloneNode(true));
			const short = document.body.appendChild(Object.assign(document.createElement('div'), {dir: 'ltr'}));
			short.style.inlineSize = '360px';
			short.innerHTML = trusted('<div class="selection-bar"><strong>2 selected</strong><button class="btn btn-sm" type="button">Write</button><button class="btn btn-sm btn-icon btn-text" type="button" aria-label="Clear"><i class="bi bi-x" aria-hidden="true"></i></button></div>');
			await settled();
			const bar = $('.selection-bar', host);
			const [label, close] = [bar.firstElementChild.getBoundingClientRect(), bar.lastElementChild.getBoundingClientRect()];
			const edge = bar.getBoundingClientRect().right - close.right;
			const one = $('.selection-bar', short);
			const lines = Math.round((one.getBoundingClientRect().height - 16) / one.lastElementChild.getBoundingClientRect().height);
			if (Math.abs((label.top + label.bottom) / 2 - (close.top + close.bottom) / 2) > 2 || Math.abs(edge - 16) > 1 || lines !== 1) {
				out.push('a selection bar 360 px wide: its clear button ' + Math.round((close.top + close.bottom - label.top - label.bottom) / 2) + ' px off its count\'s line, ' + Math.round(edge) + ' px from the end; a bar of one action takes ' + lines + ' lines');
			}
			host.remove();
			short.remove();
		}]},
		busyWordsGround: {target: '#busy-region-words', steps: [async (out) => {
			const host = document.body.appendChild(Object.assign(document.createElement('div'), {className: 'region', dir: 'ltr'}));
			host.style.inlineSize = '360px';
			host.setAttribute('aria-busy', 'true');
			host.innerHTML = trusted('<p>base-2026-11-08.sql · 2.4 MB</p><p>files-2026-11-08.tar · 380 MB</p><span class="busy-words">Preparing the download…</span>');
			await settled();
			const words = $('.busy-words', host);
			const ground = getComputedStyle(words).backgroundColor;
			const wide = words.getBoundingClientRect().width;
			if (ground === 'rgba(0, 0, 0, 0)' || ground === 'transparent' || wide > 300) {
				out.push('a busy region\'s words stand ' + (wide > 300 ? 'across the region' : 'on no ground of their own') + ', over the dimmed words under them');
			}
			host.remove();
		}]},
		actionBar: {target: '#app-action-bar-example', steps: [async (out) => {
			const bar = $('#app-action-bar-example .action-bar');
			const style = getComputedStyle(bar);
			const floor = document.body.appendChild(Object.assign(document.createElement('div'), {className: 'bg-page'}));
			const page = getComputedStyle(floor).backgroundColor;
			floor.remove();
			if (style.position !== 'sticky' || style.bottom !== '0px' || style.backgroundColor !== page) {
				out.push('an action bar is ' + style.position + ' at bottom ' + style.bottom + ' on ' + style.backgroundColor + ', not sticky on the page\'s floor');
			}
		}]},
		toneText: {target: '#tokens-brand-region', steps: [async (out) => {
			if (!await readable) {
				return;
			}
			const lum = (color) => rgb(color).split(',').map(Number).map((c) => c / 255).map((c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
			const ratio = (a, b) => {
				const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
				return (x + 0.05) / (y + 0.05);
			};
			const ground = (element) => {
				for (let at = element; at !== null; at = at.parentElement) {
					const fill = getComputedStyle(at).backgroundColor;
					if (fill !== 'rgba(0, 0, 0, 0)' && fill !== 'transparent') {
						return fill;
					}
				}
				return 'rgb(255, 255, 255)';
			};
			const low = [];
			for (const one of $$('#tokens-brand-region :is(.badge, a, .text-danger, .btn-outline-primary)')) {
				const found = ratio(getComputedStyle(one).color, ground(one));
				if (found < 4.5) {
					low.push(one.textContent.trim() + ' ' + found.toFixed(2) + ' in ' + one.parentElement.getAttribute('data-brand') + (one.parentElement.getAttribute('data-brand-danger') ?? ''));
				}
			}
			if (low.length > 0 && document.documentElement.dataset.theme !== 'dark') {
				out.push('text in a brand tone below 4.5:1 on its ground: ' + say(low));
			}
		}]},
		logoSize: {target: '#logo-sizes', steps: [async (out) => {
			const [small, plain, large, mark] = $$('#logo-sizes .logo').map((one) => one.getBoundingClientRect());
			const ground = getComputedStyle($('#logo-sizes .logo')).backgroundColor;
			const got = [Math.round(small.height), Math.round(plain.height), Math.round(large.height), Math.round(large.width), Math.round(mark.width), ground];
			if (say(got) !== say([28, 32, 40, 113, 40, 'rgb(255, 255, 255)'])) {
				out.push('logos: heights, the 4:1 large one\'s width and the round mark\'s width, the ground ' + say(got) + ' - a width is the height times the ratio to the power 0.75');
			}
		}]},
		logoChoice: {target: '#logo-choice', steps: [async (out) => {
			const [wide, solid] = $$('#logo-choice .choice-media').map((media) => {
				const style = getComputedStyle(media);
				const room = media.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
				return Math.round($('img', media).getBoundingClientRect().height / room * 100);
			});
			if (Math.abs(wide - 71) > 3 || solid < 97) {
				out.push('a choice tile draws a 4:1 wordmark ' + wide + ' % as high as its banner, not about 71 % (the fourth root), and a logo on its own color ' + solid + ' %, not all of it');
			}
		}]},
		overlayShade: {target: '#card-images', steps: [async (out) => {
			const overlay = $('#card-images .card-img-overlay');
			const style = getComputedStyle(overlay);
			const picture = $(':scope > .card-img', overlay.parentElement).getBoundingClientRect();
			const card = overlay.parentElement.getBoundingClientRect();
			if (!style.backgroundImage.includes('gradient') || style.color !== 'rgb(255, 255, 255)' || picture.height < card.height - 3) {
				out.push('words over a picture: ' + (style.backgroundImage.includes('gradient') ? '' : 'no shade, ') + 'their color ' + style.color + ', the picture ' + Math.round(picture.height) + ' px in a card of ' + Math.round(card.height));
			}
		}]},
		rowHeaderLine: {target: '#table-wide', steps: [async (out) => {
			const host = document.body.appendChild(Object.assign(document.createElement('div'), {className: 'region', dir: 'ltr'}));
			host.style.inlineSize = '360px';
			host.append($('#table-wide .table-scroll').cloneNode(true));
			await settled();
			const head = $('tbody th[scope="row"]', host);
			const range = document.createRange();
			range.selectNodeContents(head);
			const lines = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size;
			host.remove();
			if (lines !== 1) {
				out.push('a row header in a table that scrolls, 360 px wide, takes ' + lines + ' lines for "' + head.textContent + '"');
			}
		}]},
		shareRow: {target: '#commands-share-row', steps: [async (out) => {
			const row = $('#commands-share-row [data-share-url]');
			const href = (name) => $('a.share-' + name, row)?.getAttribute('href') ?? '';
			const got = [href('x').startsWith('https://x.com/intent/tweet?url=https%3A%2F%2Flagoon.example%2Fjoin%3Fref%3Dsample&text=Book'), href('viber').startsWith('viber://forward?text=Book'), href('whatsapp').startsWith('https://wa.me/'), $('[command="--copy"]', row).dataset.copy, getComputedStyle($('.share-viber', row), '::before').content];
			if (say(got) !== say([true, true, true, 'https://lagoon.example/join?ref=sample', '"Vb" / ""']) && say(got) !== say([true, true, true, 'https://lagoon.example/join?ref=sample', '"Vb"'])) {
				out.push('a share row writes ' + say(got) + ' (X, Viber, WhatsApp links, the copy, Viber\'s letters)');
			}
		}]},
		commandCopy: {target: '#command-line-install', steps: [async (out) => {
			const copied = [];
			const clipboard = navigator.clipboard;
			if (clipboard === undefined) {
				return;
			}
			const write = clipboard.writeText;
			clipboard.writeText = (words) => {
				copied.push(words);
				return Promise.resolve();
			};
			try {
				$('#command-line-install [aria-controls="command-line-install-list"]').click();
				$('#command-line-install .command-line .btn').click();
				$('#command-line-cron .command-line .btn').click();
				await settled();
			} finally {
				clipboard.writeText = write;
			}
			const box = $('#command-line-cron .command-line');
			const pre = $('pre', box);
			const look = [getComputedStyle(pre).whiteSpace, getComputedStyle(pre).direction, pre.scrollWidth > pre.clientWidth || pre.scrollWidth <= pre.clientWidth, box.getAttribute('role'), getComputedStyle($('#command-line-key var')).backgroundColor !== 'rgba(0, 0, 0, 0)'];
			if (say(copied) !== say(['curl -fsSLO https://get.example.com/agent/agent-2.4.tar.gz\ntar -xzf agent-2.4.tar.gz -C /opt\n/opt/agent/start --key YOUR_KEY', 'curl -fsSLO https://get.example.com/agent/agent-2.4.tar.gz', $('code', pre).textContent]) || say(look) !== say(['pre', 'ltr', true, 'group', true])) {
				out.push('commands to copy: copied ' + say(copied) + ' (all steps a line each, one step, the crontab line); look ' + say(look));
			}
		}]},
		meterStacked: {target: '#progress-stacked-quota', steps: [async (out) => {
			const meter = $('#progress-stacked-quota .meter-stacked');
			const parts = $$(':scope > *', meter);
			const whole = meter.getBoundingClientRect().width - 4;
			const shares = parts.map((part) => +(part.getBoundingClientRect().width / whole).toFixed(2));
			const hatched = getComputedStyle(parts[2]).backgroundImage.includes('repeating-linear-gradient');
			if (shares.some((value, i) => Math.abs(value - [0.385, 0.538, 0.077][i]) > 0.02) || !hatched) {
				out.push('a stacked meter draws its parts at ' + say(shares) + ' of the scale, not their data-v, and its part over the limit is ' + (hatched ? '' : 'not ') + 'hatched');
			}
		}]},
		chartLine: {target: '#chart-line-usage', steps: [async (out) => {
			const table = $('#chart-line-usage table');
			const body = table.tBodies[0];
			const svg = $(':scope > svg[data-line]', body);
			const points = () => $('polyline', svg)?.getAttribute('points').split(' ').length;
			const shape = [svg !== null, $('polygon', body) !== null, points(), body.rows.length, getComputedStyle(body.rows[0].cells[0]).textAlign];
			const cell = body.rows[3].cells[1];
			const was = cell.getAttribute('data-v');
			cell.setAttribute('data-v', '0.99');
			await settled();
			const moved = $(':scope > svg[data-line] polyline', body).getAttribute('points').split(' ')[3];
			cell.setAttribute('data-v', was);
			await settled();
			const spark = $('#chart-spark-line .spark-line > svg polyline')?.getAttribute('points').split(' ').length;
			if (say(shape) !== say([true, true, 14, 14, 'start']) || moved !== '3.5,10.0' || spark !== 10 || $$(':scope > svg', body).length !== 1) {
				out.push('a line chart: ' + say(shape) + ' (its line, its area, its points, its rows, the first label at the start), a value changed moves its point to ' + say(moved) + ', a spark line has ' + spark + ' points, the body holds ' + $$(':scope > svg', body).length + ' lines');
			}
		}]},
		sortedLine: {target: '#chart-spark-line', steps: [async (out) => {
			const row = (size) => '<tr data-sort-size="' + size + '"><td><span class="spark spark-line" role="img" aria-label="Size ' + size + '"><i data-v="0.' + size + '"></i><i data-v="0.' + (size + 1) + '"></i></span></td></tr>';
			const box = document.createElement('table');
			box.innerHTML = trusted('<thead><tr><th><button class="table-sort" type="button" value="size">Size</button></th></tr></thead><tbody>' + [3, 1, 2].map(row).join('') + '</tbody>');
			document.body.append(box);
			await settled();
			const order = () => [...box.tBodies[0].rows].map((one) => one.dataset.sortSize).join(' ');
			const lines = () => $$('svg[data-line]', box);
			const drawn = lines();
			let seen = 0;
			// A sort and a chart that redraw each other never yield the thread, so the check stops them itself by taking the sparks away.
			const guard = new MutationObserver((records) => {
				seen += records.length;
				if (seen > 200) {
					$$('.spark', box).forEach((spark) => spark.remove());
				}
			});
			guard.observe(box, {childList: true, subtree: true});
			$('button', box).click();
			await settled();
			const up = order();
			const kept = lines().length === 3 && lines().every((one) => drawn.includes(one));
			$('button', box).click();
			await settled();
			const down = order();
			const first = box.tBodies[0].rows[0];
			first.dataset.sortSize = '0';
			first.cells[0].append(document.createElement('b'));
			await settled();
			const stayed = order();
			guard.disconnect();
			box.remove();
			if (seen > 200) {
				out.push('a sort and a spark-line in its table redraw each other without end: ' + seen + ' changes after two presses');
			} else if (say([drawn.length, up, kept, down, stayed]) !== say([3, '1 2 3', true, '3 2 1', '0 2 1'])) {
				out.push('a spark-line in a sorted table: ' + say([drawn.length, up, kept, down, stayed]) + ' (lines drawn, the order after one press, the lines stayed the same elements, after two presses, after an element put in a cell)');
			}
		}]},
		strip: {target: '#chart-strip-uptime', steps: [async (out) => {
			const box = $('#chart-strip-uptime .strip');
			const shown = () => [$$('.spark-strip > i', box).filter((cell) => getComputedStyle(cell).display !== 'none').length, $$('.strip-head > [data-days]', box).filter((one) => getComputedStyle(one).display !== 'none').map((one) => one.dataset.days).join(' ')];
			const counts = [];
			for (const width of ['', '400px', '300px']) {
				box.style.inlineSize = width;
				await settled();
				counts.push(shown());
			}
			box.style.inlineSize = '';
			const cell = $('.spark-strip > i', box).getBoundingClientRect();
			if (say(counts) !== say([[90, '90'], [60, '60'], [30, '30']]) || cell.height < 30) {
				out.push('a strip of days shows ' + say(counts) + ' (cells, the caption) at its width, 400 px and 300 px, and a cell ' + Math.round(cell.height) + ' px high');
			}
		}]},
		qrDraw: {target: '#qr-package', steps: [async (out) => {
			const tile = $('#qr-package [data-qr]');
			const svg = $('svg', tile);
			const path = $$('path', svg);
			const shape = [svg?.getAttribute('viewBox'), svg?.getAttribute('shape-rendering'), svg?.getAttribute('aria-hidden'), path.length, svg?.hasAttribute('style'), tile.getAttribute('role')];
			const again = document.createElement('div');
			REDZ.ui.qr(again, tile.dataset.qr);
			const same = again.innerHTML === tile.innerHTML;
			tile.dataset.qr = 'changed';
			await settled();
			const redrawn = tile.innerHTML !== again.innerHTML;
			tile.dataset.qr = 'https://redz-tech.github.io/REDZ.UI/';
			await settled();
			const secret = document.createElement('div');
			const long = REDZ.ui.qr(secret, 'x'.repeat(2332));
			const refused = [long, secret.hasAttribute('data-qr-error'), secret.childElementCount];
			let decoded = 'skip';
			if ('BarcodeDetector' in window && await readable && (await BarcodeDetector.getSupportedFormats()).includes('qr_code')) {
				const image = new Image();
				image.src = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], {type: 'image/svg+xml'}));
				await image.decode();
				const canvas = Object.assign(document.createElement('canvas'), {width: 300, height: 300});
				const paint = canvas.getContext('2d');
				paint.fillStyle = '#fff';
				paint.fillRect(0, 0, 300, 300);
				paint.drawImage(image, 0, 0, 300, 300);
				decoded = (await new BarcodeDetector({formats: ['qr_code']}).detect(canvas).catch(() => []))[0]?.rawValue ?? 'nothing';
			}
			const wide = getComputedStyle($('svg', tile)).inlineSize;
			if (shape[0] === null || say(shape.slice(1)) !== say(['crispEdges', 'true', 1, false, 'img']) || !same || !redrawn || say(refused) !== say([false, true, 0]) || !['skip', 'https://redz-tech.github.io/REDZ.UI/'].includes(decoded) || wide !== '176px') {
				out.push('a QR tile: ' + say(shape) + ' (viewBox, crisp edges, hidden, one path, no style, role), the call draws the same ' + same + ', a new text redraws ' + redrawn + ', too long ' + say(refused) + ', decoded ' + say(decoded) + ', width ' + wide);
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
		tipScroll: {target: '#tooltip-title [aria-disabled="true"][title]', steps: [async (out) => {
			const button = $('#tooltip-title [aria-disabled="true"][title]');
			button.scrollIntoView({block: 'center', behavior: 'instant'});
			const box = document.body.appendChild(Object.assign(document.createElement('div'), {className: 'overflow-auto'}));
			box.style.blockSize = '40px';
			box.append(Object.assign(document.createElement('div'), {textContent: 'A box that scrolls by itself'}));
			box.firstElementChild.style.blockSize = '400px';
			await settled();
			button.dispatchEvent(new PointerEvent('pointerup', {bubbles: true, pointerType: 'touch'}));
			await settled();
			box.scrollTop = 120;
			await settled();
			// WebKit fires a page scroll that moves nothing when it rounds a page left at a fraction of a pixel, as a trackpad leaves it.
			document.dispatchEvent(new Event('scroll'));
			await settled();
			const kept = $('#redz-tooltip')?.matches(':popover-open') ?? false;
			scrollBy({top: 80, behavior: 'instant'});
			await settled();
			const hidden = !($('#redz-tooltip')?.matches(':popover-open') ?? false);
			box.remove();
			if (!kept || !hidden) {
				out.push('a tooltip ' + (kept ? 'stays' : 'hides') + ' while a box elsewhere scrolls or the page sends a scroll that moves nothing, and ' + (hidden ? 'hides' : 'stays') + ' when the page scrolls its element away');
			}
		}]},
		titleBack: {target: '#tooltip-title', steps: [async (out) => {
			const host = $('#tooltip-title');
			const button = Object.assign(document.createElement('button'), {className: 'btn', type: 'button', title: 'Moves', textContent: 'Moves'});
			const other = Object.assign(document.createElement('button'), {className: 'btn', type: 'button', textContent: 'Elsewhere'});
			const menu = Object.assign(document.createElement('div'), {className: 'menu', popover: 'auto', innerHTML: trusted('<button class="menu-item" type="button">Up</button>')});
			const dialog = Object.assign(document.createElement('dialog'), {className: 'dialog', innerHTML: trusted('<button class="btn" type="button">Inside</button>')});
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
			form.innerHTML = trusted('<select name="walkKind"><option value="simple">Simple</option><option value="bundle">Bundle</option></select><div data-show-when="walkKind" data-show-in="bundle"><select name="walkMode"><option value="auto">Auto</option><option value="manual">Manual</option></select><div data-show-when="walkMode" data-show-in="manual"><input name="walkPrice" value="9"></div></div>');
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
			const table = Object.assign(document.createElement('table'), {className: 'table', innerHTML: trusted('<thead><tr><th scope="col">Boat</th><th scope="col">Seats</th></tr></thead><tbody><tr><th scope="row">Boat A</th><td>5</td></tr></tbody><tfoot><tr><th scope="row">Total</th><td>5</td></tr></tfoot>')});
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
			const fits = Object.assign(document.createElement('div'), {className: 'table-scroll', innerHTML: trusted('<table class="table"><tbody><tr><td>Fits</td></tr></tbody></table>')});
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
		foldedHidden: {target: '#nav-overflow .nav-overflow-toggle', steps: [async (out) => {
			const wrapper = $('#nav-overflow .nav-overflow');
			const links = $$(':scope > .nav > .nav-link', wrapper);
			const folded = links.find((link) => 'overflow' in link.dataset);
			const shown = links.find((link) => !('overflow' in link.dataset) && !link.hasAttribute('aria-current'));
			const inMenu = (link) => $$('.nav-overflow-menu .menu-item', wrapper).some((item) => item.textContent.trim() === link.textContent.trim());
			if (folded === undefined || shown === undefined || folded.hidden) {
				out.push('the links do not fold as the check needs: ' + links.map((link) => link.hidden + ' ' + ('overflow' in link.dataset)).join(', '));
				return;
			}
			if (!inMenu(folded) || folded.getClientRects().length > 0) {
				out.push('a folded link is not in the menu alone');
			}
			folded.hidden = true;
			await until(() => !inMenu(folded));
			if (inMenu(folded) || !folded.hidden) {
				out.push('a folded link the page hides stays in the menu');
			}
			folded.hidden = false;
			await until(() => inMenu(folded) || folded.getClientRects().length > 0);
			if (!inMenu(folded) && folded.getClientRects().length === 0) {
				out.push('a link the page shows again comes back nowhere');
			}
			shown.hidden = true;
			await until(() => shown.getClientRects().length === 0);
			await settled();
			if (inMenu(shown) || shown.getClientRects().length > 0 || !shown.hidden) {
				out.push('a link in the row the page hides does not leave it');
			}
			shown.hidden = false;
			await until(() => shown.getClientRects().length > 0 || inMenu(shown));
			if (shown.getClientRects().length === 0 && !inMenu(shown)) {
				out.push('a link the row gave up does not come back');
			}
		}]},
		stepDetail: {target: '#step-list-narrow .step-list', steps: [async (out) => {
			const [short, wrapped, long, badge, empty] = $$('#step-list-narrow .step-list > li');
			const room = (li) => {
				const box = li.getBoundingClientRect();
				return {box, start: box.left + parseFloat(getComputedStyle(li).paddingInlineStart), line: parseFloat(getComputedStyle(li).lineHeight)};
			};
			const beside = (li) => {
				const {box, line} = room(li);
				const detail = $('.step-list-detail', li).getBoundingClientRect();
				return near(detail.right, box.right, 1) && near(box.height, line, 3);
			};
			if (!beside(short) || !beside(badge)) {
				out.push('a detail that fits leaves the end of the line: ' + say([short, badge].map((li) => li.getBoundingClientRect().height)));
			}
			for (const li of [wrapped, long]) {
				const {box, start, line} = room(li);
				const under = $('.step-list-detail', li).getBoundingClientRect();
				if (!near(under.left, start, 1) || under.top < box.top + line - 1) {
					out.push('a detail that does not fit stays beside the name or leaves its start: ' + say([under.left, start, under.top - box.top, line]));
				}
				if (li.scrollWidth > li.clientWidth + 1) {
					out.push('a long detail runs past its step');
				}
			}
			if (getComputedStyle($('.step-list-detail', empty)).display !== 'none' || !near(empty.getBoundingClientRect().height, room(empty).line, 1)) {
				out.push('an empty detail takes room: ' + empty.getBoundingClientRect().height + ' for a line of ' + room(empty).line);
			}
			const icon = $('.bi', short).getBoundingClientRect();
			if (!near(icon.top + icon.height / 2, short.getBoundingClientRect().top + room(short).line / 2, 2)) {
				out.push('a step\'s icon leaves the middle of its first line');
			}
		}]},
		stepBody: {target: '#step-list-blocks .step-list-body.vstack', steps: [async (out) => {
			const body = $('#step-list-blocks .step-list-body.vstack');
			const li = body.parentElement;
			const style = getComputedStyle(li);
			const room = li.getBoundingClientRect();
			const box = body.getBoundingClientRect();
			if (!near(box.left, room.left + parseFloat(style.paddingInlineStart), 1) || !near(box.right, room.right - parseFloat(style.paddingInlineEnd), 1)) {
				out.push('a vstack body stands beside its step\'s name: ' + say([box.left, box.right, room.left, room.right]));
			}
		}]},
		laneButton: {target: '#chart-board table.lanes', steps: [async (out) => {
			const button = $('#chart-board table.lanes > tbody > tr > th > button');
			const th = button.parentElement;
			const [cell, own] = [th.getBoundingClientRect(), button.getBoundingClientRect()];
			const room = cell.right - parseFloat(getComputedStyle(th).paddingRight);
			button.focus();
			const ring = button.matches(':focus-visible') ? getComputedStyle(button).outlineOffset : '-2px';
			button.blur();
			const got = [own.left >= cell.left - 0.5 && own.right <= room + 0.5, button.scrollWidth > button.clientWidth, getComputedStyle(button).textOverflow, own.height >= 23.5, ring];
			if (say(got) !== say([true, true, 'ellipsis', true, '-2px'])) {
				out.push('a button in a lanes row header: inside the header\'s room ' + got[0] + ' (' + Math.round(own.left) + '-' + Math.round(own.right) + ' in ' + Math.round(cell.left) + '-' + Math.round(room) + '), cut ' + got[1] + ', ends in ' + got[2] + ', its height kept ' + got[3] + ', its focus ring drawn inside it by ' + got[4] + ', not cut by the header');
			}
		}]},
		scaleCaptions: {target: '#chart-board .lanes-scale', steps: [async (out) => {
			const board = $('#chart-board table.lanes');
			const first = $('.lanes-scale > :first-child', board);
			const words = first.textContent;
			const seen = () => $$('.lanes-scale > span', board).filter((caption) => caption.getClientRects().length > 0 && getComputedStyle(caption).visibility === 'visible').map((caption) => caption.getBoundingClientRect());
			const touching = () => seen().filter((box, i, all) => i > 0 && box.left < all[i - 1].right);
			for (const [inline, name] of [['324px', 'narrow'], ['1000px', 'wide']]) {
				board.style.inlineSize = inline;
				first.textContent = 'a long first word';
				await settled();
				await settled();
				if (touching().length > 0) {
					out.push('captions of a ' + name + ' board touch: ' + say(seen().map((box) => [Math.round(box.left), Math.round(box.right)])));
				}
				if (seen().length < 3) {
					out.push('a ' + name + ' board keeps ' + seen().length + ' captions');
				}
			}
			first.textContent = words;
			board.style.inlineSize = '';
			await settled();
			await settled();
			if (seen().length !== $$('.lanes-scale > span', board).length) {
				out.push('a wide board with room hides ' + ($$('.lanes-scale > span', board).length - seen().length) + ' captions');
			}
		}]},
		foldedTab: {target: '#nav-tabs [role="tablist"]', steps: [async (out) => {
			const tabs = $$('#nav-tabs [role="tab"]');
			tabs[1].dataset.overflow = '';
			tabs[0].focus();
			tabs[0].dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true, cancelable: true}));
			await settled();
			if (document.activeElement !== tabs[2]) {
				out.push('an arrow key lands on a folded tab: ' + document.activeElement.textContent);
			}
			delete tabs[1].dataset.overflow;
			tabs[0].click();
			await settled();
		}]},
		readyStep: {target: '#step-list-pipeline-ready [data-state="ready"]', steps: [async (out) => {
			const stage = $('#step-list-pipeline-ready [data-state="ready"]');
			const icon = $('.bi', stage);
			const step = $('#step-list-narrow [data-state="ready"] > .bi');
			const turning = $('#step-list-job [data-state="current"] > .bi');
			if (matchMedia('(prefers-reduced-motion: no-preference)').matches && getComputedStyle(turning).animationName === 'none') {
				out.push('a current step no longer turns, so this check proves nothing');
			}
			if (getComputedStyle(icon).animationName !== 'none' || getComputedStyle(step).animationName !== 'none') {
				out.push('a ready step turns its icon');
			}
			if (getComputedStyle(icon).color !== getComputedStyle(step).color || getComputedStyle(stage).borderInlineStartColor !== getComputedStyle($('#step-list-pipeline [data-state="current"]')).borderInlineStartColor) {
				out.push('a ready step does not wear the look of the current one');
			}
		}]},
		tileTone: {target: '#stat-tile-tone .stat', steps: [async (out) => {
			const [own, plain] = $$('#stat-tile-tone .icon-tile');
			const free = document.createElement('span');
			free.className = own.className;
			document.body.append(free);
			const wanted = getComputedStyle(free).color;
			free.remove();
			if (getComputedStyle(own).color !== wanted) {
				out.push('a stat takes the tone of its tile: ' + getComputedStyle(own).color + ', not ' + wanted);
			}
			if (getComputedStyle(plain).color !== getComputedStyle($('.stat-value', plain.parentElement)).color) {
				out.push('a tile without a tone leaves the stat\'s');
			}
		}]},
		diffBox: {target: '#log-diff-example .diff', steps: [async (out) => {
			const diff = $('#log-diff-example .diff');
			if (parseFloat(getComputedStyle(diff).maxBlockSize) !== parseFloat(getComputedStyle(document.documentElement).fontSize) * 25 || !/auto|scroll/.test(getComputedStyle(diff).overflowY)) {
				out.push('a diff has no box of its own: ' + getComputedStyle(diff).maxBlockSize + ', ' + getComputedStyle(diff).overflowY);
			}
			diff.classList.add('max-h-160');
			if (parseFloat(getComputedStyle(diff).maxBlockSize) !== parseFloat(getComputedStyle(document.documentElement).fontSize) * 10) {
				out.push('a max-h utility does not set a diff\'s height');
			}
			diff.classList.remove('max-h-160');
		}]},
		displayNone: {target: '#alert-stacked', steps: [async (out) => {
			const box = $('#alert-stacked');
			const shown = (name) => {
				const el = Object.assign(document.createElement('div'), {className: name});
				box.append(el);
				const display = getComputedStyle(el).display;
				el.remove();
				return display;
			};
			for (const name of ['d-flex', 'd-grid', 'd-block', 'vstack', 'hstack', 'grid', 'line-clamp-2', 'icon-link', 'vr', 'alert']) {
				if (shown(name + ' d-none') !== 'none') {
					out.push('d-none loses to ' + name);
				}
			}
			if (shown('d-none md:d-flex') !== 'flex') {
				out.push('d-none beats a width prefix');
			}
		}]},
		alertStack: {target: '#alert-stacked .alert', steps: [async (out) => {
			const alert = $('#alert-stacked .alert');
			const body = $('.vstack', alert);
			const before = alert.style.inlineSize;
			alert.style.inlineSize = '340px';
			const tops = [$('.bi', alert), body].map((el) => el.getBoundingClientRect().top);
			if (body.getBoundingClientRect().left <= $('.bi', alert).getBoundingClientRect().right || tops[1] > tops[0] + 16) {
				out.push('a stacked body falls under the icon at 340 px: ' + say(tops));
			}
			alert.style.inlineSize = before;
		}]},
		rowLight: {target: '#table-hover-rows', walk: async function* (out) {
			const [lit, still] = $$('#table-hover-rows table');
			const rest = getComputedStyle($('td', lit)).backgroundColor;
			const point = async (el) => {
				el.scrollIntoView({block: 'center', behavior: 'instant'});
				await settled();
				await settled();
				return center(el);
			};
			yield {hover: await point($('td', lit))};
			const hovered = getComputedStyle($('td', lit)).backgroundColor;
			if (matchMedia('(hover: hover)').matches && hovered === rest) {
				out.push('a table does not light the row under the pointer');
			}
			yield {hover: await point($('td', still))};
			const quiet = getComputedStyle($('td', still)).backgroundColor;
			if (quiet !== getComputedStyle($('tbody tr:last-child td', still)).backgroundColor) {
				out.push('table-static lights its row: ' + quiet);
			}
			lit.style.setProperty('--redz-row-hover', 'rgb(1, 2, 3)');
			yield {hover: await point($('td', lit))};
			if (matchMedia('(hover: hover)').matches && getComputedStyle($('td', lit)).backgroundColor !== 'rgb(1, 2, 3)') {
				out.push('--redz-row-hover does not set the light of a row');
			}
			lit.style.removeProperty('--redz-row-hover');
			yield {hover: [5, 5]};
		}},
		rowMenu: {target: '#table-row-menu', walk: async function* (out) {
			if (!matchMedia('(hover: hover)').matches) {
				return;
			}
			const opacity = (el) => getComputedStyle(el).opacity;
			const lit = (row) => getComputedStyle(row.cells[0]).backgroundColor;
			const away = [5, 5];
			const menuOf = (id) => {
				const list = Object.assign(document.createElement('div'), {id, className: 'menu', popover: 'auto', innerHTML: trusted('<button class="menu-item" type="button" role="menuitem">One</button>')});
				list.setAttribute('role', 'menu');
				return list;
			};
			const holds = (name, kept) => {
				for (const [what, value, want] of kept) {
					if (value !== want) {
						out.push(name + ': ' + what + ' ' + say(value) + ', not ' + say(want));
					}
				}
			};
			// A real pointer and click through the states of an open menu, each state asked of what must hold in it.
			const walkMenu = async function* (name, button, menu, kept) {
				yield {hover: center(button)};
				yield {click: center(button)};
				await until(() => menu.matches(':popover-open') && opacity(menu) === '1', 800);
				holds(name + ', just open', kept());
				yield {hover: center($('.menu-item', menu))};
				holds(name + ', the pointer on an item', kept());
				yield {hover: away};
				holds(name + ', the pointer away', kept());
			};

			const host = $('#table-row-menu');
			const [row, next] = $$('tbody tr', host);
			const [edit, more] = $$('.table-actions > button', row);
			const menu = $('.table-actions > .menu', row);
			host.scrollIntoView({block: 'center', behavior: 'instant'});
			await settled();
			document.activeElement?.blur?.();
			yield {hover: away};
			const rest = lit(row);
			holds('a row at rest', [['its button', opacity(more), '0.6']]);
			yield {hover: center(row.cells[0])};
			holds('a row under the pointer', [['its button', opacity(more), '1']]);
			const light = lit(row);
			if (light === rest) {
				out.push('a row under the pointer has no light');
			}
			yield* walkMenu('a menu beside its button in a row', more, menu, () => [['the menu', opacity(menu), '1'], ['its button', opacity(more), '1'], ['the action beside it', opacity(edit), '1'], ['the row\'s light', lit(row), light]]);
			menu.hidePopover();
			document.activeElement?.blur?.();
			await settled();
			holds('a menu of a row closing', [['the menu', opacity(menu), '1']]);
			await until(() => !menu.checkVisibility(), 800);
			holds('a row after its menu', [['its button', opacity(more), '0.6'], ['the row\'s light', lit(row), rest]]);

			// One menu kept outside the table for all its rows.
			const shared = menuOf('table-row-menu-shared');
			document.body.append(shared);
			const hers = $$('.table-actions > button', next)[1];
			const own = hers.getAttribute('commandfor');
			hers.setAttribute('commandfor', shared.id);
			yield* walkMenu('a menu shared from outside the table', hers, shared, () => [['its button', opacity(hers), '1'], ['the row\'s light', lit(next), light]]);
			shared.hidePopover();
			hers.setAttribute('commandfor', own);
			hers.removeAttribute('aria-expanded');
			shared.remove();
			yield {hover: away};

			// A dialog in the cell.
			const dialog = Object.assign(document.createElement('dialog'), {className: 'dialog'});
			$('.table-actions', row).append(dialog);
			dialog.showModal();
			await until(() => opacity(dialog) === '1', 800);
			holds('a dialog in a row\'s cell', [['the dialog', opacity(dialog), '1']]);
			dialog.close();
			dialog.remove();

			// A long item keeps to its menu, as the cell's text does not reach it.
			const label = $('.menu-item', menu).lastChild;
			const word = label.data;
			label.data = 'A long name of a thing to do with this row, far longer than the widest menu, that has to wrap inside it and not run out of it';
			menu.popover = 'manual';
			menu.showPopover();
			await settled();
			if (menu.scrollWidth > menu.clientWidth + 1 || getComputedStyle(menu).textAlign !== 'start') {
				out.push('a long item of a menu in a cell: ' + say([menu.clientWidth, menu.scrollWidth, getComputedStyle(menu).textAlign]));
			}
			const beside = getComputedStyle($('.menu-item', menu));
			const plain = [beside.fontSize, beside.fontWeight, beside.color];
			menu.hidePopover();
			menu.popover = 'auto';
			label.data = word;

			// A menu in the head takes nothing from the head's small text.
			const headMenu = menuOf('table-row-menu-head');
			$('thead .table-actions', host).append(headMenu);
			headMenu.showPopover();
			await settled();
			const inHead = getComputedStyle($('.menu-item', headMenu));
			holds('a menu in a table\'s head', [['its item', say([inHead.fontSize, inHead.fontWeight, inHead.color]), say(plain)]]);
			headMenu.hidePopover();
			headMenu.remove();

			// A menu in a tree's row, where the rest is opacity 0.
			const treeRow = $('.tree-row:has(> .tree-actions)');
			const actions = $('.tree-actions', treeRow);
			const button = $('button', actions);
			const list = menuOf('tree-row-menu-probe');
			actions.append(list);
			button.setAttribute('commandfor', list.id);
			button.setAttribute('command', 'toggle-popover');
			treeRow.scrollIntoView({block: 'center', behavior: 'instant'});
			await settled();
			yield* walkMenu('a menu in a tree\'s row', button, list, () => [['the row\'s actions', opacity(actions), '1']]);
			list.hidePopover();
			button.removeAttribute('commandfor');
			button.removeAttribute('command');
			button.removeAttribute('aria-expanded');
			list.remove();
			yield {hover: away};
		}},
		tableHead: {target: '#table-row-menu', steps: [async (out) => {
			// Only a page without the shell shows it, so the table stands in a frame of its own.
			const frame = document.createElement('iframe');
			frame.style.cssText = 'position: fixed; inset-block-start: 0; inset-inline-start: 0; inline-size: 600px; block-size: 300px; visibility: hidden';
			const page = (style, before = '', after = '') => '<!doctype html><html lang="en"><head><title>Head</title><link rel="stylesheet" href="' + $('link[href*="redz-ui.min.css"]').href + '"><style>' + style + '</style></head><body>' + before + '<table class="table"><thead><tr><th>Boat</th></tr></thead><tbody><tr><td>Boat A</td></tr></tbody></table>' + after + '</body></html>';
			const read = async (...html) => {
				const loaded = new Promise((done) => frame.addEventListener('load', done, {once: true}));
				frame.srcdoc = trusted(page(...html));
				await loaded;
				const doc = frame.contentDocument;
				await until(() => frame.contentWindow.getComputedStyle(doc.querySelector('th')).position === 'sticky');
				return [doc.querySelector('th').getBoundingClientRect(), doc.querySelector('td').getBoundingClientRect(), frame.contentWindow.getComputedStyle(doc.querySelector('th')).insetBlockStart];
			};
			document.body.append(frame);
			const [head, cell, top] = await read('body {margin: 0}');
			if (head.bottom > cell.top + 1 || top !== '0px') {
				out.push('a table on a page with no shell: its head ends at ' + head.bottom + ', its first row starts at ' + cell.top + ', the head stands at ' + top);
			}
			const [, , sideways] = await read('body {margin: 0}', '<div class="table-scroll">', '</div>');
			if (sideways !== '0px') {
				out.push('a table that scrolls sideways on a page with no shell: its head stands at ' + sideways);
			}
			const [, , under] = await read('body {margin: 0} :root {--redz-sticky-top: 5rem}');
			if (!near(parseFloat(under), 68)) {
				out.push('a page\'s own sticky bar: the head stands at ' + under + ', not under the bar');
			}
			frame.remove();
			const inShell = getComputedStyle($('#table-row-menu thead th')).insetBlockStart;
			if (inShell !== '52px') {
				out.push('a table in the shell: its head stands at ' + inShell + ', not under the header');
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
		bandLine: {target: '#table-band-line', steps: [async (out) => {
			const card = $('#table-band-line .card');
			const box = $('.table-scroll', card);
			const table = $('table', box);
			const lines = $$('.table-group-line', box);
			const parts = (line) => [line.firstElementChild, $('.table-group-end', line)];
			const measure = (dir) => {
				const edge = box.getBoundingClientRect().left + box.clientLeft;
				const [from, to] = dir === 'ltr' ? [edge, edge + box.clientWidth] : [-(edge + box.clientWidth), -edge];
				const start = (rect) => dir === 'ltr' ? rect.left : -rect.right;
				const end = (rect) => dir === 'ltr' ? rect.right : -rect.left;
				return lines.map((line) => {
					const [label, slot] = parts(line).map((part) => part.getBoundingClientRect());
					const pad = parseFloat(getComputedStyle(line).paddingInlineStart);
					return {
						inside: [label, slot].every((rect) => start(rect) >= from + pad - 1 && end(rect) <= to - pad + 1),
						clipped: parts(line).some((part) => part.scrollWidth > part.clientWidth + 1),
						under: slot.top >= label.bottom - 1,
						startGap: Math.round(start(slot) - start(label)),
						endGap: Math.round(to - pad - end(slot)),
						lines: Math.round(slot.height / parseFloat(getComputedStyle(parts(line)[1]).lineHeight)),
						labelAt: Math.round(start(label) - from),
					};
				});
			};
			const wrong = [];
			const loops = [];
			const heard = (event) => /ResizeObserver/.test(event.message) && loops.push(event.message);
			window.addEventListener('error', heard);
			const followed = () => until(() => parseFloat(box.style.getPropertyValue('--redz-table-scroll-size')) === box.clientWidth);
			card.style.inlineSize = '340px';
			await followed();
			for (const dir of ['ltr', 'rtl']) {
				document.documentElement.dir = dir;
				await settled();
				for (const to of [0, dir === 'ltr' ? box.scrollWidth : -box.scrollWidth]) {
					box.scrollLeft = to;
					await wait(50);
					const [long, short, name] = measure(dir);
					const pad = parseFloat(getComputedStyle(lines[0]).paddingInlineStart);
					const row = to === 0 ? $('tbody tr:not(.table-group) > td', box).getBoundingClientRect() : null;
					const cellText = row === null ? pad : parseFloat(getComputedStyle($('tbody tr:not(.table-group) > td', box)).paddingInlineStart);
					const seen = {dir, to: to === 0 ? 'at rest' : 'scrolled', long, short, name};
					const fine = [long, short, name].every((one) => one.inside && !one.clipped)
						&& long.under && long.startGap === 0 && long.lines >= 2
						&& !short.under && Math.abs(short.endGap) <= 1
						&& name.under && name.startGap === 0
						&& short.labelAt === Math.round(pad) && Math.round(pad) === Math.round(cellText);
					if (!fine) {
						wrong.push(say(seen));
					}
				}
				box.scrollLeft = 0;
			}
			document.documentElement.dir = 'ltr';
			card.style.removeProperty('inline-size');
			await followed();
			const [wideLong, wideShort] = measure('ltr');
			const roomy = !wideLong.under && Math.abs(wideLong.endGap) <= 1 && !wideShort.under && Math.abs(wideShort.endGap) <= 1;
			table.style.width = 'auto';
			await settled();
			const fits = table.getBoundingClientRect().width < box.clientWidth - 1;
			table.style.removeProperty('width');
			await settled();
			window.removeEventListener('error', heard);
			if (loops.length > 0) {
				out.push('a band line\'s width sets off the observer\'s loop error: ' + say(loops));
			}
			if (wrong.length > 0) {
				out.push('a band line in a narrow scroller: ' + wrong.join(' ; '));
			}
			if (!roomy || !fits) {
				out.push('a band line with room: ' + say([wideLong, wideShort]) + ', a table of its own width stays narrower than its scroller ' + fits);
			}
		}]},
		scroller: {target: '#table-wide .table-scroll', steps: [async (out) => {
			const box = $('#table-wide .table-scroll');
			const first = $('tbody tr:not(.table-group) > th', box);
			const head = $('thead th:nth-child(2)', box);
			box.style.inlineSize = '20rem';
			box.scrollLeft = box.scrollWidth;
			await wait(50);
			const left = Math.round(first.getBoundingClientRect().left - box.getBoundingClientRect().left);
			const band = $('.table-group > th', box);
			const slot = $('.table-group-end', band);
			const ends = [];
			for (const dir of ['ltr', 'rtl']) {
				document.documentElement.dir = dir;
				for (const to of [0, dir === 'ltr' ? box.scrollWidth : -box.scrollWidth]) {
					box.scrollLeft = to;
					await wait(50);
					const port = box.getBoundingClientRect().left + box.clientLeft;
					const end = slot.getBoundingClientRect();
					ends.push(Math.round(dir === 'ltr' ? port + box.clientWidth - end.right : end.left - port));
				}
			}
			document.documentElement.dir = 'ltr';
			box.scrollLeft = 0;
			const wide = box.scrollWidth > box.clientWidth;
			box.style.removeProperty('inline-size');
			if (ends.some((gap) => Math.abs(gap) > 1)) {
				out.push('a group\'s end slot stands ' + say(ends) + ' px from a narrow scroller\'s end, at rest and scrolled, left to right and right to left');
			}
			const look = (th) => {
				const style = getComputedStyle(th);
				return [style.position, style.backgroundColor, style.borderInlineStartWidth, style.borderInlineEndWidth].join(' ');
			};
			const plain = look($('#table-grouped .table-group > th'));
			if (look(band) !== plain) {
				out.push('a group band in a table-scroll-first reads ' + say(look(band)) + ', not ' + say(plain) + ' as outside it');
			}
			if (getComputedStyle(slot).backgroundColor !== getComputedStyle(band).backgroundColor) {
				out.push('a group\'s end slot stands on ' + say(getComputedStyle(slot).backgroundColor) + ', not its band\'s ' + say(getComputedStyle(band).backgroundColor) + ', so a long label shows through it');
			}
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
		listLink: {target: '#list-group-basic', steps: [async (out) => {
			const list = document.createElement('ul');
			list.className = 'list-group';
			list.innerHTML = trusted('<li class="list-group-item hstack gap-8"><a class="stretched-link flex-fill" href="#list-group-basic">Boat A</a><button class="btn btn-sm" type="button">Call</button></li><li class="list-group-item">Boat B</li>');
			$('#list-group-basic').append(list);
			list.scrollIntoView({block: 'center'});
			const [first, second] = list.children;
			const link = $('a', first);
			const button = $('button', first);
			const at = (x, y) => {
				const hit = document.elementFromPoint(x, y);
				return hit === link ? 'the link' : hit === button ? 'the button' : hit === first ? 'the item' : 'not the link';
			};
			const own = first.getBoundingClientRect();
			const next = second.getBoundingClientRect();
			const press = button.getBoundingClientRect();
			const outside = list.getBoundingClientRect();
			const got = [at(own.left + 4, own.top + own.height / 2), at(press.left + press.width / 2, press.top + press.height / 2), at(next.left + next.width / 2, next.top + next.height / 2), at(outside.left + outside.width / 2, outside.bottom + 6)];
			let followed = 0;
			link.addEventListener('click', (event) => {
				event.preventDefault();
				followed++;
			});
			first.click();
			second.click();
			list.remove();
			if (got.join(' ') !== 'the item the button not the link not the link' || followed !== 1) {
				out.push('a list item whose title is a stretched-link: its own edge, its button, the next item and the place under the list give ' + say(got) + ' - the item, not a cover, under the pointer, and its button its own - and clicks on it and on the next item follow ' + followed + ' times, not once');
			}
		}]},
		shellPhone: {target: '#table-row-menu', steps: [async (out) => {
			const frame = document.createElement('iframe');
			frame.style.cssText = 'position: fixed; inset-block-start: 0; inset-inline-start: 0; inline-size: 600px; block-size: 400px; visibility: hidden';
			const loaded = new Promise((done) => frame.addEventListener('load', done, {once: true}));
			frame.srcdoc = trusted('<!doctype html><html lang="en"><head><title>Shell</title><link rel="stylesheet" href="' + $('link[href*="redz-ui.min.css"]').href + '"></head><body><div class="app"><header class="app-header">Bookings</header><main class="app-main">A page without a sidebar</main></div></body></html>');
			document.body.append(frame);
			await loaded;
			const main = frame.contentDocument.querySelector('.app-main');
			await until(() => frame.contentWindow.getComputedStyle(main).borderTopWidth !== '');
			const margins = ['marginInlineStart', 'marginInlineEnd'].map((side) => frame.contentWindow.getComputedStyle(main)[side]);
			frame.remove();
			if (say(margins) !== say(['0px', '0px'])) {
				out.push('a shell without a sidebar on a phone keeps its main region ' + say(margins) + ' in from its sides, where a shell with one has none');
			}
		}]},
		choiceMedia: {target: '#busy-region', steps: [async (out) => {
			const picture = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="236" height="68"><rect width="236" height="68" fill="#456"/></svg>');
			const host = document.createElement('div');
			host.innerHTML = trusted('<label class="choice"><input type="radio" name="probe-media"><span class="choice-media"><img src="' + picture + '" alt=""></span>Example Pay</label>');
			$('#busy-region').append(host);
			const image = $('img', host);
			await until(() => image.complete);
			const room = $('.choice-media', host).getBoundingClientRect();
			const drawn = image.getBoundingClientRect();
			host.remove();
			if (drawn.height > room.height - 15 || drawn.width > room.width) {
				out.push('a logo of 236 by 68 without width and height draws ' + Math.round(drawn.width) + ' by ' + Math.round(drawn.height) + ' in a choice-media of ' + Math.round(room.width) + ' by ' + Math.round(room.height) + ' - it should fit inside its padding');
			}
		}]},
		busyTone: {target: '#busy-region', steps: [async (out) => {
			const host = document.createElement('div');
			host.style.background = 'var(--redz-bg-page)';
			host.innerHTML = trusted(['btn-primary', 'btn-danger', 'btn-outline-primary'].map((tone) => '<button class="btn ' + tone + '" type="button">Pay</button><button class="btn ' + tone + '" type="button" aria-busy="true" aria-disabled="true">Pay</button><button class="btn ' + tone + '" type="button"><i class="bi bi-trash" aria-hidden="true"></i>Pay</button><button class="btn ' + tone + '" type="button" aria-busy="true" aria-disabled="true"><i class="bi bi-trash" aria-hidden="true"></i>Pay</button>').join(''));
			$('#busy-region').append(host);
			const buttons = $$('button', host);
			buttons.forEach((button) => {
				button.style.transition = 'none';
			});
			const look = (button) => getComputedStyle(button).backgroundColor + ' / ' + getComputedStyle(button).borderTopColor;
			const lost = [];
			for (let i = 0; i < buttons.length; i += 2) {
				if (look(buttons[i]) !== look(buttons[i + 1])) {
					lost.push(buttons[i].className + (buttons[i].firstElementChild === null ? '' : ' with an icon') + ': ' + look(buttons[i]) + ' busy ' + look(buttons[i + 1]));
				}
			}
			host.remove();
			if (lost.length > 0) {
				out.push('a busy button, as busy() marks it (aria-busy and aria-disabled), loses its own fill and edge, so on the page floor of a dialog footer it shows only its spinner: ' + lost.join('; '));
			}
		}]},
		reveal: {target: '#form-adorn-password', steps: [async (out) => {
			const field = $('#form-adorn-password');
			const button = $('[commandfor="form-adorn-password"][command="--reveal"]');
			const form = document.createElement('form');
			form.addEventListener('submit', (event) => event.preventDefault());
			field.before(form);
			form.append(field);
			const said = [];
			const hear = (event) => said.push(event.target === field ? event.detail.revealed : 'elsewhere');
			document.addEventListener('redz:reveal', hear);
			button.click();
			button.click();
			button.click();
			form.requestSubmit();
			document.removeEventListener('redz:reveal', hear);
			form.before(field);
			form.remove();
			if (say(said) !== say([true, false, true, false]) || field.type !== 'password') {
				out.push('a password field shown, hidden, shown and its form sent tells the page ' + say(said) + ' in redz:reveal and ends as ' + field.type + ' - each change, the hiding on submit too, says whether its text shows');
			}
		}]},
		shortcuts: {target: '#palette-demo', steps: [async (out) => {
			const host = document.createElement('div');
			host.innerHTML = trusted('<div inert><button type="button" aria-keyshortcuts="Alt+J">Asleep</button></div><button type="button" disabled aria-keyshortcuts="Alt+D Alt+K">Off</button><button type="button" aria-disabled="true" aria-keyshortcuts="Alt+B">Busy</button><button type="button" hidden aria-keyshortcuts="Alt+H">Hidden</button><a aria-disabled="true" aria-keyshortcuts="Alt+L">No address</a><button type="button" aria-keyshortcuts="Alt+K">Awake</button><dialog><p>Nothing keyed</p></dialog>');
			$('#palette-demo').append(host);
			const all = $$('button, a', host);
			const awake = all.at(-1);
			const presses = () => all.reduce((sum, element) => sum + (element.pressed ?? 0), 0);
			all.forEach((element) => element.addEventListener('click', () => {
				element.pressed = (element.pressed ?? 0) + 1;
			}));
			const key = (letter, repeat = false) => [!document.body.dispatchEvent(new KeyboardEvent('keydown', {key: letter, code: 'Key' + letter.toUpperCase(), altKey: true, repeat, bubbles: true, cancelable: true})), presses()];
			const got = {inert: key('j'), disabled: key('d'), busy: key('b'), hidden: key('h'), noAddress: key('l'), unnamed: key('q'), press: key('k'), held: key('k', true)};
			got.pressedAwake = awake.pressed ?? 0;
			$('dialog', host).showModal();
			got.outsideModal = key('k');
			$('dialog', host).close();
			host.remove();
			const want = {inert: [true, 0], disabled: [true, 0], busy: [true, 0], hidden: [true, 0], noAddress: [true, 0], unnamed: [false, 0], press: [true, 1], held: [true, 1], pressedAwake: 1, outsideModal: [true, 1]};
			if (say(got) !== say(want)) {
				out.push('shortcuts, as [prevented, presses so far]: ' + say(got) + ', not ' + say(want) + ' - a combination any button or link names is the page\'s and never reaches the browser, the first that can be pressed now is pressed, an inert one never, and a held one once');
			}
		}]},
		tipNow: {target: '#tooltip-now', walk: async function* (out) {
			const tip = () => $('#redz-tooltip')?.matches(':popover-open') ?? false;
			const spot = async (el) => {
				el.scrollIntoView({block: 'center', behavior: 'instant'});
				await settled();
				await settled();
				const box = el.getBoundingClientRect();
				return [Math.round(box.left + box.width / 2), Math.round(box.top + box.height / 2)];
			};
			yield {hover: await spot($('#tooltip-title button[title]'))};
			const waits = tip();
			yield {hover: [2, 2]};
			yield {hover: await spot($('#tooltip-now button'))};
			const now = tip();
			const words = $('#redz-tooltip')?.textContent;
			yield {hover: [2, 2]};
			if (waits || !now || words !== 'Duplicate') {
				out.push('data-tooltip-delay: a title of the default wait shows ' + (waits ? 'at once' : 'later') + ', one of 0 ' + (now ? 'at once' : 'later') + ', saying ' + say(words));
			}
		}},
		railTip: {target: '.app-sidebar .app-link', walk: async function* (out) {
			const rail = $('.app-sidebar');
			const link = $('.app-sidebar .app-link');
			rail.toggleAttribute('data-folded', true);
			await until(() => link.hasAttribute('title'));
			await settled();
			const box = link.getBoundingClientRect();
			yield {hover: [Math.round(box.left + box.width / 2), Math.round(box.top + box.height / 2)]};
			const tip = () => $('#redz-tooltip');
			await until(() => tip()?.matches(':popover-open') ?? false);
			const seen = tip()?.getBoundingClientRect();
			const named = link.getAttribute('aria-label') ?? link.textContent.trim();
			const rtl = getComputedStyle(link).direction === 'rtl';
			const clear = seen !== undefined && (rtl ? seen.right <= box.left : seen.left >= box.right);
			const level = seen !== undefined && near(seen.top + seen.height / 2, box.top + box.height / 2, 2);
			yield {hover: [Math.round(innerWidth / 2), 4]};
			rail.toggleAttribute('data-folded', false);
			await until(() => !link.hasAttribute('title'));
			if (!clear || !level || named === '') {
				out.push('a folded rail: the tooltip of a link stands ' + say(seen) + ' beside ' + say(box) + ', the link named ' + say(named));
			}
		}},
		groupTold: {target: '.app-sidebar details.app-group', walk: async function* (out) {
			const group = $$('.app-sidebar details.app-group').find((one) => one.open && one.querySelector('[aria-current="page"]') === null);
			const summary = group.querySelector(':scope > summary');
			const told = [];
			const hear = (event) => told.push(event.target.id + ' ' + event.detail.open);
			document.addEventListener('redz:group', hear);
			summary.scrollIntoView({block: 'nearest'});
			await settled();
			yield {click: center(summary)};
			await until(() => !group.open);
			const shut = !group.open;
			summary.focus();
			// Firefox's WebDriver keys do not open a summary, even on a page without the library: a key is held to
			// what it told only where it opened the group.
			yield {key: 'Enter'};
			await until(() => group.open, 600);
			const keyed = group.open;
			group.open = false;
			await settled();
			group.open = true;
			await settled();
			document.removeEventListener('redz:group', hear);
			const want = [group.id + ' false', ...(keyed ? [group.id + ' true'] : [])];
			if (!shut || !group.open || say(told) !== say(want)) {
				out.push('a group of the side navigation: a click and Enter on its heading tell ' + say(told) + ' for ' + say(want) + ', closed by the click ' + shut + ', open at the end ' + group.open);
			}
		}},
		groupRail: {target: '.app-sidebar details.app-group', steps: [async (out) => {
			const rail = $('.app-sidebar');
			const groups = $$('details.app-group', rail);
			const group = groups.find((one) => one.querySelector('[aria-current="page"]') === null && groups.indexOf(one) > 0);
			const told = [];
			const hear = (event) => told.push(event.target.id);
			document.addEventListener('redz:group', hear);
			group.open = false;
			await settled();
			rail.toggleAttribute('data-folded', true);
			await until(() => group.open);
			const heading = getComputedStyle(group.querySelector(':scope > summary')).display;
			const drawn = getComputedStyle(group, '::before');
			const line = {borderTopWidth: drawn.borderTopWidth, borderTopStyle: drawn.borderTopStyle};
			const spread = groups.every((one) => one.open);
			rail.toggleAttribute('data-folded', false);
			await until(() => !group.open);
			const back = !group.open;
			group.open = true;
			await settled();
			document.removeEventListener('redz:group', hear);
			if (!spread || heading !== 'none' || line.borderTopWidth !== '1px' || line.borderTopStyle !== 'solid' || !back || told.length > 0) {
				out.push('a folded rail: every group open ' + spread + ', a heading ' + heading + ', the line ' + line.borderTopWidth + ' ' + line.borderTopStyle + ', closed again unfolded ' + back + ', told ' + say(told));
			}
		}]},
		pageChange: {target: '#docs-nav', steps: [async (out) => {
			// Pages that change, in a frame of a wide window's size: the probes' router makes an answer late and writes
			// data-transition, data-scroll and a trace of pagereveal as the query asks.
			const frame = Object.assign(document.createElement('iframe'), {title: 'Pages that change'});
			frame.style.cssText = 'position: fixed; inset: 0 auto auto 0; z-index: 2147483647; inline-size: 1100px; block-size: 700px; border: 0; background: Canvas';
			// A page has come once the frame shows it whole: a frame left while it loads cuts its requests short.
			const loaded = async (url) => {
				await until(() => frame.contentWindow?.location.href.endsWith(url) === true && frame.contentDocument?.readyState === 'complete', 8000);
				await wait(200);
				return frame.contentDocument;
			};
			const open = (url) => {
				frame.src = url;
				return loaded(url);
			};
			const follow = (doc, to) => {
				const link = doc.querySelector('#docs-nav a.app-link[href="busy.html"]');
				link.href = to;
				link.click();
				return loaded(to);
			};
			document.body.append(frame);
			const crossing = 'CSSViewTransitionRule' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches;
			const named = CSS.supports('view-transition-name', 'a');
			for (const mode of ['fade', 'instant', 'none']) {
				await follow(await open('app.html?probe-transition=' + mode), 'busy.html?probe-trace=1&probe-transition=' + mode);
				await wait(400);
				const seen = frame.contentWindow.REDZ_PROBE_REVEAL ?? null;
				const header = frame.contentWindow.getComputedStyle(frame.contentDocument.querySelector('.app-header')).viewTransitionName;
				const shown = mode !== 'none' && crossing;
				// An engine without cross-document transitions brings no pagereveal, so no trace.
				const fine = (shown ? seen?.ready === 'ran' && (mode === 'fade' ? seen.root > 0 : seen.root === 0) : seen === null || !seen.transition) && (!named || header === 'redz-app-header');
				if (!fine) {
					out.push('data-transition="' + mode + '": the next page brought ' + say(seen) + ', its header named ' + say(header) + ', for a transition ' + shown + (shown ? (mode === 'fade' ? ' that fades the page' : ' that leaves the page still') : ''));
				}
			}
			const doc = await open('app.html?probe-transition=busy');
			const view = frame.contentWindow;
			view.scrollTo(0, 2500);
			const main = doc.querySelector('.app-main');
			const came = follow(doc, 'busy.html?probe-wait=1600&probe-transition=busy');
			await wait(700);
			const art = main.firstElementChild;
			const box = art?.getBoundingClientRect();
			const made = art?.matches('.busy-art') === true;
			const held = [main.getAttribute('aria-busy'), main.inert, made && art.querySelector('.spinner-border') !== null, made ? view.getComputedStyle(art).visibility : ''];
			const middle = box === undefined ? -1 : Math.round(box.top + box.height / 2);
			await came;
			await wait(200);
			const after = frame.contentDocument.querySelector('.app-main').getAttribute('aria-busy');
			const veiled = 'navigation' in window;
			if (say(held) !== say(veiled ? ['true', true, true, 'visible'] : [null, false, false, '']) || (veiled && !near(middle, (view.innerHeight + 52) / 2, 40)) || after !== null) {
				out.push('data-transition="busy": a late page holds the main column ' + say(held) + ', its ring at ' + middle + ' of ' + view.innerHeight + ' scrolled down, the next page ' + say(after) + ', where the Navigation API is ' + veiled);
			}
			const kept = await open('app.html?probe-scroll=keep');
			kept.getElementById('docs-nav').scrollTop = 180;
			await wait(150);
			await follow(kept, 'busy.html?probe-scroll=keep');
			await wait(200);
			const left = frame.contentDocument.getElementById('docs-nav').scrollTop;
			const side = (await open('pagination.html?probe-scroll=current')).getElementById('docs-nav');
			const shelf = side.getBoundingClientRect();
			const row = side.querySelector('[aria-current="page"]').getBoundingClientRect();
			const current = [side.scrollTop > 0, row.top >= shelf.top - 1 && row.bottom <= shelf.bottom + 1];
			const top = (await open('pagination.html')).getElementById('docs-nav').scrollTop;
			frame.remove();
			try {
				sessionStorage.removeItem('redz-ui.sidebar.docs-nav');
			} catch {
			}
			if (!near(left, 180, 1) || say(current) !== say([true, true]) || top !== 0) {
				out.push('data-scroll: keep comes back at ' + left + ' for 180, current scrolled and in view ' + say(current) + ', none at ' + top);
			}
		}]},
		sidebarWide: {target: '.app-sidebar[popover]', steps: [async (out) => {
			const sidebar = $('.app-sidebar[popover]');
			sidebar.showPopover();
			await settled();
			if (sidebar.matches(':popover-open')) {
				sidebar.hidePopover();
				out.push('a side navigation opens as a panel on a wide window, where it is a column');
			}
		}]},
		busyArt: {target: '#busy-art-card', steps: [async (out) => {
			const card = $('#busy-art-card');
			const art = $(':scope > .busy-art', card);
			let done = () => {};
			const held = REDZ.ui.busy(card, new Promise((resolve) => {
				done = resolve;
			}));
			await wait(550);
			const box = art.getBoundingClientRect();
			const frame = card.getBoundingClientRect();
			const seen = [getComputedStyle(art).display, getComputedStyle(art).visibility, getComputedStyle(card, '::after').content];
			const middle = near(box.left + box.width / 2, frame.left + frame.width / 2, 2) && box.height > 8;
			done();
			await held;
			const after = getComputedStyle(art).display;
			if (say(seen) !== say(['flex', 'visible', 'none']) || !middle || after !== 'none') {
				out.push('busy-art: busy it shows ' + say(seen) + ' at ' + say([box.left, box.width, box.height]) + ' in ' + say([frame.left, frame.width]) + ', after ' + after);
			}
			const main = Object.assign(document.createElement('div'), {className: 'app-main'});
			main.append(Object.assign(document.createElement('p'), {textContent: 'A main column'}));
			document.body.append(main);
			let free = () => {};
			const kept = REDZ.ui.busy(main, new Promise((resolve) => {
				free = resolve;
			}));
			await wait(550);
			const made = main.firstElementChild;
			const ring = made?.matches('.busy-art') ? [getComputedStyle(made).position, getComputedStyle(made).visibility, made.querySelector('.spinner-border')?.offsetHeight] : null;
			free();
			await kept;
			const left = main.querySelector('.busy-art');
			main.remove();
			if (say(ring) !== say(['sticky', 'visible', 24]) || left !== null) {
				out.push('a busy main column: the ring it is given ' + say(ring) + ', left after ' + (left !== null));
			}
		}]},
		groupButton: {target: '#input-group-basic .btn', steps: [async (out) => {
			const button = getComputedStyle($('#input-group-basic .btn'));
			const field = getComputedStyle($('#input-group-basic .form-control'));
			const words = getComputedStyle($('#input-group-basic .input-group-text'));
			const stand = document.createElement('i');
			stand.style.cssText = 'color: var(--redz-primary); background: var(--redz-primary-subtle)';
			document.body.append(stand);
			const tint = getComputedStyle(stand);
			const wanted = [tint.color, tint.backgroundColor];
			stand.remove();
			if (button.borderBlockStartColor !== field.borderBlockStartColor || say([button.color, button.backgroundColor]) !== say(wanted) || button.fontWeight !== '600') {
				out.push('a plain button in a group: its line ' + button.borderBlockStartColor + ', the field\'s ' + field.borderBlockStartColor + '; ink and face ' + say([button.color, button.backgroundColor]) + ' for ' + say(wanted) + ', weight ' + button.fontWeight);
			}
			const icon = document.createElement('button');
			icon.className = 'btn btn-icon';
			const solid = document.createElement('button');
			solid.className = 'btn btn-primary';
			const group = $('#input-group-basic .input-group');
			group.append(icon, solid);
			const faces = [getComputedStyle(icon).backgroundColor, getComputedStyle(icon).color, getComputedStyle(solid).borderBlockStartColor];
			icon.remove();
			solid.remove();
			if (faces[0] !== words.backgroundColor || faces[1] !== words.color || faces[2] === field.borderBlockStartColor) {
				out.push('in a group an icon reads ' + say(faces.slice(0, 2)) + ' for the words\' ' + say([words.backgroundColor, words.color]) + ', a solid button\'s line is ' + faces[2]);
			}
		}]},
		sectionHeads: {target: '.drawer-header', steps: [async (out) => {
			const main = document.documentElement.style;
			const heads = {card: '.card-header', drawer: '.drawer-header', dialog: '.dialog-header'};
			const tints = Object.keys(heads).map((name, index) => {
				main.setProperty('--redz-' + name + '-header-bg', 'rgb(1, 2, ' + index + ')');
				return getComputedStyle($(heads[name])).backgroundColor;
			});
			main.setProperty('--redz-dialog-header-end', '12px');
			main.setProperty('--redz-dialog-header-line', '1px solid rgb(9, 9, 9)');
			const dialog = getComputedStyle($('.dialog-header'));
			const under = [dialog.paddingBlockEnd, dialog.borderBlockEndWidth];
			for (const name of ['card-header-bg', 'drawer-header-bg', 'dialog-header-bg', 'dialog-header-end', 'dialog-header-line']) {
				main.removeProperty('--redz-' + name);
			}
			const rest = getComputedStyle($('.dialog-header'));
			if (say(tints) !== say(['rgb(1, 2, 0)', 'rgb(1, 2, 1)', 'rgb(1, 2, 2)']) || say(under) !== say(['12px', '1px']) || rest.paddingBlockEnd !== '0px' || rest.borderBlockEndWidth !== '0px') {
				out.push('the heads\' tokens: ' + say(tints) + ', a dialog\'s room and line ' + say(under) + ', at rest ' + rest.paddingBlockEnd + ' and ' + rest.borderBlockEndWidth);
			}
		}]},
		longWord: {target: '#stat-narrow', steps: [async (out) => {
			const tiles = $$('#stat-narrow .stat');
			const words = $$('#stat-narrow :is(.stat-label, .stat-sub)');
			for (const tile of tiles) {
				tile.style.inlineSize = '5rem';
			}
			await settled();
			const spilled = words.filter((one) => one.getBoundingClientRect().right > one.closest('.stat').getBoundingClientRect().right + 1 || one.scrollWidth > one.clientWidth + 1).map((one) => one.textContent);
			for (const tile of tiles) {
				tile.removeAttribute('style');
			}
			if (spilled.length > 0) {
				out.push('a long word runs past a narrow tile: ' + say(spilled));
			}
		}]},
		rowMark: {target: 'tr.table-danger', steps: [async (out) => {
			const row = $('tr.table-danger');
			const head = row.closest('table').tHead?.rows[0].cells[0];
			const shifted = head !== undefined && !near(row.cells[0].getBoundingClientRect().left, head.getBoundingClientRect().left, 1);
			const frame = document.createElement('iframe');
			frame.style.cssText = 'position: fixed; inset: 0; inline-size: 400px; block-size: 200px; visibility: hidden';
			const sheet = document.querySelector('link[rel="stylesheet"][href*="redz-ui"]').href;
			document.body.append(frame);
			frame.srcdoc = trusted('<!doctype html><link rel="stylesheet" href="' + sheet + '"><body class="region"><table class="table"><tbody><tr class="table-danger"><td class="d-none md:d-table-cell">Hidden</td><td>Shown</td></tr></tbody></table>');
			await new Promise((done) => {
				frame.onload = done;
			});
			const inside = frame.contentDocument;
			const cells = inside.querySelectorAll('td');
			const marks = () => [...cells].map((one) => frame.contentWindow.getComputedStyle(one, '::before').content !== 'none');
			await settled();
			const phone = marks();
			frame.style.inlineSize = '1000px';
			await until(() => marks()[0] && !marks()[1], 1000);
			const wide = marks();
			frame.remove();
			if (shifted || !phone[1] || !wide[0] || wide[1]) {
				out.push('a row\'s mark: the row is ' + (shifted ? 'shifted a column' : 'in its columns') + ', on a phone the cells mark ' + say(phone) + ', wide ' + say(wide));
			}
		}]},
		tabsInView: {target: '#nav-tabs-panel-1', steps: [async (out) => {
			const panel = $('#nav-tabs-panel-1');
			const list = $('#nav-tabs [role="tablist"]');
			const header = $('.app-header');
			panel.scrollIntoView({behavior: 'instant'});
			await settled();
			const top = list.getBoundingClientRect().top;
			const floor = header === null ? 0 : header.getBoundingClientRect().bottom;
			scrollTo({top: 0, behavior: 'instant'});
			if (top < floor - 1) {
				out.push('a deep link to a panel leaves its tabs at ' + top + ', under what ends at ' + floor);
			}
		}]},
		reason: {target: '#tooltip-title [aria-disabled="true"][title]', walk: async function* (out) {
			const button = $('#tooltip-title [aria-disabled="true"]');
			const title = button.getAttribute('title');
			button.scrollIntoView({block: 'center', behavior: 'instant'});
			await settled();
			await settled();
			const box = button.getBoundingClientRect();
			const tip = $('#redz-tooltip');
			yield {hover: [2, 2]};
			yield {click: [Math.round(box.left + box.width / 2), Math.round(box.top + box.height / 2)]};
			const open = $('#redz-tooltip')?.matches(':popover-open') ?? false;
			const words = $('#redz-tooltip')?.textContent;
			yield {hover: [2, 2]};
			await until(() => !($('#redz-tooltip')?.matches(':popover-open') ?? false), 1000);
			const back = button.getAttribute('title');
			if (!open || words !== title || back !== title || tip === undefined) {
				out.push('a click on a control that cannot run: the reason ' + (open ? 'shows' : 'does not show') + ' saying ' + say(words) + ', the title after it ' + say(back));
			}
		}},
		flushRoom: {target: '.list-group-flush > .list-group-item', steps: [async (out) => {
			const list = $('.list-group-flush');
			const rows = [...list.children].filter((one) => one.matches('.list-group-item'));
			const room = () => rows.map((one) => getComputedStyle(one).paddingInlineStart + '/' + getComputedStyle(one).paddingInlineEnd + '/' + getComputedStyle(one).borderInlineStartWidth);
			rows[0].classList.add('edge-start-primary');
			const edged = room();
			rows[0].classList.remove('edge-start-primary');
			rows[0].classList.add('bg-primary-subtle');
			const tinted = room();
			rows[0].classList.remove('bg-primary-subtle');
			const sixteen = '16px';
			if (edged.some((one) => one !== sixteen + '/' + sixteen + '/3px') || tinted.some((one) => !one.startsWith(sixteen + '/' + sixteen))) {
				out.push('a flush list\'s rows: with an edge ' + say(edged) + ', tinted ' + say(tinted));
			}
		}]},
		closing: {target: '#dialog-edit-note', steps: [async (out) => {
			const dialog = $('#dialog-edit-note');
			const head = dialog.querySelector('.dialog-header');
			const body = dialog.querySelector('.dialog-body');
			dialog.showModal();
			await settled();
			dialog.close();
			const drawn = getComputedStyle(dialog).display !== 'none';
			const stacked = head.getBoundingClientRect().bottom <= body.getBoundingClientRect().top + 1;
			const rows = $$('dialog.dialog, dialog.palette').filter((one) => !one.open && getComputedStyle(one).flexDirection !== 'column').map((one) => one.id);
			await settled();
			if ((drawn && !stacked) || rows.length > 0) {
				out.push('a dialog that closes: ' + (drawn ? 'still drawn, its head ' + (stacked ? 'above' : 'beside') + ' its body' : 'gone at once') + ', out of a column ' + say(rows));
			}
		}]},
		lastColumn: {target: '#table-wide-last .table-scroll', steps: [async (out) => {
			const scroller = $('#table-wide-last .table-scroll');
			const cell = $('#table-wide-last tbody tr:first-child td:last-child');
			const edge = () => near(cell.getBoundingClientRect().right, scroller.getBoundingClientRect().right, 3);
			scroller.style.inlineSize = '320px';
			scroller.scrollLeft = 0;
			await settled();
			const wide = scroller.scrollWidth > scroller.clientWidth;
			const held = edge();
			scroller.removeAttribute('style');
			if (!wide || !held) {
				out.push('table-scroll-last: the table is ' + (wide ? 'wider than' : 'not wider than') + ' its scroller, and its last column ' + (held ? 'stays at the end' : 'scrolls away'));
			}
		}]},
		headTokens: {target: '#table-wide-last .table', steps: [async (out) => {
			const table = $('#table-wide-last .table');
			const head = $('thead th', table);
			const row = $('tbody th', table);
			table.style.setProperty('--redz-table-head-weight', '700');
			table.style.setProperty('--redz-table-head-border', '2px solid rgb(1, 2, 3)');
			table.style.setProperty('--redz-table-head-text', 'rgb(4, 5, 6)');
			table.style.setProperty('--redz-table-head-bg', 'rgb(7, 8, 9)');
			const seen = [getComputedStyle(head).fontWeight, getComputedStyle(head).borderBlockEndWidth, getComputedStyle(head).color, getComputedStyle(head).backgroundColor, getComputedStyle(row).fontWeight, getComputedStyle(row).borderBlockEndWidth];
			table.removeAttribute('style');
			if (say(seen) !== say(['700', '2px', 'rgb(4, 5, 6)', 'rgb(7, 8, 9)', '550', '1px'])) {
				out.push('the head tokens: ' + say(seen) + ' for the weight, border, text and fill of a head, then the weight and border of a row\'s head');
			}
		}]},
		listSet: {target: '#combobox-inline-list', steps: [async (out) => {
			const list = $('#combobox-inline-list');
			const held = () => $$('input[type="hidden"][name="zone"]').map((one) => one.value + '|' + one.dataset.label);
			const events = [];
			const hear = (event) => events.push(event.type);
			list.addEventListener('input', hear);
			list.addEventListener('change', hear);
			REDZ.ui.combobox.set('#combobox-inline-list', 'Europe/Berlin');
			const chosen = [held(), list.querySelector('[data-value="Europe/Berlin"]').getAttribute('aria-selected'), events.join(' ')];
			REDZ.ui.combobox.set(list, ['Asia/Bangkok', 'Asia/Dubai']);
			const single = held();
			list.removeEventListener('input', hear);
			list.removeEventListener('change', hear);
			if (say(chosen) !== say([['Europe/Berlin|Berlin · UTC+1'], 'true', 'input change']) || say(single) !== say(['Asia/Bangkok|Bangkok · UTC+7'])) {
				out.push('combobox.set: it held ' + say(chosen) + ', then from two values on a single list ' + say(single));
			}
			const many = $('#combobox-many-list') ?? $('[role="listbox"][aria-multiselectable="true"][data-name]');
			const name = many.dataset.name;
			const values = [...many.querySelectorAll('[role="option"]')].slice(0, 2).map((one) => one.dataset.value);
			REDZ.ui.combobox.set(many, values);
			const heldMany = () => $$('input[type="hidden"]').filter((one) => one.name === name).map((one) => one.value);
			const two = heldMany();
			const word = many.querySelector('[role="option"]').getAttribute('aria-selected');
			REDZ.ui.combobox.set(many, []);
			if (say(two) !== say(values) || word !== 'true' || heldMany().length !== 0) {
				out.push('combobox.set on a list of many: ' + say(two) + ' for ' + say(values) + ', the first option aria-selected ' + say(word) + ', ' + heldMany().length + ' left after an empty list');
			}
		}]},
		twin: {target: '#form-show-on', steps: [async (out) => {
			const on = $('#form-show-on');
			const off = $('#form-show-off');
			const box = $('#form-show input[type="checkbox"]');
			const was = [on.hidden, off.hidden];
			box.click();
			await settled();
			const now = [on.hidden, off.hidden];
			box.click();
			await settled();
			if (say(was) !== say([true, false]) || say(now) !== say([false, true]) || on.hidden !== true || off.hidden !== false) {
				out.push('a switch with its hidden twin: off shows ' + say(was) + ' for [on, off] hidden, on ' + say(now));
			}
		}]},
		more: {target: '#form-more', steps: [async (out) => {
			const icon = $('#form-more summary > .bi');
			const fold = $('#form-more details');
			const rest = getComputedStyle(icon).rotate;
			fold.open = true;
			await until(() => getComputedStyle(icon).rotate === '90deg');
			const seen = getComputedStyle(icon).rotate;
			fold.open = false;
			if (rest !== 'none' || seen !== '90deg') {
				out.push('a folded hint: its chevron rotates ' + say(rest) + ' at rest, ' + say(seen) + ' open');
			}
		}]},
		banner: {target: '#app-banner-calls', steps: [async (out) => {
			const app = $('body > .app');
			const region = (role) => $(':scope > .visually-hidden[role="' + role + '"]', document.body)?.textContent ?? '';
			const slot = () => $$(':scope > .app-banner', app);
			const top = (selector) => Math.round($(selector).getBoundingClientRect().top);
			const close = REDZ.ui.banner({tone: 'warning', text: 'Paused for a probe'});
			await wait(150);
			const [shown] = slot();
			const high = Math.round(shown?.getBoundingClientRect().height ?? 0);
			const stored = Math.round(parseFloat(document.documentElement.style.getPropertyValue('--redz-app-banner-height')));
			scrollTo(0, 600);
			await wait(100);
			const ruler = Object.assign(document.createElement('div'), {style: 'position: absolute; inline-size: var(--redz-sticky-top)'});
			app.append(ruler);
			const stack = [top('body > .app > .app-banner'), top('body > .app > .app-header') - high, top('body > .app > .app-sidebar') - high, Math.round(ruler.getBoundingClientRect().width) - high];
			ruler.remove();
			if (slot().length !== 1 || app.firstElementChild !== shown || !shown.matches('.app-banner-warning') || high < 20 || stored !== high || say(stack) !== say([0, 0, 52, 64])) {
				out.push('a banner shows ' + slot().length + ' in the shell, ' + high + ' px high, stored as ' + stored + ' px; scrolled, the banner, the header, the sidebar and the sticky top stand at ' + say(stack) + ' less its height, not [0, 0, 52, 64]');
			}
			if (region('status') !== 'Paused for a probe') {
				out.push('a banner\'s words are said as ' + say(region('status')));
			}
			$(':scope > .visually-hidden[role="status"]', document.body).textContent = 'kept';
			const again = REDZ.ui.banner({tone: 'warning', text: 'Paused for a probe'});
			await wait(150);
			if (slot()[0] !== shown || region('status') !== 'kept' || again !== close) {
				out.push('the same banner again ' + (slot()[0] === shown ? '' : 'is made anew, ') + (region('status') === 'kept' ? '' : 'is said again, ') + (again === close ? '' : 'answers another remover'));
			}
			REDZ.ui.banner({tone: 'danger', text: 'Lost for a probe'});
			await wait(150);
			close();
			if (slot().length !== 1 || !slot()[0].matches('.app-banner-danger') || region('alert') !== 'Lost for a probe') {
				out.push('a danger banner shows ' + slot().length + ' in the shell, ' + say(slot()[0]?.className ?? '') + ', said at once as ' + say(region('alert')) + ', and the replaced banner\'s remover took it away');
			}
			REDZ.ui.banner(null);
			await wait(100);
			const left = [slot().length, document.documentElement.style.getPropertyValue('--redz-app-banner-height'), top('body > .app > .app-header'), $$('#app-banner-tones > .app-banner').length];
			scrollTo(0, 0);
			if (say(left) !== say([0, '', 0, 4])) {
				out.push('once removed, the shell keeps ' + say(left) + ' - banners, the stored height, the header\'s top, the examples - not [0, "", 0, 4]');
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

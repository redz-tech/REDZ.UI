// REDZ.UI editor, what is pasted: Word, Google Docs, a spreadsheet, Markdown from a chat, plain words. Each comes in as REDZ.UI's own markup and
// nothing else: a table stays a table, a heading a heading, every style and font is left behind.
import {say} from './words.js';
import {escape, safe, trusted} from './clean.js';
import {fieldAt, topAt} from './caret.js';

const KEEP = {B: 'strong', STRONG: 'strong', I: 'em', EM: 'em', U: 'u', CODE: 'code'};

const inlineOf = (node) => {
	let out = '';
	for (const one of node.childNodes) {
		if (one.nodeType === Node.TEXT_NODE) {
			out += escape(one.textContent.replace(/\s+/g, ' '));
		} else if (one.nodeType === Node.ELEMENT_NODE && !/^(O:P|STYLE|SCRIPT)$/.test(one.tagName) && !/mso-list:\s*Ignore/i.test(one.getAttribute('style') ?? '')) {
			const inner = inlineOf(one);
			const bold = /font-weight:\s*(bold|[6-9]00)/i.test(one.getAttribute('style') ?? '');
			if (one.tagName === 'BR') {
				out += '<br>';
			} else if (one.tagName === 'A' && safe(one.getAttribute('href') ?? '') && one.hasAttribute('href')) {
				out += '<a href="' + escape(one.getAttribute('href')) + '">' + inner + '</a>';
			} else if (one.tagName === 'DATA' && one.hasAttribute('value')) {
				out += '<data value="' + escape(one.getAttribute('value')) + '">' + inner + '</data>';
			} else if (KEEP[one.tagName] !== undefined && inner !== '') {
				out += '<' + KEEP[one.tagName] + '>' + inner + '</' + KEEP[one.tagName] + '>';
			} else {
				out += bold && inner !== '' ? '<strong>' + inner + '</strong>' : inner;
			}
		}
	}
	return out;
};

const heading = (level, words) => {
	const tag = 'h' + Math.min(4, Math.max(2, level));
	return '<' + tag + '>' + words + '</' + tag + '>';
};

const tableOf = (rows) => {
	const width = Math.max(...rows.map((row) => row.length));
	const cells = (row, tag, scope) => Array.from({length: width}, (_, index) => '<' + tag + scope + '>' + (row[index] ?? '') + '</' + tag + '>').join('');
	return '<table class="table"><thead><tr>' + cells(rows[0], 'th', ' scope="col"') + '</tr></thead><tbody>' + rows.slice(1).map((row) => '<tr>' + cells(row, 'td', '') + '</tr>').join('') + '</tbody></table>';
};

/** REDZ.UI's markup of pasted HTML. */
const fromHTML = (html) => {
	const body = new DOMParser().parseFromString(trusted(html), 'text/html').body;
	const out = [];
	let list = null;
	const end = () => {
		if (list !== null) {
			out.push('<ul>' + list.map((one) => '<li>' + one + '</li>').join('') + '</ul>');
			list = null;
		}
	};
	const walk = (parent) => {
		for (const one of parent.children) {
			const tag = one.tagName;
			if (/^(SCRIPT|STYLE|META|LINK|TITLE|NOSCRIPT|TEMPLATE)$/.test(tag)) {
				continue;
			}
			const words = inlineOf(one).trim();
			if (/^H[1-6]$/.test(tag)) {
				end();
				out.push(heading(+tag[1], words));
			} else if (tag === 'TABLE') {
				end();
				out.push(tableOf([...one.rows].map((row) => [...row.cells].map((cell) => inlineOf(cell).trim()))));
			} else if (tag === 'UL' || tag === 'OL') {
				end();
				const name = tag.toLowerCase();
				out.push('<' + name + '>' + [...one.children].map((item) => '<li>' + inlineOf(item).trim() + '</li>').join('') + '</' + name + '>');
			} else if (tag === 'BLOCKQUOTE') {
				end();
				out.push('<blockquote>' + words + '</blockquote>');
			} else if (tag === 'PRE') {
				end();
				out.push('<pre>' + escape(one.textContent) + '</pre>');
			} else if (/MsoList/i.test(one.className) || /mso-list:/i.test(one.getAttribute('style') ?? '')) {
				list ??= [];
				list.push(words);
			} else if (tag === 'DIV' || tag === 'SECTION' || tag === 'ARTICLE' || tag === 'B' && one.querySelector('p, h1, h2, h3, table, ul, ol') !== null) {
				walk(one);
			} else if (words !== '') {
				end();
				out.push(/^<strong>[^<]*<\/strong>$/.test(words) && words.length < 90 ? heading(3, words.replace(/<\/?strong>/g, '')) : '<p>' + words + '</p>');
			}
		}
	};
	walk(body);
	end();
	return out.join('');
};

/** Inline marks written as Markdown, as markup. */
export const marks = (value) => escape(value).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*\s][^*]*)\*/g, '<em>$1</em>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>');

/** REDZ.UI's markup of Markdown, as a chat's answer comes. */
const fromMarkdown = (value) => {
	const out = [];
	let words = [];
	let list = null;
	let rows = null;
	const end = () => {
		if (words.length > 0) {
			out.push('<p>' + marks(words.join(' ')) + '</p>');
			words = [];
		}
		if (list !== null) {
			out.push('<' + list.tag + '>' + list.items.map((one) => '<li>' + marks(one) + '</li>').join('') + '</' + list.tag + '>');
			list = null;
		}
		if (rows !== null) {
			out.push(tableOf(rows));
			rows = null;
		}
	};
	for (const raw of value.split(/\r?\n/)) {
		const line = raw.trim();
		const head = /^(#{1,6})\s+(.+)$/.exec(line);
		const bullet = /^[-*•]\s+(.+)$/.exec(line);
		const number = /^\d+[.)]\s+(.+)$/.exec(line);
		if (head !== null) {
			end();
			out.push(heading(head[1].length, marks(head[2])));
		} else if (bullet !== null || number !== null) {
			const tag = bullet !== null ? 'ul' : 'ol';
			if (list?.tag !== tag) {
				end();
			}
			list ??= {tag, items: []};
			list.items.push((bullet ?? number)[1]);
		} else if (/^\|.*\|$/.test(line)) {
			if (!/^\|[\s:|-]+\|$/.test(line)) {
				rows ??= [];
				rows.push(line.slice(1, -1).split('|').map((one) => marks(one.trim())));
			}
		} else if (line === '') {
			end();
		} else {
			if (list !== null || rows !== null) {
				end();
			}
			words.push(line);
		}
	}
	end();
	return out.join('');
};

/** Gives the editor its paste. */
export const pasteOf = (ed) => {
	ed.paste = ({html = '', text = ''}) => {
		const doc = ed.doc;
		const selection = doc.getSelection();
		const address = text.trim();
		if (/^https?:\/\/\S+$/.test(address) && !selection.isCollapsed) {
			doc.execCommand('createLink', false, address);
			ed.commit();
			return;
		}
		if (fieldAt(doc) !== null) {
			doc.execCommand('insertText', false, text || new DOMParser().parseFromString(trusted(html), 'text/html').body.textContent);
			ed.commit();
			return;
		}
		const lines = text.trim().split(/\r?\n/);
		let made = '';
		if (/<table/i.test(html) || /<(p|h[1-6]|ul|ol|div)\b/i.test(html)) {
			made = fromHTML(html);
		} else if (lines.length > 1 && lines.every((line) => line.includes('\t'))) {
			made = tableOf(lines.map((line) => line.split('\t').map((one) => escape(one.trim()))));
		} else if (/^(#{1,6} |[-*•] |\d+[.)] |\|)|\*\*/m.test(text)) {
			made = fromMarkdown(text);
		} else {
			made = text.split(/\n{2,}/).map((one) => one.trim()).filter(Boolean).map((one) => '<p>' + escape(one).replace(/\n/g, '<br>') + '</p>').join('');
		}
		if (made !== '') {
			for (const top of ed.placeBlocks(made, topAt(doc))) {
				top.setAttribute('data-by', 'paste');
			}
			ed.settle();
			ed.commit();
			ed.note(say('pasted'));
		}
	};
};

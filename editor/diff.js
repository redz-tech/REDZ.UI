// REDZ.UI editor, a diff by the language's own word breaks, so Thai and Burmese divide too. A fact stays one word, and two changes a few letters
// apart read as one: a heavy rewrite stays a few changes, not confetti. Each browser has its own segmenter, so segments are never stored.
const JOIN = 14;
const CELLS = 4000000;

const tokens = (value, lang) => {
	const segmenter = new Intl.Segmenter(lang, {granularity: 'word'});
	const out = [];
	for (const part of value.split(/(⟦[\w.-]+⟧)/)) {
		if (part.startsWith('⟦')) {
			out.push(part);
		} else if (part !== '') {
			for (const one of segmenter.segment(part)) {
				out.push(one.segment);
			}
		}
	}
	return out;
};

/** The longest common run of two lists of words, as kept, dropped and added words. */
const steps = (a, b) => {
	if (a.length * b.length > CELLS) {
		return [...a.map((word) => ['-', word]), ...b.map((word) => ['+', word])];
	}
	const table = Array.from({length: a.length + 1}, () => new Uint16Array(b.length + 1));
	for (let i = a.length - 1; i >= 0; i--) {
		for (let j = b.length - 1; j >= 0; j--) {
			table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
		}
	}
	const out = [];
	let i = 0;
	let j = 0;
	while (i < a.length || j < b.length) {
		if (i < a.length && j < b.length && a[i] === b[j]) {
			out.push(['=', a[i]]);
			i++;
			j++;
		} else if (j < b.length && (i === a.length || table[i][j + 1] >= table[i + 1][j])) {
			out.push(['+', b[j]]);
			j++;
		} else {
			out.push(['-', a[i]]);
			i++;
		}
	}
	return out;
};

/** What changed between two versions of some words: kept runs as {same}, changes as {start, end, del, ins}, by places in the first. */
export const changes = (before, after, lang) => {
	const a = tokens(before, lang);
	const b = tokens(after, lang);
	let head = 0;
	while (head < a.length && head < b.length && a[head] === b[head]) {
		head++;
	}
	let tail = 0;
	while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) {
		tail++;
	}
	const ops = [...a.slice(0, head).map((word) => ['=', word]), ...steps(a.slice(head, a.length - tail), b.slice(head, b.length - tail)), ...a.slice(a.length - tail).map((word) => ['=', word])];
	const out = [];
	let open = null;
	let at = 0;
	for (const [op, word] of ops) {
		if (op === '=') {
			open = null;
			if (out.at(-1)?.same !== undefined) {
				out.at(-1).same += word;
			} else {
				out.push({same: word});
			}
			at += word.length;
		} else {
			if (open === null) {
				open = {start: at, end: at, del: '', ins: ''};
				out.push(open);
			}
			if (op === '-') {
				at += word.length;
				open.end = at;
				open.del += word;
			} else {
				open.ins += word;
			}
		}
	}
	for (let i = out.length - 2; i > 0; i--) {
		const [left, gap, right] = [out[i - 1], out[i], out[i + 1]];
		if (gap.same !== undefined && gap.same.length < JOIN && left.same === undefined && right?.same === undefined) {
			out.splice(i - 1, 3, {start: left.start, end: right.end, del: left.del + gap.same + right.del, ins: left.ins + gap.same + right.ins});
			i--;
		}
	}
	return out;
};

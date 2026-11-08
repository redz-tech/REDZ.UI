// REDZ.UI, qr: draws the QR code of a text into an element as one SVG path in the element's text color, at the size the
// page gives it. The text goes in as its UTF-8 bytes, in the smallest of the 40 versions that holds it at the error
// correction level asked for, M unless told, and then at the highest level that same version still holds. The path
// traces the outline of each dark region, so no two shapes meet and neither a print nor a zoom shows a seam. An element
// with data-qr is drawn from it, data-qr-level and data-qr-quiet, at load, when it is added and when one of the three
// changes. A text longer than version 40 holds leaves the element empty and marked data-qr-error. The text may be a
// secret: it goes into the code and nowhere else.
const LEVELS = ['L', 'M', 'Q', 'H'];
// Per version 1 to 40 and level L, M, Q, H, as a char code less 40: the error correction codewords of a block, the blocks.
const CORRECTION = '/25928>D7B:><:B8B@:>:8@D<::B@>>BF><@:B@D<FD@@>BDB>@>F@<@>@F@@D@FDDDDFBDDDBBBDBFDDBDFDDF@FDFFFDFFBDFFDDDFFDFFFDFFFDFFFDFFFDFFFDFFFDFFFDFFFDFFFDFFFDFFFDFFFDFFFDFF';
const BLOCKS = '))))))))))**)**,)*,,*,,,*,.-*,..*-00,-00,-03,023,148,188.24:.298.38;.5:=/6=A08<A09?A19?J1:AF2<CH4=EK4?JM4AJP5BKR6DNU7EPX8GS[9IU^:KXa;M[d;N]g<P`j=Scn>Ufr@WiuAYly';
const SVG = 'http://www.w3.org/2000/svg';
const ATTRIBUTES = ['data-qr', 'data-qr-level', 'data-qr-quiet'];
// The data masks of the standard: a module of the data is inverted where its mask gives 0.
const MASKS = [
	(y, x) => (y + x) % 2,
	(y) => y % 2,
	(y, x) => x % 3,
	(y, x) => (y + x) % 3,
	(y, x) => ((y >> 1) + (x / 3 | 0)) % 2,
	(y, x) => y * x % 2 + y * x % 3,
	(y, x) => (y * x % 2 + y * x % 3) % 2,
	(y, x) => ((y + x) % 2 + y * x % 3) % 2,
];
// The powers of 2 in GF(256) under the polynomial 0x11D, and their logarithms.
const EXP = [];
const LOG = [];

for (let i = 0, x = 1; i < 255; i++, x = x << 1 ^ (x > 127 ? 0x11D : 0)) {
	EXP[i] = x;
	LOG[x] = i;
}

/** The product of two elements of GF(256). */
const times = (a, b) => a && b && EXP[(LOG[a] + LOG[b]) % 255];

/** The Reed-Solomon error correction codewords of a block. */
const correct = (block, length) => {
	let divisor = [1];
	let rest = Array(length).fill(0);
	for (let i = 0; i < length; i++) {
		divisor = [...divisor, 0].map((c, j) => c ^ times(divisor[j - 1], EXP[i]));
	}
	for (const word of block) {
		const factor = word ^ rest[0];
		rest = [...rest.slice(1), 0].map((c, j) => c ^ times(divisor[j + 1], factor));
	}
	return rest;
};

/** A value followed by the bits of its BCH code. */
const bch = (value, poly, degree) => {
	let rest = value << degree;
	for (let bit = 17; bit >= degree; bit--) {
		if (rest >> bit & 1) {
			rest ^= poly << bit - degree;
		}
	}
	return value << degree | rest;
};

/** The codewords of a version at a level: all of them, those of the data, those of a block's correction, the blocks. */
const layout = (version, level) => {
	const side = (version / 7 | 0) + 2;
	const all = (16 * version + 128) * version + 64 - (version > 6) * 36 - (version > 1) * (25 * side * side - 10 * side - 55) >> 3;
	const length = CORRECTION.charCodeAt(4 * version - 4 + level) - 40;
	const blocks = BLOCKS.charCodeAt(4 * version - 4 + level) - 40;
	return [all, all - length * blocks, length, blocks];
};

/** The penalty of a masked symbol by the four rules of the standard: runs, 2 by 2 blocks, finder-like lines, dark share. */
const penalty = (grid, n) => {
	let score = 0;
	let dark = 0;
	for (let i = 0; i < n; i++) {
		let row = '';
		let column = '';
		for (let j = 0; j < n; j++) {
			const p = i * n + j;
			row += grid[p];
			column += grid[j * n + i];
			dark += grid[p];
			if (i && j && grid[p] == grid[p - 1] && grid[p] == grid[p - n] && grid[p] == grid[p - n - 1]) {
				score += 3;
			}
		}
		for (const line of [row, column]) {
			for (const run of line.match(/0{5,}|1{5,}/g) ?? []) {
				score += run.length - 2;
			}
			score += 40 * (('0000' + line + '0000').match(/(?=(?<=0000)1011101|10111010000)/g) ?? []).length;
		}
	}
	return score + 10 * (Math.abs(dark * 20 - n * n * 10) / (n * n) | 0);
};

/** The modules of the QR code of the bytes, row by row, 1 for dark; null when version 40 cannot hold them at the level. */
const encode = (bytes, level) => {
	/** Whether a version at a level holds the bytes with the mode and the count before them. */
	const fits = (v, l) => bytes.length + (v < 10 ? 2 : 3) <= layout(v, l)[1];
	let version = 1;
	while (version < 41 && !fits(version, level)) {
		version++;
	}
	if (version > 40) {
		return null;
	}
	while (level < 3 && fits(version, level + 1)) {
		level++;
	}
	const [all, data, length, count] = layout(version, level);
	let bits = '0100' + bytes.length.toString(2).padStart(version < 10 ? 8 : 16, '0');
	for (const byte of bytes) {
		bits += byte.toString(2).padStart(8, '0');
	}
	bits = (bits + '0000').slice(0, 8 * data);
	const words = bits.padEnd(bits.length + 7 & -8, '0').padEnd(8 * data, '1110110000010001').match(/.{8}/g).map((word) => parseInt(word, 2));
	const short = (all / count | 0) - length;
	const blocks = [];
	for (let b = 0, at = 0; b < count; b++) {
		const block = words.slice(at, at += short + (b >= count - all % count));
		blocks.push([block, correct(block, length)]);
	}
	const sequence = [];
	for (const part of [0, 1]) {
		for (let i = 0; i < short + length; i++) {
			blocks.forEach((block) => i < block[part].length && sequence.push(block[part][i]));
		}
	}
	const n = 4 * version + 17;
	const fixed = [];
	let grid = Array(n * n).fill(0);
	/** Sets a module of a function pattern. */
	const put = (y, x, dark) => {
		grid[y * n + x] = dark;
		fixed[y * n + x] = 1;
	};
	/** Draws a square of rings, one bit of the pattern each from the center out: a finder and its separator, an alignment. */
	const square = (cy, cx, rings) => {
		for (let y = cy - rings.length + 1; y < cy + rings.length; y++) {
			for (let x = cx - rings.length + 1; x < cx + rings.length; x++) {
				if (y >= 0 && x >= 0 && y < n && x < n) {
					put(y, x, +rings[Math.max(Math.abs(y - cy), Math.abs(x - cx))]);
				}
			}
		}
	};
	/** Writes the format information with the dark module and, from version 7, the version information; 0 keeps them light. */
	const info = (format) => {
		for (let i = 0; i < 15; i++) {
			put(i < 6 ? i : i < 8 ? i + 1 : 8, i < 8 ? 8 : i < 9 ? 7 : 14 - i, format >> i & 1);
			put(i < 8 ? 8 : n - 15 + i, i < 8 ? n - 1 - i : 8, format >> i & 1);
		}
		put(n - 8, 8, format && 1);
		for (let i = 0; i < 18 * (version > 6); i++) {
			const bit = format && bch(version, 0x1F25, 12) >> i & 1;
			put(i / 3 | 0, n - 11 + i % 3, bit);
			put(n - 11 + i % 3, i / 3 | 0, bit);
		}
	};
	for (const [y, x] of [[3, 3], [3, n - 4], [n - 4, 3]]) {
		square(y, x, '11010');
	}
	const side = (version / 7 | 0) + 2;
	const step = version == 32 ? 26 : Math.ceil((n - 13) / (side - 1) / 2) * 2;
	const centers = [6];
	for (let i = side - 2; i >= 0 && version > 1; i--) {
		centers.push(n - 7 - i * step);
	}
	for (const y of centers) {
		for (const x of centers) {
			if (!fixed[y * n + x]) {
				square(y, x, '101');
			}
		}
	}
	for (let i = 8; i < n - 8; i++) {
		put(6, i, ~i & 1);
		put(i, 6, ~i & 1);
	}
	info(0);
	let k = 0;
	for (let x = n - 1, up = 1; x > 0; x -= 2, up = !up) {
		if (x == 6) {
			x = 5;
		}
		for (let i = 0; i < n; i++) {
			const y = up ? n - 1 - i : i;
			for (const c of [x, x - 1]) {
				if (!fixed[y * n + c]) {
					grid[y * n + c] = sequence[k >> 3] >> (~k & 7) & 1;
					k++;
				}
			}
		}
	}
	const unmasked = grid;
	let lowest = Infinity;
	let chosen = 0;
	MASKS.forEach((mask, id) => {
		const masked = unmasked.map((dark, p) => fixed[p] ? dark : dark ^ !mask(p / n | 0, p % n));
		const score = penalty(masked, n);
		if (score < lowest) {
			lowest = score;
			chosen = id;
			grid = masked;
		}
	});
	info(bch((level ^ 1) << 3 | chosen, 0x537, 10) ^ 0x5412);
	return grid;
};

/** The path tracing the outline of each 4-connected dark region, its holes the other way round, offset by the quiet zone. */
const outline = (grid, n, quiet) => {
	const region = [];
	const traced = [];
	let regions = 0;
	let path = '';
	grid.forEach((dark, start) => {
		if (dark && !region[start]) {
			const stack = [start];
			region[start] = ++regions;
			while (stack.length) {
				const p = stack.pop();
				for (const q of [p - n, p + n, p % n ? p - 1 : -1, (p + 1) % n ? p + 1 : -1]) {
					if (grid[q] && !region[q]) {
						region[q] = regions;
						stack.push(q);
					}
				}
			}
		}
	});
	/** The region of the cell at a column and a row, nothing for a light cell or one outside. */
	const cell = (x, y) => x >= 0 && y >= 0 && x < n && y < n && region[y * n + x];
	region.forEach((label, start) => {
		const x = start % n;
		const y = start / n | 0;
		if (!cell(x, y - 1) && !traced[start]) {
			path += 'M' + (x + quiet) + ' ' + (y + quiet);
			let px = x;
			let py = y;
			let way = 0;
			let run = 0;
			/** The region of a cell at the corner reached, the corners counted clockwise from the top left one. */
			const corner = (c) => cell(px - 1 + ((c ^ c >> 1) & 1), py - 1 + (c >> 1 & 1));
			while (true) {
				if (!way) {
					traced[py * n + px] = 1;
				}
				px += (1 - way) % 2;
				py += (2 - way) % 2;
				run++;
				const behind = corner(way + 3);
				const right = corner(way + 2);
				const left = corner(way + 1);
				const next = way + (left && (right || left == behind) ? 3 : !right) & 3;
				if (px == x && py == y && !next) {
					break;
				}
				if (next != way) {
					path += (way % 2 ? 'v' : 'h') + (way > 1 ? -run : run);
					run = 0;
					way = next;
				}
			}
			path += 'z';
		}
	});
	return path;
};

/** Draws the QR code of a text into an element, or empties the element for null; false when the text is too long. */
const qr = (element, text, {level = 'M', quiet = 4} = {}) => {
	if (!(element instanceof Element) || !LEVELS.includes(level) || !(Number.isInteger(quiet) && quiet >= 0) || (text !== null && typeof text != 'string')) {
		throw new TypeError();
	}
	const grid = text === null ? null : encode(new TextEncoder().encode(text), LEVELS.indexOf(level));
	element.toggleAttribute('data-qr-error', text !== null && !grid);
	element.style?.removeProperty('--redz-qr-modules');
	if (!grid) {
		element.replaceChildren();
		return text === null;
	}
	const n = Math.sqrt(grid.length);
	const size = n + 2 * quiet;
	const svg = document.createElementNS(SVG, 'svg');
	const path = document.createElementNS(SVG, 'path');
	svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
	svg.setAttribute('shape-rendering', 'crispEdges');
	svg.setAttribute('aria-hidden', 'true');
	svg.setAttribute('focusable', 'false');
	path.setAttribute('fill', 'currentColor');
	path.setAttribute('d', outline(grid, n, quiet));
	svg.append(path);
	element.replaceChildren(svg);
	if (!element.hasAttribute('role')) {
		element.setAttribute('role', 'img');
	}
	element.style?.setProperty('--redz-qr-modules', String(size));
	return true;
};

/** Draws an element from its data-qr, data-qr-level and data-qr-quiet, or empties it once data-qr is gone. */
const markup = (element) => {
	const level = element.getAttribute('data-qr-level');
	const quiet = element.getAttribute('data-qr-quiet');
	qr(element, element.getAttribute('data-qr'), {level: LEVELS.includes(level) ? level : 'M', quiet: /^\d+$/.test(quiet) ? +quiet : 4});
};

document.querySelectorAll('[data-qr]').forEach(markup);

new MutationObserver((records) => {
	const elements = new Set();
	for (const record of records) {
		if (record.type == 'attributes' && (record.target.hasAttribute('data-qr') || record.attributeName == 'data-qr')) {
			elements.add(record.target);
		}
		for (const node of record.addedNodes) {
			if (node instanceof Element) {
				[node, ...node.querySelectorAll('[data-qr]')].forEach((element) => element.hasAttribute('data-qr') && elements.add(element));
			}
		}
	}
	elements.forEach(markup);
}).observe(document.documentElement, {childList: true, subtree: true, attributes: true, attributeFilter: ATTRIBUTES});

globalThis.REDZ = Object.assign(globalThis.REDZ ?? {}, {ui: {...globalThis.REDZ?.ui, qr}});

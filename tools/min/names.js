// The minifier's fixture: names that hide, share and capture - every answer must stay the same once the names are short.
const a = 'outer a';
const b = 'outer b';
globalThis.q = 'free q';
const shadow = () => {
	const a = 'inner a';
	{
		const b = 'block b';
		const pair = [a, b];
		{
			const a = 'deep a';
			pair.push(a, b);
		}
		return pair;
	}
};
const closures = () => {
	const fns = [];
	for (let i = 0; i < 3; i++) {
		fns.push(() => i * 10);
	}
	for (const name of ['x', 'y']) {
		fns.push(() => name + name);
	}
	return fns.map((fn) => fn());
};
const defaults = (first, second = first + 1, third = second * 2, ...rest) => [first, second, third, rest.length];
const free = () => {
	const c = 1, d = 2, e = 3, f = 4, g = 5, h = 6, i = 7, j = 8, k = 9, l = 10, m = 11, n = 12, o = 13, p = 14, r = 15, s = 16;
	return [q, c + d + e + f + g + h + i + j + k + l + m + n + o + p + r + s];
};
const caught = () => {
	const error = 'outer error';
	try {
		throw new Error('thrown');
	} catch (error) {
		return [error.message, typeof error];
	} finally {
		globalThis.REDZ_MIN_FINALLY = error;
	}
};
const counter = (() => {
	let count = 0;
	return {up: () => ++count, read: () => count};
})();
counter.up();
counter.up();
const nested = (x) => (y) => (z) => x + y * z;
const sequence = () => {
	let x = 0;
	const add = (n) => (x += n, x);
	return [add(1), add(2), x];
};
globalThis.REDZ_MIN_RESULT = {shadow: shadow(), closures: closures(), defaults: defaults(1), free: free(), caught: [caught(), globalThis.REDZ_MIN_FINALLY], counter: counter.read(), nested: nested(1)(2)(3), sequence: sequence(), outer: [a, b]};

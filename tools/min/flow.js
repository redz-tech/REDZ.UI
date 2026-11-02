// The minifier's fixture: the blocks of every statement — switch cases with their own blocks, loops, try without a
// binding, async arrows — and their scopes.
const kind = (n) => {
	let out = '';
	switch (n) {
		case 1: {
			const label = 'one';
			out = label;
			break;
		}
		case 2:
		case 3:
			out = 'two or three';
			break;
		default: {
			const label = 'other';
			out = label + n;
		}
	}
	return out;
};
const loops = () => {
	const seen = [];
	for (const [key, value] of Object.entries({a: 1, b: 2})) {
		seen.push(key + value);
	}
	for (const key in {c: 3}) {
		seen.push(key);
	}
	let n = 0;
	while (n < 3) {
		n++;
		if (n === 2) {
			continue;
		}
		seen.push('w' + n);
	}
	do {
		n--;
	} while (n > 0);
	seen.push(n);
	return seen;
};
const safe = (fn) => {
	try {
		return fn();
	} catch {
		return 'caught';
	}
};
const later = async (values) => {
	let sum = 0;
	for (const value of values) {
		sum += await Promise.resolve(value);
	}
	return sum;
};
const wait = async () => [await later([1, 2, 3]), await (async (x) => x * 2)(21)];
globalThis.REDZ_MIN_RESULT = wait().then((waited) => ({kinds: [1, 2, 3, 4].map(kind), loops: loops(), safe: [safe(() => 'fine'), safe(() => {
	throw new Error('x');
})], waited}));

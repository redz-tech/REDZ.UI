// The minifier's fixture: functions and classes - declarations hoisted, expressions with their own names, parameters
// with defaults, rests and patterns, var, arguments, classes with fields, private names, static blocks, accessors and
// computed keys, generators, labels, functions declared in a block - and the names each one sees.
const early = before(2);
function before(count) {
	return count * 10;
}
const named = function again(count) {
	return count > 0 ? again(count - 1) + 1 : 0;
};
const shadowed = function self(self) {
	return typeof self;
};
const outer = 'outside';
const defaults = function (first, second = first + 1, {third = second * 2, ...others} = {}, ...rest) {
	return [first, second, third, Object.keys(others), rest.length];
};
const reads = (given = outer) => {
	const outer = 'inside';
	return [given, outer];
};
const hoisted = function () {
	const seen = [typeof later, later];
	var later = 'set';
	var later;
	seen.push(later);
	return seen;
};
const sameAsParameter = function (value) {
	var value;
	return value;
};
const counted = function () {
	const inner = () => arguments.length;
	return [arguments.length, arguments[1], inner()];
};
const loops = function () {
	var calls = [];
	for (var i = 0; i < 3; i++) {
		calls.push(() => i);
	}
	return calls.map((call) => call());
};
class Base {
	constructor(name) {
		this.name = name;
	}
	describe() {
		return 'base ' + this.name;
	}
}
const key = 'computed';
class Ledger extends Base {
	#rows = [];
	static made = 0;
	static #secret = 'hidden';
	static {
		Ledger.made = Ledger.#secret.length;
	}
	constructor(name) {
		super(name);
		this.#rows.push(name);
	}
	get size() {
		return this.#rows.length;
	}
	set size(count) {
		this.#rows.length = count;
	}
	[key]() {
		return key + ' ' + this.size;
	}
	*[Symbol.iterator]() {
		yield* this.#rows;
	}
	describe() {
		return super.describe() + ' as ledger';
	}
	static reveal() {
		return Ledger.#secret;
	}
}
const Made = class Inner {
	static twice() {
		return new Inner();
	}
	kind() {
		return 'inner';
	}
};
const ledger = new Ledger('main');
ledger.size = 1;
const object = {
	stored: 2,
	get double() {
		return this.stored * 2;
	},
	set double(value) {
		this.stored = value / 2;
	},
	[key + 'Method'](value) {
		return value + 1;
	},
	*count(limit) {
		for (let n = 0; n < limit; n++) {
			yield n;
		}
	},
	async later(value) {
		return value;
	},
};
object.double = 10;
function* fib(limit) {
	let [a, b] = [0, 1];
	while (limit-- > 0) {
		yield a;
		[a, b] = [b, a + b];
	}
}
const found = (grid) => {
	let hit = null;
	outer: for (const row of grid) {
		for (const cell of row) {
			if (cell > 4) {
				hit = cell;
				break outer;
			}
			if (cell < 0) {
				continue outer;
			}
		}
	}
	return hit;
};
const inBlock = (flag) => {
	if (flag) {
		function local() {
			return 'local';
		}
		return local();
	}
	return 'none';
};
const streamed = async function* () {
	yield 1;
	yield 2;
};
const gathered = async () => {
	const all = [];
	for await (const value of streamed()) {
		all.push(value);
	}
	return all;
};
globalThis.REDZ_MIN_RESULT = gathered().then(async (stream) => ({
	early,
	named: named(3),
	shadowed: shadowed(1),
	defaults: [defaults(1), defaults(1, 5, {third: 0, extra: 1}, 'a', 'b')],
	reads: reads(),
	hoisted: hoisted(),
	sameAsParameter: sameAsParameter(7),
	counted: counted('a', 'b', 'c'),
	loops: loops(),
	ledger: [ledger.size, ledger.computed(), [...ledger], ledger.describe(), Ledger.made, Ledger.reveal(), ledger instanceof Base],
	made: [Made.twice().kind(), Made.twice() instanceof Made],
	object: [object.double, object.computedMethod(1), [...object.count(3)], await object.later('later')],
	fib: [...fib(7)],
	found: [found([[1, 2], [-1, 9], [7]]), found([[1]])],
	inBlock: [inBlock(true), inBlock(false)],
	stream,
}));

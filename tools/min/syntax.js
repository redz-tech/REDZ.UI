// The minifier's fixture: where a squeezed line could read differently - a `/` that divides or begins a pattern, signs
// that would fuse, numbers before a dot, optional chains, templates in templates, strings that look like code.
const ratio = (a, b) => (a + b) / 2 / (b || 1);
const half = [8][0] / 2;
let i = 4;
const post = i++ / 2 / 1;
const patterns = [/\/\*not a comment\*\//.test('/*not a comment*/'), /[/\]]+/.source, /it's/u.flags, typeof /x/];
const after = (s) => {
	if (/^a/.test(s)) {
		return /b$/.test(s) ? 'ab' : 'a';
	}
	return !/c/.test(s) && /d/.test(s) ? 'd' : 'none';
};
const signs = [1 - -1, 1 + +1, -(-1), +'3', 5 - - - 2];
const dots = [1 .toString(), 1.5.toFixed(1), (2).toString(2), 0x10 .toString()];
const chain = {a: {b: [10, 20], c: () => 'called'}};
const optional = [chain?.a?.b?.[1], chain.x?.y, chain.a.c?.(), chain.a.d?.(), chain?.a ?? 'none', null ?? 'fallback', 0 || 'or', '' ?? 'kept'];
const choice = (n) => n > 2 ? .5 : 1.5;
const text = `outer ${`inner ${1 + 1} ${'q'}`} ${{a: 1}.a} ${/x/.test('x')} end`;
const strings = ['// not a comment', '/* not either */', "it's", 'back\\slash', '\u{1F600}', 'тайский', 'تايلاند'];
const html = '<!-- not a comment -->';
const lt = (a, b) => a < !b;
const arrows = [1, 2, 3].map((n) => n * 2).filter((n) => n > 2).reduce((sum, n) => sum + n, 0);
const commaArrow = [((x) => x + 1, (y) => y * 2)].map((fn) => fn(5));
const object = {f: (n) => n ? 'yes' : 'no', g: (n) => ({wrapped: n})};
globalThis.REDZ_MIN_RESULT = {ratio: ratio(2, 4), half, post, i, patterns, after: ['abx', 'ab', 'xd', 'c'].map(after), signs, dots, optional, choice: [choice(3), choice(1)], text, strings, html, lt: lt(1, 0), arrows, commaArrow, object: [object.f(0), object.f(1), object.g(2)]};

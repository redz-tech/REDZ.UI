// The minifier's fixture: objects and patterns — shorthands, keys, defaults and rests keep their names and values.
const title = 'Ang Thong';
const price = 2500;
const tour = {title, price, 'price-label': price + ' THB', [title.length]: 'computed', nested: {title}};
const {title: name, price: cost = 0, missing = 'default', ...others} = {title: 'Coral', price: 900, seats: 30, boat: 'Star'};
const [first, , third = 'third', ...tail] = ['one', 'two', undefined, 'four', 'five'];
const pick = ({id, label: text = 'none', tags: [tag = 'untagged'] = []} = {}) => [id, text, tag];
let left = 'L';
let right = 'R';
[left, right] = [right, left];
let assigned;
({assigned = 'from default'} = {});
const methods = {
	twice(n) {
		return n * 2;
	},
	'quoted key'(n) {
		return n + 1;
	},
	arrow: (n) => n - 1
};
const spread = {...tour.nested, extra: true};
const keyword = {default: 1, class: 2, if: 3, new: 4};
const deep = ({a: {b: {c = 'deep default'} = {}} = {}}) => c;
globalThis.REDZ_MIN_RESULT = {tour, name, cost, missing, others, first, third, tail, picks: [pick(), pick({id: 7, label: 'seven', tags: ['sea']})], swapped: [left, right], assigned, methods: [methods.twice(4), methods['quoted key'](4), methods.arrow(4)], spread, keyword: Object.keys(keyword), deep: [deep({}), deep({a: {b: {c: 'given'}}})]};

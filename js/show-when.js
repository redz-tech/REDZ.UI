// REDZ.UI, elements that follow a field: data-show-when="NAME" shows its element while the field NAME of its form - of
// the page outside a form - holds a value data-show-in lists (space-separated; without it, any value); data-enable-when
// with data-enable-in enables its element the same way, data-require-when with data-require-in makes it required. A
// checkbox or a radio counts its value when checked, a disabled field counts as empty - the form sends nothing of it -
// and a field inside the element never counts. A hidden element's fields are disabled, so the form sends none of them;
// a rule on a field owns its disabled or required, a fieldset takes its own disabled, any other element sets each field
// inside it, and a field the page disabled or required itself stays so. An element inside a hidden one counts as hidden.
// A hidden field beside a checkbox or a radio of its name is what the form sends while none is checked: data-show-in and
// its twins can name it, and it is not a value for a rule without one. While a rule disables a field, the shown texts
// with data-show-when that the field names in aria-describedby join the aria-describedby of every control of NAME, which
// the keyboard reaches; a checked radio it disables hands its check, with input and change, to the enabled radio of its
// group with data-enable-else, or loses it. Rules follow input, change and reset; REDZ.ui.follow(form) reads those of the
// form, or of the page, again after a value set by code.
import {groupOf} from './busy.js';

const KINDS = ['show', 'enable', 'require'];
const RULES = '[data-show-when], [data-enable-when], [data-require-when]';
const FIELDS = 'input, select, textarea';
const ours = {disabled: new WeakSet(), required: new WeakSet()};
const joined = new Map();
let told = null;

/** The fields named NAME that the form sends, in the rule's form or in the page, none inside the rule's element. */
const controlsOf = (rule, name) => [...(rule.closest('form') ?? document).querySelectorAll(FIELDS)].filter((field) => field.name === name && !rule.contains(field) && !field.matches(':disabled'));

/** Whether the rule of the kind holds: its field holds a value its data-KIND-in lists, or any value without one. */
const holds = (rule, kind) => {
	const list = rule.dataset[kind + 'In'];
	const fields = controlsOf(rule, rule.dataset[kind + 'When']);
	const boxes = fields.filter((field) => field.type === 'checkbox' || field.type === 'radio');
	const twin = boxes.length > 0 && (list === undefined || boxes.some((field) => field.checked));
	const wanted = (list ?? '').split(/\s+/).filter(Boolean);
	return fields.filter((field) => !(twin && field.type === 'hidden')).flatMap((field) => {
		if (field instanceof HTMLSelectElement) {
			return [...field.selectedOptions].map((option) => option.value);
		}
		return boxes.includes(field) && !field.checked ? [] : [field.value];
	}).some((value) => (wanted.length === 0 ? value !== '' : wanted.includes(value)));
};

/** Reads the rules once and sets what they own; answers whether anything changed and the radios an enable rule turns off. */
const pass = (rules) => {
	let changed = false;
	const wants = {disabled: new Map(), required: new Map()};
	const off = [];
	for (const rule of rules) {
		const fields = rule.matches(FIELDS) ? [rule] : [...rule.querySelectorAll(FIELDS)];
		for (const kind of KINDS.filter((one) => rule.dataset[one + 'When'] !== undefined)) {
			const on = !(kind === 'show' && rule.parentElement?.closest('[data-show-when]')?.hidden) && holds(rule, kind);
			const [key, value] = kind === 'require' ? ['required', on] : ['disabled', !on];
			const owned = kind !== 'show' && (fields[0] === rule || (kind === 'enable' && rule instanceof HTMLFieldSetElement));
			if (owned) {
				ours[key].add(rule);
			}
			if (kind === 'show' && rule.hidden === on) {
				rule.hidden = !on;
				changed = true;
			}
			if (kind === 'enable' && !on) {
				off.push(...fields.filter((one) => one.type === 'radio'));
			}
			(owned ? [rule] : fields).forEach((one) => wants[key].set(one, value || (wants[key].get(one) ?? false)));
		}
	}
	for (const key in wants) {
		for (const [field, value] of wants[key]) {
			if (value ? !field[key] : ours[key].has(field)) {
				field[key] = value;
				ours[key][value ? 'add' : 'delete'](field);
				changed = true;
			}
		}
	}
	return [changed, off];
};

/** Hands the check of each checked radio turned off to its group's enabled data-enable-else radio, or takes it away;
 *  answers whether any lost one, and adds the radios that took one to GIVEN. */
const handOver = (radios, given) => {
	const lost = radios.filter((radio) => radio.checked && radio.matches(':disabled'));
	for (const radio of lost) {
		const other = groupOf(radio).find((one) => 'enableElse' in one.dataset && !one.matches(':disabled'));
		if (other === undefined) {
			radio.checked = false;
		} else {
			other.checked = true;
			given.add(other);
		}
	}
	return lost.length > 0;
};

/** The ids the element names in aria-describedby. */
const idsOf = (element) => (element.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);

/** Joins the reasons of each field an enable rule turns off to the rule's controls, and takes back those that went. */
const reasons = () => {
	const wanted = new Map();
	for (const rule of document.querySelectorAll('[data-enable-when]')) {
		const ids = holds(rule, 'enable') ? [] : [rule, ...rule.querySelectorAll(FIELDS)].flatMap(idsOf).filter((id) => document.getElementById(id)?.matches('[data-show-when]:not([hidden])'));
		controlsOf(rule, rule.dataset.enableWhen).forEach((control) => control.type !== 'hidden' && wanted.set(control, [...(wanted.get(control) ?? []), ...ids]));
	}
	for (const control of new Set([...joined.keys(), ...wanted.keys()])) {
		const had = joined.get(control) ?? [];
		const kept = idsOf(control).filter((id) => !had.includes(id));
		const added = (wanted.get(control) ?? []).filter((id) => !kept.includes(id));
		const now = [...new Set([...kept, ...added])].join(' ');
		if (now === '') {
			control.removeAttribute('aria-describedby');
		} else if (now !== control.getAttribute('aria-describedby')) {
			control.setAttribute('aria-describedby', now);
		}
		if (added.length > 0) {
			joined.set(control, added);
		} else {
			joined.delete(control);
		}
	}
};

/** Reads the rules of the scope until they agree, joins the reasons, then tells the radios that took a check - each
 *  once while the first reading lasts, the readings their events start included. */
const all = (scope = document) => {
	const first = told === null;
	told ??= new Set();
	try {
		const rules = [...scope.querySelectorAll(RULES)];
		const given = new Set();
		for (let round = 0; round <= rules.length; round++) {
			const [changed, off] = pass(rules);
			if (!handOver(off, given) && !changed) {
				break;
			}
		}
		reasons();
		for (const radio of [...given].filter((one) => !told.has(one))) {
			told.add(radio);
			['input', 'change'].forEach((type) => radio.dispatchEvent(new Event(type, {bubbles: true})));
		}
	} finally {
		if (first) {
			told = null;
		}
	}
};

/** Reads the rules of the form, or of the page, again: after a value set by code. */
export const follow = (form) => all(form);

all();
document.addEventListener('input', () => all());
document.addEventListener('change', () => all());
document.addEventListener('reset', () => setTimeout(all));

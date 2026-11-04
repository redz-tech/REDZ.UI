// REDZ.UI, regions that follow a field: data-show-when="NAME" shows the region while the field NAME of its form - of the
// page outside a form - holds a value data-show-in lists (space-separated; without it, any value); a checkbox or a radio
// counts its value when checked. While the region is hidden its fields are disabled, so the form sends none of them;
// a field the page disabled itself stays disabled when the region shows again.
const SHOWN = '[data-show-when]';
const FIELDS = 'input, select, textarea';
const ours = new WeakSet();

/** The values the field NAME holds now, in the region's form or in the page. */
const valuesOf = (region) => {
	const name = region.dataset.showWhen;
	const scope = region.closest('form') ?? document;
	return [...scope.querySelectorAll(FIELDS)].filter((field) => field.name === name && !region.contains(field)).flatMap((field) => {
		if (field instanceof HTMLSelectElement) {
			return [...field.selectedOptions].map((option) => option.value);
		}
		if (field.type === 'checkbox' || field.type === 'radio') {
			return field.checked ? [field.value] : [];
		}
		return [field.value];
	});
};

/** Shows or hides the region by its field's values, and turns its fields off while it is hidden. */
const follow = (region) => {
	const values = valuesOf(region);
	const wanted = (region.dataset.showIn ?? '').split(/\s+/).filter(Boolean);
	const shown = wanted.length === 0 ? values.some((value) => value !== '') : values.some((value) => wanted.includes(value));
	region.hidden = !shown;
	for (const field of region.querySelectorAll(FIELDS)) {
		if (!shown && !field.disabled) {
			field.disabled = true;
			ours.add(field);
		} else if (shown && ours.has(field)) {
			field.disabled = false;
			ours.delete(field);
		}
	}
};

const all = () => document.querySelectorAll(SHOWN).forEach(follow);

all();
document.addEventListener('input', all);
document.addEventListener('change', all);
document.addEventListener('reset', () => setTimeout(all));

// REDZ.UI, charts: charts.css draws a chart, its breakdown rows, a sparkline and a board of lanes from their own markup,
// and this script hands it the numbers - each data-v, data-at, data-from, data-to, data-median and data-now inside a
// .chart, .chart-rows, .spark or .lanes becomes the custom property of its name through the CSSOM, which a strict CSP
// allows where a style attribute it would refuse. A table of class chart or chart-rows, drawn otherwise, takes the
// table's roles too: WebKit drops the meaning of a table whose parts are displayed otherwise, and a screen reader then
// reads the chart as the table it is. Charts on the page, added later or given new numbers are drawn the same.
const NUMBERS = ['v', 'at', 'from', 'to', 'median', 'now'];
const DRAWN = '.chart, .chart-rows, .spark, .lanes';
const ROLES = {CAPTION: 'caption', THEAD: 'rowgroup', TBODY: 'rowgroup', TR: 'row', TD: 'cell'};

/** Copies the element's numbers into its custom properties. */
const number = (element) => {
	for (const name of NUMBERS) {
		const value = element.getAttribute('data-' + name);
		if (value === null) {
			element.style.removeProperty('--' + name);
		} else if (Number.isFinite(Number(value))) {
			element.style.setProperty('--' + name, value);
		}
	}
};

/** Draws one chart: its numbers, and a chart table's roles. */
const draw = (chart) => {
	for (const element of [chart, ...chart.querySelectorAll(NUMBERS.map((name) => '[data-' + name + ']').join(', '))]) {
		number(element);
	}
	if (chart.matches('table:is(.chart, .chart-rows)')) {
		chart.setAttribute('role', 'table');
		for (const part of chart.querySelectorAll('caption, thead, tbody, tr, th, td')) {
			part.setAttribute('role', part.tagName === 'TH' ? (part.closest('thead') === null ? 'rowheader' : 'columnheader') : ROLES[part.tagName]);
		}
	}
};

document.querySelectorAll(DRAWN).forEach(draw);

new MutationObserver((records) => {
	const charts = new Set();
	for (const record of records) {
		const inside = record.target instanceof Element ? record.target.closest(DRAWN) : null;
		if (inside !== null) {
			charts.add(inside);
		}
		for (const node of record.addedNodes) {
			if (node instanceof Element) {
				(node.matches(DRAWN) ? [node] : [...node.querySelectorAll(DRAWN)]).forEach((chart) => charts.add(chart));
			}
		}
	}
	charts.forEach(draw);
}).observe(document.documentElement, {childList: true, subtree: true, attributes: true, attributeFilter: NUMBERS.map((name) => 'data-' + name)});

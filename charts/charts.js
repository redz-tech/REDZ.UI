// REDZ.UI, charts: charts.css draws a chart, its breakdown rows, a sparkline and a board of lanes from their own markup,
// and this script hands it the numbers - each data-v, data-at, data-from, data-to, data-median and data-now inside a
// .chart, .chart-rows, .spark or .lanes becomes the custom property of its name through the CSSOM, which a strict CSP
// allows where a style attribute it would refuse. A table of class chart or chart-rows, drawn otherwise, takes the
// table's roles too: WebKit drops the meaning of a table whose parts are displayed otherwise, and a screen reader then
// reads the chart as the table it is. A caption of a board's scale that would touch the one before it hides, by measure,
// as its width depends on the language. A chart-line table and a spark-line get one SVG line through their values - a
// chart its area under it too -, drawn behind the rows, which keep their tooltips. Charts on the page, added later or
// given new numbers are drawn the same.
const NUMBERS = ['v', 'at', 'from', 'to', 'median', 'now'];
const DRAWN = '.chart, .chart-rows, .spark, .lanes';
const ROLES = {CAPTION: 'caption', THEAD: 'rowgroup', TBODY: 'rowgroup', TR: 'row', TD: 'cell'};
const CAPTION_GAP = 4;
const SVG = 'http://www.w3.org/2000/svg';

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

/** Hides each caption of the scale that would touch the last one shown. */
const fit = (scale) => {
	let shown = null;
	for (const caption of scale.children) {
		const box = caption.getBoundingClientRect();
		const crowded = shown !== null && box.left < shown.right + CAPTION_GAP && shown.left < box.right + CAPTION_GAP;
		caption.toggleAttribute('data-crowded', crowded);
		shown = crowded ? shown : box;
	}
};

const sized = new ResizeObserver((entries) => entries.forEach((entry) => fit(entry.target)));

/** Draws the line through the values, oldest first, behind the box's rows - and the area under it for a chart. */
const line = (box, values, area) => {
	const points = values.map((value, i) => (i + 0.5) + ',' + ((1 - value) * 1000).toFixed(1)).join(' ');
	const was = box.querySelector(':scope > svg[data-line]');
	if (was?.querySelector('polyline')?.getAttribute('points') === points) {
		return;
	}
	was?.remove();
	if (values.length === 0) {
		return;
	}
	const svg = document.createElementNS(SVG, 'svg');
	svg.setAttribute('data-line', '');
	svg.setAttribute('aria-hidden', 'true');
	svg.setAttribute('viewBox', '0 0 ' + values.length + ' 1000');
	svg.setAttribute('preserveAspectRatio', 'none');
	if (area) {
		const under = document.createElementNS(SVG, 'polygon');
		under.setAttribute('points', '0.5,1000 ' + points + ' ' + (values.length - 0.5) + ',1000');
		svg.append(under);
	}
	const stroke = document.createElementNS(SVG, 'polyline');
	stroke.setAttribute('points', points);
	svg.append(stroke);
	box.prepend(svg);
};

/** A value between 0 and 1 from an element's data-v. */
const share = (element) => Math.min(1, Math.max(0, Number(element?.getAttribute('data-v')) || 0));

/** Draws one chart: its numbers, a chart table's roles and a board's captions. */
const draw = (chart) => {
	for (const element of [chart, ...chart.querySelectorAll(NUMBERS.map((name) => '[data-' + name + ']').join(', '))]) {
		number(element);
	}
	for (const scale of chart.querySelectorAll('.lanes-scale')) {
		fit(scale);
		sized.observe(scale);
	}
	if (chart.matches('table:is(.chart, .chart-rows)')) {
		chart.setAttribute('role', 'table');
		for (const part of chart.querySelectorAll('caption, thead, tbody, tr, th, td')) {
			part.setAttribute('role', part.tagName === 'TH' ? (part.closest('thead') === null ? 'rowheader' : 'columnheader') : ROLES[part.tagName]);
		}
	}
	if (chart.matches('table.chart-line')) {
		for (const body of chart.tBodies) {
			const rows = [...body.rows];
			rows.forEach((row) => row.style.setProperty('--v', String(share(row.querySelector('td[data-v]')))));
			line(body, rows.map((row) => share(row.querySelector('td[data-v]'))), true);
		}
	}
	if (chart.matches('.spark-line')) {
		line(chart, [...chart.querySelectorAll(':scope > i')].map(share), false);
	}
};

/** Whether the change is only a line this script drew. */
const drawn = (record) => record.type === 'childList' && [...record.addedNodes, ...record.removedNodes].every((node) => node instanceof SVGElement && node.hasAttribute('data-line'));

document.querySelectorAll(DRAWN).forEach(draw);

document.fonts?.ready.then(() => document.querySelectorAll('.lanes-scale').forEach(fit));

new MutationObserver((records) => {
	const charts = new Set();
	for (const record of records.filter((one) => !drawn(one))) {
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

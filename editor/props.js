// REDZ.UI editor, the properties of any element: the catalog names an element by its selector and each property by its classes, so
// every setting reads and writes the markup itself, and a new variant in the library is one line in tools/catalog.json.
import {CATALOG} from './catalog.js';

const SIZES = ['XS', 'S', 'M', 'L', 'XL'];
const SWATCH = {plain: '--redz-text-muted', active: '--redz-border-strong'};

/** The catalog's entry of an element, or null. */
export const elementOf = (node) => CATALOG.find((one) => node.matches(one.match)) ?? null;

const pairOf = (node, prop) => {
	const base = prop.compose.slice(0, prop.compose.indexOf('{'));
	for (const name of node.classList) {
		const found = name.startsWith(base) ? /^(outline-|subtle-)?(primary|secondary|success|danger|warning|info)$/.exec(name.slice(base.length)) : null;
		if (found !== null) {
			return {style: found[1] ?? '', tone: found[2], name};
		}
		if (name === base + 'text' || name === base + 'link') {
			return {style: name.slice(base.length), tone: '', name};
		}
	}
	return {style: '', tone: '', name: ''};
};

/** The value of a property on an element. */
export const readProp = (node, prop) => {
	if (prop.compose !== undefined) {
		return pairOf(node, prop)[prop.key];
	}
	if (prop.attr !== undefined) {
		return node.getAttribute(prop.attr) ?? '';
	}
	return prop.family.find((name) => name !== '' && node.classList.contains(name)) ?? '';
};

/** Writes a property on an element. */
export const writeProp = (node, prop, value) => {
	if (prop.compose !== undefined) {
		const pair = pairOf(node, prop);
		if (pair.name !== '') {
			node.classList.remove(pair.name);
		}
		const next = {...pair, [prop.key]: value};
		const base = prop.compose.slice(0, prop.compose.indexOf('{'));
		if (next.style === 'text' || next.style === 'link') {
			node.classList.add(base + next.style);
		} else if (next.tone !== '') {
			node.classList.add(base + next.style + next.tone);
		}
		return;
	}
	if (prop.attr !== undefined) {
		if (value === '') {
			node.removeAttribute(prop.attr);
		} else {
			node.setAttribute(prop.attr, value);
		}
		return;
	}
	node.classList.remove(...prop.family.filter((name) => name !== ''));
	if (value !== '') {
		node.classList.add(value);
	}
};

/** The choices of a property as [value, label key or words, swatch]. */
export const choices = (prop) => prop.family.map((value, index) => {
	if (prop.kind === 'size') {
		const middle = prop.family.includes('') ? prop.family.indexOf('') : (prop.family.length - 1) >> 1;
		return [value, {words: SIZES[2 + index - middle]}];
	}
	if (prop.kind === 'tone') {
		const name = value === '' ? 'plain' : value.split('-').pop();
		return [value, {key: 'tone.' + name}, 'var(' + (SWATCH[name] ?? '--redz-' + name) + ')'];
	}
	if (prop.labels !== undefined) {
		return [value, /^\d/.test(prop.labels[index]) ? {words: prop.labels[index]} : {key: 'value.' + prop.labels[index]}];
	}
	return [value, {key: value === '' ? 'value.no' : 'value.yes'}];
});

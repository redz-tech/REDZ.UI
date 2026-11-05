// REDZ.UI editor, what can be inserted: the package's blocks of REDZ.UI markup, their sample words from the page's texts; {id} becomes a
// fresh id.
import {say} from './words.js';

/** The blocks of the Insert menu. */
export const templates = () => {
	const title = say('sample.title');
	const words = say('sample.text');
	const item = (n) => say('sample.item', {n});
	const tones = [['info', 'block.alert-info', 'info-circle'], ['success', 'block.alert-success', 'check-circle'], ['warning', 'block.alert-warning', 'exclamation-triangle'], ['danger', 'block.alert-danger', 'x-octagon']].map(([tone, key, icon]) => ({id: 'alert-' + tone, group: 'content', icon, label: say(key), html: '<div class="alert alert-' + tone + '"><i class="bi bi-' + icon + '" aria-hidden="true"></i><div>' + words + '</div></div>'}));
	const list = [1, 2, 3];
	return [
		...tones,
		{id: 'card', group: 'content', icon: 'card-text', label: say('block.card'), html: '<div class="card"><div class="card-body vstack gap-8"><h3>' + title + '</h3><p>' + words + '</p></div></div>'},
		{id: 'cards', group: 'content', icon: 'card-text', label: say('block.cards'), html: '<div class="grid md:cols-3 gap-16">' + list.map((n) => '<div class="card"><div class="card-body vstack gap-8"><h3>' + item(n) + '</h3><p>' + words + '</p></div></div>').join('') + '</div>'},
		{id: 'accordion', group: 'content', icon: 'chevron-bar-expand', label: say('block.accordion'), html: '<div class="accordion">' + list.map((n) => '<details class="accordion-item" name="{id}"><summary class="accordion-header">' + item(n) + '<i class="bi bi-chevron-down accordion-icon" aria-hidden="true"></i></summary><div class="accordion-body">' + words + '</div></details>').join('') + '</div>'},
		{id: 'tabs', group: 'content', icon: 'segmented-nav', label: say('block.tabs'), html: '<div class="vstack gap-12"><div class="nav nav-underline" role="tablist" aria-label="' + title + '">' + list.map((n) => '<button class="nav-link" type="button" role="tab" id="{id}-' + n + '" aria-selected="' + (n === 1) + '" aria-controls="{id}-panel-' + n + '">' + item(n) + '</button>').join('') + '</div>' + list.map((n) => '<div id="{id}-panel-' + n + '" role="tabpanel" aria-labelledby="{id}-' + n + '" tabindex="0"' + (n === 1 ? '' : ' hidden') + '><p>' + words + '</p></div>').join('') + '</div>'},
		{id: 'list-group', group: 'content', icon: 'list-task', label: say('block.list-group'), html: '<ul class="list-group">' + list.map((n) => '<li class="list-group-item">' + item(n) + '</li>').join('') + '</ul>'},
		{id: 'table', group: 'content', icon: 'table', label: say('block.table'), html: '<table class="table"><thead><tr><th scope="col">' + item(1) + '</th><th scope="col">' + item(2) + '</th></tr></thead><tbody><tr><td>' + words + '</td><td>' + words + '</td></tr></tbody></table>'},
		{id: 'stepper', group: 'content', icon: 'signpost-split', label: say('block.stepper'), html: '<ol class="stepper">' + list.map((n) => '<li class="stepper-item">' + item(n) + '</li>').join('') + '</ol>'},
		{id: 'carousel', group: 'content', icon: 'images', label: say('block.carousel'), html: '<div class="carousel" id="{id}" role="region" aria-label="' + title + '"><div class="carousel-inner" tabindex="0" aria-label="' + title + '">' + list.map((n) => '<div class="carousel-item"><div class="p-24 bg-primary-subtle"><strong>' + item(n) + '</strong></div></div>').join('') + '</div><div class="hstack gap-8 justify-content-between"><button class="btn btn-icon" type="button" command="--prev" aria-controls="{id}" aria-label="' + say('sample.previous') + '"><i class="bi bi-chevron-left" aria-hidden="true"></i></button><div class="carousel-indicators"></div><button class="btn btn-icon" type="button" command="--next" aria-controls="{id}" aria-label="' + say('sample.next') + '"><i class="bi bi-chevron-right" aria-hidden="true"></i></button></div></div>'},
		{id: 'badges', group: 'inline', icon: 'tag', label: say('block.badges'), html: '<p class="hstack flex-wrap gap-8"><span class="badge badge-primary">' + item(1) + '</span><span class="badge badge-subtle-success">' + item(2) + '</span><span class="badge">' + item(3) + '</span></p>'},
		{id: 'buttons', group: 'inline', icon: 'hand-index-thumb', label: say('block.buttons'), html: '<p class="hstack flex-wrap gap-8"><a class="btn btn-primary" href="#">' + item(1) + '</a><a class="btn" href="#">' + item(2) + '</a></p>'},
		{id: 'button-group', group: 'inline', icon: 'three-dots', label: say('block.button-group'), html: '<div class="btn-group" role="group" aria-label="' + title + '">' + list.map((n) => '<a class="btn" href="#">' + item(n) + '</a>').join('') + '</div>'},
		{id: 'progress', group: 'inline', icon: 'bar-chart-steps', label: say('block.progress'), html: '<p class="vstack gap-4"><span>' + title + '</span><progress class="progress" value="40" max="100" aria-label="' + title + '">40%</progress></p>'},
		{id: 'grid-2', group: 'layout', icon: 'layout-split', label: say('block.grid-2'), html: '<div class="grid md:cols-2 gap-16"><div><p>' + words + '</p></div><div><p>' + words + '</p></div></div>'},
		{id: 'grid-3', group: 'layout', icon: 'layout-three-columns', label: say('block.grid-3'), html: '<div class="grid md:cols-3 gap-16"><div><p>' + words + '</p></div><div><p>' + words + '</p></div><div><p>' + words + '</p></div></div>'},
	];
};

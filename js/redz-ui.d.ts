// REDZ.UI, its types for an editor: REDZ.ui and the redz:* events the widgets fire, as a page's scripts call and hear
// them. A browser never loads this file and no project needs TypeScript: an editor that reads TypeScript's
// declarations - PhpStorm, VS Code - finds it beside the scripts and types what a plain script writes. A global
// script, no import or export: a project adds its own members to REDZ and REDZ.ui by declaring interface Redz or
// interface RedzUi again, and a package's file - js/redz-ui-editor.d.ts, js/redz-ui-qr.d.ts - adds its call the same
// way. tools/build.php holds it to the scripts: every member js/index.js puts in REDZ.ui and every event a script
// fires is declared here.

/** The tone of a message: its colour and its icon. */
type RedzTone = 'info' | 'success' | 'warning' | 'danger';

/** The tone of a button: its colour. */
type RedzButtonTone = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info';

/** Words in a tone, as text, never HTML. */
interface RedzMessage {
	tone?: RedzTone;
	text: string;
}

/** What an upload holds: its files, those still sending and those refused. */
interface RedzUploadState {
	count: number;
	pending: number;
	failed: number;
}

/** What the page knows of a list it fills by more: its total, or that it ended. */
interface RedzMoreAnswer {
	total?: number;
	done?: boolean;
}

/** Trusted Types' markup, which TypeScript's DOM library does not name yet; a later one merges with it. */
interface TrustedHTML {
	toJSON(): string;
}

/** What a swap takes: never a string of markup. */
type RedzSwapSource = DocumentFragment | Document | Element | TrustedHTML;

/** A toast: its words, its tone, a button of its own, whether it stays until closed, and its group. */
interface RedzToast {
	title?: string;
	text?: string;
	/** info by default; danger, and a toast with an action, stay until closed. */
	tone?: RedzTone | 'primary';
	action?: {label: string; run(): void} | null;
	persistent?: boolean;
	/** A name the page gives: the toast takes the place of the group's toast before it, closed as it shows. */
	group?: string;
}

/** A choice of radios above the phrase: the answer is then the chosen value. */
interface RedzConfirmChoice {
	label: string;
	items: {value: string; text: string; hint?: string}[];
	/** The value chosen at the start. */
	value?: string;
}

/** A third answer at the footer's start, such as Discard beside Stay and Save: it answers its value. */
interface RedzConfirmAlt {
	text: string;
	tone?: RedzButtonTone;
	/** 'alt' by default. */
	value?: string;
}

/** A question in a modal alert dialog; every word is text, never HTML, and the buttons' words default to the page's texts. */
interface RedzConfirm {
	title?: string;
	text?: string;
	note?: RedzMessage | null;
	/** A summary: a label and its value, such as what a payment is. */
	rows?: {label: string; value: string | number}[];
	/** A title over a list, such as what goes and what stays. */
	sections?: {title: string; items: string[]}[];
	choice?: RedzConfirmChoice | null;
	ok?: string;
	cancel?: string;
	/** The confirming button's tone, primary by default; danger paints it red. */
	tone?: RedzButtonTone;
	/** Words the person types before the confirming button wakes. */
	phrase?: string;
	alt?: RedzConfirmAlt | null;
	/** Where the focus starts, cancel by default; never ok or alt for an answer that destroys. */
	focus?: 'cancel' | 'ok' | 'alt';
	/** Carries the answer out before the dialog closes: the dialog waits for its promise, and a refusal with words shows
	 *  them and stays open. */
	run?: ((asked: {choice: string; phrase: string; signal: AbortSignal}) => unknown) | null;
}

/** A question for one value in a modal dialog. */
interface RedzPrompt {
	title?: string;
	text?: string;
	label?: string;
	value?: string;
	placeholder?: string;
	/** An input's type, text by default. */
	type?: string;
	inputmode?: string;
	pattern?: string;
	required?: boolean;
	ok?: string;
	cancel?: string;
	tone?: RedzButtonTone;
}

/** A file to download: words, a CSV with a UTF-8 byte order mark unless bom is false. */
interface RedzDownloadText {
	text: string;
	/** download.txt by default. */
	file?: string;
	/** text/plain by default; charset=utf-8 is added. */
	type?: string;
	bom?: boolean;
}

/** A file to download: a blob as it is. */
interface RedzDownloadBlob {
	blob: Blob;
	file?: string;
}

/** What a white label paints in one theme: each colour as #rrggbb in sRGB, each ratio to two decimals. */
interface RedzBrandTheme {
	/** The tone, --redz-primary. */
	tone: string;
	/** The words on the tone, --redz-primary-contrast. */
	text: string;
	/** A link on the ground, --redz-link. */
	link: string;
	/** The focus ring, --redz-focus. */
	ring: string;
	/** A checked box, a bar, a mark, --redz-primary-fill. */
	fill: string;
	/** The ground, --redz-bg. */
	ground: string;
	textOnTone: number;
	linkOnGround: number;
	ringOnGround: number;
	toneOnGround: number;
	fillOnGround: number;
	textOnFill: number;
}

/** What a white label of a colour paints, theme by theme. */
interface RedzBrand {
	light: RedzBrandTheme;
	dark: RedzBrandTheme;
}

/** One change of a tracked form against its saved state. */
interface RedzChange {
	/** The field's name. */
	name: string;
	/** The words a person reads for it. */
	label: string;
	/** Its saved value; null for a secret. */
	was: unknown;
	/** Its value now; null for a secret. */
	now: unknown;
	/** A secret's field: its values are not told. */
	secret?: boolean;
	/** The secret was cleared. */
	cleared?: boolean;
}

/** The tracked forms, form[data-track], for code. */
interface RedzTrack {
	/** Draws the save bar and the changed marks again. */
	refresh(): void;
	/** Takes the form as it is now for its saved state. */
	baseline(form: HTMLFormElement): void;
	/** Puts the form back to its saved state. */
	reset(form: HTMLFormElement): void;
	/** Whether the form changed. */
	dirty(form: HTMLFormElement): boolean;
	/** The forms that changed. */
	dirty(): HTMLFormElement[];
	/** The form's changes against its saved state. */
	changed(form: HTMLFormElement): RedzChange[];
	/** Saves the form, or every changed one: whether it saved. */
	save(form?: HTMLFormElement): Promise<boolean>;
}

/** The library's calls, REDZ.ui; a project or a package adds its own by declaring interface RedzUi again. */
interface RedzUi {
	/** Shows a toast; answers a function that closes it. */
	toast(toast?: RedzToast): () => void;
	/** Lights a field that took a result the person sees in it - a hidden input's time or date face - in the success tone
	 *  for 2 s, in place of a toast, and says the page's words politely. */
	flash(element: Element, words?: string): void;
	/** Asks; with a choice, a promise of the chosen value or false. */
	confirm(question: RedzConfirm & {choice: RedzConfirmChoice}): Promise<string | false>;
	/** Asks; with alt, a promise of true, alt's value or false. */
	confirm(question: RedzConfirm & {alt: RedzConfirmAlt}): Promise<boolean | string>;
	/** Asks: a promise of true, or false for cancel and Escape. */
	confirm(question?: RedzConfirm): Promise<boolean>;
	/** Marks the element busy until the promise settles; answers the promise. */
	busy<T>(element: Element, promise: T | PromiseLike<T>): Promise<T>;
	/** Asks for one value: a promise of it, or null for cancel and Escape. */
	prompt(question?: RedzPrompt): Promise<string | null>;
	/** Shows the page's progress bar while the promise runs; answers the promise. */
	progress<T>(promise: T | PromiseLike<T>): Promise<T>;
	/** Chooses a tab from code, as a person would: a promise of whether it is selected. */
	select(tab: Element | null): Promise<boolean>;
	/** Says in the .form-status line what the promise does - saving, saved, or its refusal's words; answers the promise. */
	status<T>(line: Element, promise: PromiseLike<T>): Promise<T>;
	/** Says the words in the line at once, or empties it for null; keep holds words of success and info. */
	status(line: Element, message: (RedzMessage & {keep?: boolean}) | null): Promise<void>;
	/** Shows the page's one banner in place of the one shown, or removes it for null; answers a function that removes it. */
	banner(message: RedzMessage | null): () => void;
	/** Chooses the region's filter values from code - {name: value}, null clears every name and search; answers its count. */
	filter(region: Element, values: Record<string, string | number | boolean | null | undefined> | null): number;
	/** Sorts the table again by the order its header says. */
	sort(table: Element): void;
	/** Starts the list's more buttons again after its items were replaced, with what the page knows of them now. */
	more(list: Element, answer?: RedzMoreAnswer): void;
	/** Reads the selections in or around the element again - its checks changed by code - and fires redz:selection where one changed. */
	selection(element: Element): void;
	/** Shows in the box the busy words, then the {tone, text} the promise answers or its refusal's words; answers the promise. */
	alert<T>(box: Element, promise: PromiseLike<T>): Promise<T>;
	/** Fills the box with an alert of the words, or empties it for null. */
	alert(box: Element, message: RedzMessage | null): Promise<void>;
	/** Downloads words or a blob as a file, and says so. */
	download(file: RedzDownloadText | RedzDownloadBlob): void;
	upload: {
		/** Takes away the upload's new rows, their sending aborted, and keeps the stored ones. */
		clear(upload: Element): void;
		/** A promise of what the upload holds once nothing in it is sending. */
		settled(upload: Element): Promise<RedzUploadState>;
	};
	combobox: {
		/** Sets what a list holds from the page, as a choice does; a TypeError for no list. */
		set(list: Element | string, values: string | string[]): void;
	};
	track: RedzTrack;
	/** Puts new content into the region and keeps what the person was doing there: a promise of true once done, false
	 *  when a newer swap overtook it or the signal aborted. */
	swap(region: Element, source: RedzSwapSource, options?: {signal?: AbortSignal}): Promise<boolean>;
	/** Puts each top element of the source with an id into its namesake on the page. */
	swap(source: RedzSwapSource, options?: {signal?: AbortSignal}): Promise<boolean>;
	/** Reads the show-when rules of the form, or of the page, again: after a value set by code. */
	follow(form?: HTMLFormElement): void;
	/** Takes what the form's chips entries still hold: false, the focus on the first one refused, when one is refused. */
	settle(form: HTMLFormElement): boolean;
	/** What a white label of the colour - any CSS colour - paints, theme by theme, its links of options.link when given;
	 *  null for a value that is no colour. */
	brand(colour: string, options?: {link?: string}): RedzBrand | null;
}

/** REDZ, the family's global; a project adds its own members by declaring interface Redz again. */
interface Redz {
	ui: RedzUi;
}

declare var REDZ: Redz;

/** window.REDZ, as a script reads it: PhpStorm types it from here, not from declare var. */
interface Window {
	REDZ: Redz;
}

/** A moment only the page can carry out, as a cancelable event's detail: the page that takes it cancels the event, and
 *  with respondWith lets the widget wait and finish when the promise settles; left alone, the widget acts on its own. */
/** A day's entry of a date picker's counts: a number in a pill, said with the box's count text, or words alone; a tone;
 *  a day not to pick and why. */
interface RedzDayCount {n?: number; text?: string; tone?: 'danger' | 'warning' | 'success'; off?: boolean; note?: string}

type RedzAsk<Detail, Answer = unknown> = Detail & {respondWith(answer: Answer | PromiseLike<Answer>): void};

/** A form saved: a form method="dialog" in a dialog gives data and submitter, a tracked form changed too, an inline
 *  edit value alone. */
interface RedzSaveDetail {
	form: HTMLFormElement;
	data?: FormData;
	submitter?: HTMLElement | null;
	signal?: AbortSignal;
	/** A tracked form's changes. */
	changed?: RedzChange[];
	/** An inline edit's value. */
	value?: string;
}

/** The redz:* events, each on its widget, bubbling to the document and the window. PhpStorm does not take a listener's
 *  event from these maps: it reads it from the listener's annotation, @param {RedzEventMap['redz:save']} event. */
interface RedzEventMap {
	/** A form to save; an inline edit shows the saved text a promise answers, a tracked form's answer becomes redz:saved's value. */
	'redz:save': CustomEvent<RedzAsk<RedzSaveDetail>>;
	/** A tracked form saved: what was sent is its saved state. */
	'redz:saved': CustomEvent<{form: HTMLFormElement; value: unknown}>;
	/** A tracked form's changes put back. */
	'redz:discard': CustomEvent<{form: HTMLFormElement}>;
	/** A swap done, on its region. */
	'redz:swap': CustomEvent<null>;
	/** A sidebar's group opened or closed. */
	'redz:group': CustomEvent<{open: boolean}>;
	/** Words copied, on their button. */
	'redz:copy': CustomEvent<{text: string}>;
	/** A combobox's new value to create: answered with its value, or {value, label}. */
	'redz:create': CustomEvent<RedzAsk<{label: string}, string | {value?: string; label?: string}>>;
	/** A search to run: a search field's (filter.js) answers with respondWith; a combobox's is canceled and the page
	 *  sets the list. */
	'redz:search': CustomEvent<{query: string; form?: FormData; signal: AbortSignal; respondWith?(answer: (RedzMoreAnswer & {count?: number}) | void | PromiseLike<(RedzMoreAnswer & {count?: number}) | void>): void}>;
	/** A pin to check: answered with whether it is right. */
	'redz:pin': CustomEvent<RedzAsk<{value: string}, boolean>>;
	/** A tab selected, on its tablist. */
	'redz:selected': CustomEvent<{tab: Element}>;
	/** A tab to select: answered with whether it may be. */
	'redz:select': CustomEvent<RedzAsk<{tab: Element; from: Element | null}, boolean>>;
	/** The theme chosen: light, dark or system. */
	'redz:theme': CustomEvent<{theme: string}>;
	/** What an upload holds changed. */
	'redz:change': CustomEvent<RedzUploadState>;
	/** A file to send: answered with nothing, the file in another form, or its id on the server; a file the crop package
	 *  framed first carries the file as picked and the frame's corners in the photo's own pixels. */
	'redz:files': CustomEvent<RedzAsk<{file: File; row: Element; progress(fraction: number): void; signal: AbortSignal; original?: File; points?: [number, number][]}, Blob | string | number | void>>;
	/** A row to take away: an upload's stored file (id) answers with respondWith; a repeat's row is kept when canceled. */
	'redz:remove': CustomEvent<{id?: string; row: Element; respondWith?(answer: unknown): void}>;
	/** A password shown or hidden. */
	'redz:reveal': CustomEvent<{revealed: boolean}>;
	/** Contents to load the first time the region shows; group is the element with data-lazy. */
	'redz:load': CustomEvent<RedzAsk<{region: Element; group: Element}>>;
	/** A selection's checks changed: the values of the checked ones in the page's order, and in the order they were checked. */
	'redz:selection': CustomEvent<{count: number; total: number; values: string[]; order: string[]}>;
	/** A switch or a check to carry out: refused, it turns back. */
	'redz:apply': CustomEvent<RedzAsk<{checked: boolean; value: string; signal: AbortSignal}>>;
	/** A sidebar folded or opened. */
	'redz:fold': CustomEvent<{folded: boolean}>;
	/** A row added to a repeat; canceled, it is not. */
	'redz:add': CustomEvent<{row: Element}>;
	/** A list's view chosen. */
	'redz:view': CustomEvent<{view: string}>;
	/** A menu's check item turned. */
	'redz:check': CustomEvent<{item: Element; checked: boolean}>;
	/** The next items to load: answered with the total or the end, or nothing. */
	'redz:more': CustomEvent<RedzAsk<{shown: number; signal: AbortSignal}, RedzMoreAnswer | void>>;
	/** A region filtered: what shows of how many. */
	'redz:filter': CustomEvent<{count: number; total: number}>;
	/** An item moved: its list, the list it left, its new parent, null at the top, and its position from 0; refused, it
	 *  goes back. */
	'redz:move': CustomEvent<RedzAsk<{item: Element; list: Element; from: Element; parent: Element | null; position: number}>>;
	/** A table's order to sort by: a page that sorts itself takes it, and a refusal puts the order back. */
	'redz:sort': CustomEvent<RedzAsk<{key: string; direction: 'ascending' | 'descending' | 'none'}>>;
	/** A date picker of the calendar package shows other months: the first and the last day they show, ISO dates, and
	 *  the box's data-context; answered with the days' counts, {"YYYY-MM-DD": n or {n, text, tone, off, note}}, kept by
	 *  month and context. */
	'redz:month': CustomEvent<RedzAsk<{from: string; to: string; context: string}, Record<string, number | RedzDayCount>>>;
}

interface DocumentEventMap extends RedzEventMap {}

interface WindowEventMap extends RedzEventMap {}

interface HTMLElementEventMap extends RedzEventMap {}

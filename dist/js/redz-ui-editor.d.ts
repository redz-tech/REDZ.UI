/*! REDZ.UI - PolyForm Strict 1.0.0 - https://github.com/redz-tech/REDZ.UI */
// REDZ.UI, the editor package's types for an editor: REDZ.ui.editor, added to interface RedzUi of js/redz-ui.d.ts,
// with its options and the calls it answers. A browser never loads this file.

/** What a person may do; given rights are all there is, a key left out is off. */
interface RedzEditorRights {
	/** The source of the page and of a block: the expert mode. */
	html?: boolean;
	/** What the AI can do; it acts with the person's own rights. */
	ai?: boolean;
	/** Settings, forms, the style of a block, color and alignment. */
	design?: boolean;
	/** Adding, moving and removing blocks, rows, columns and items. */
	structure?: boolean;
	/** Prices, dates and other live facts in the text. */
	facts?: boolean;
	/** Protecting a block and editing a protected one. */
	lock?: boolean;
	/** Signing text an AI or a machine wrote as checked. */
	review?: boolean;
	/** '*' or the languages this person may write in. */
	langs?: '*' | string[];
}

/** A stored version of a block. */
interface RedzEditorVersion {
	at: Date | string | number;
	by?: string;
	html: string;
}

/** A live fact: written once as <data value="KEY">, it stands in every place it is used. */
interface RedzEditorFact {
	key: string;
	label: string;
	text: string;
	editable?: boolean;
}

/** One of the text's languages; the host keeps each one's value. */
interface RedzEditorLanguage {
	code: string;
	label: string;
	dir?: 'ltr' | 'rtl';
	value?: string | PromiseLike<string>;
	versions?: Record<string, RedzEditorVersion[]>;
}

/** An image an image source puts in at the caret. */
interface RedzEditorImage {
	src: string;
	alt?: string;
	width?: number | string;
	height?: number | string;
	srcset?: string;
	sizes?: string;
	/** A picture's sources, before its img. */
	sources?: {srcset: string; type?: string; media?: string}[];
}

/** A block as a task sends it: its words as plain text, one string for each field, a fact as a token ⟦KEY⟧. */
interface RedzEditorBlock {
	id: string;
	hash: string;
	/** Its element's id in the catalog, or its tag. */
	element: string;
	fields: string[];
	/** translate: the fields of the translation that stands, or null. */
	was?: string[] | null;
}

/** A task for the host's AI; kind says what else it holds. */
interface RedzEditorTask {
	id: string;
	lang: string;
	kind: 'rewrite' | 'tones' | 'translate' | 'write' | 'read' | 'alt';
	/** rewrite: shorter, simpler, warmer or fix. */
	how?: 'shorter' | 'simpler' | 'warmer' | 'fix';
	blocks?: RedzEditorBlock[];
	/** translate: the languages. */
	from?: string;
	to?: string;
	/** write: a person's request. */
	words?: string;
	facts?: RedzEditorFact[];
	/** read: the question, and the page as a visitor reads it. */
	question?: string;
	text?: string;
	/** alt: an image's address. */
	src?: string;
}

/** The AI's answer to a task; {refusal} says the model declined. */
interface RedzEditorAnswer {
	blocks?: unknown[];
	grid?: unknown[][];
	text?: string;
	refusal?: string;
}

/** The editor's options: every one may be left out. */
interface RedzEditorOptions {
	/** The markup to edit; it is cleaned before it is shown. */
	value?: string;
	/** Keeps every block's id, protection, author, check and source in the value: what a CMS stores. */
	ids?: boolean;
	/** Left out, all but HTML and protection. */
	rights?: RedzEditorRights;
	/** The words of an empty text, also the text field's name. */
	placeholder?: string;
	lang?: string;
	dir?: 'ltr' | 'rtl';
	/** The theme's stylesheets for the text and the previews, after REDZ.UI's own. */
	styles?: string[];
	/** The theme's scripts for the previews. */
	scripts?: string[];
	/** Other looks of the same text, chosen in the strip above it. */
	sites?: {id: string; label: string; styles: string[]}[];
	languages?: RedzEditorLanguage[];
	getLanguage?(code: string): string | PromiseLike<string>;
	onLanguage?(code: string, html: string): unknown;
	/** The language translations are made from, the first of languages by default. */
	source?: string;
	/** The page's live facts, or a function of the language that answers them. */
	facts?: RedzEditorFact[] | ((lang: string) => RedzEditorFact[] | PromiseLike<RedzEditorFact[]>);
	/** Saves a fact's new value; false refuses it. */
	onFact?(key: string, text: string): boolean | void | PromiseLike<boolean | void>;
	/** The host's way to its AI; left out, nothing of the AI shows. */
	ai?(task: RedzEditorTask, how: {signal: AbortSignal; progress(partial: unknown): void}): PromiseLike<RedzEditorAnswer>;
	/** A task's changes decided, one call for one task: what a CMS records as one batch. */
	onBatch?(batch: {id: string | null; kind: string | null; by: string; blocks: string[]; taken: number; left: number}): void;
	/** Who signs what is checked. */
	person?: {name: string};
	/** false takes the strip away. */
	lens?: boolean;
	/** More blocks for the menu, after the package's own. */
	blocks?: {id: string; label: string; group?: string; icon?: string; html: string}[];
	/** Sources of images. */
	images?: {id: string; label: string; open(api: {insert(image: RedzEditorImage): void}): void}[];
	/** Videos from YouTube and Vimeo; on unless false. */
	embed?: boolean;
	/** The blocks of columns; on unless false. */
	grid?: boolean;
	/** Each block's stored versions, by its id. */
	versions?: Record<string, RedzEditorVersion[]>;
	/** Called after a pause in typing and after every command. */
	onChange?(html: string): void;
	/** Called once the frame holds the text. */
	onReady?(): void;
}

/** The calls an editor answers. */
interface RedzEditor {
	getHTML(): string;
	setHTML(html: string): void;
	setRights(rights: RedzEditorRights): void;
	focus(): void;
	destroy(): void;
}

interface RedzUi {
	/** Makes the editor in the host, an element or a selector; a TypeError for no host. */
	editor(host: HTMLElement | string, options?: RedzEditorOptions): RedzEditor;
}

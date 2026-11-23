/*! REDZ.UI - https://github.com/redz-tech/REDZ.UI */
// REDZ.UI, the proof file's types for an editor: the task, the worker's messages and the page's event redz:solver. It
// stands alone, as the file does: a page that loads no other file of the library reads these. A browser never loads
// this file.

/** A proof task as REDZ.ID issues it: id 32 hex characters, prefix hex, kmac base64url without padding, cost and max
 *  positive integers. Another alg, no label or a field of another shape is a task the solver does not know. */
interface RedzProofTask {
	alg: 'pbkdf2-sha256';
	id: string;
	cost: number;
	max: number;
	prefix: string;
	kmac: string;
	label: string;
	v?: number;
}

/** Solves the task: the counter, or -1 for none found, a task it does not know, an end by the signal or a failure;
 *  never rejects. width is the lanes, 4 unless told. */
type RedzSolve = (task: RedzProofTask, options?: {width?: number; signal?: AbortSignal}) => Promise<number>;

/** What a page posts to the proof file as a worker: a walk, or the end of one. */
type RedzProofAsk = {at: number; task: RedzProofTask; width?: number} | {at: number; stop: true};

/** What the proof file as a worker posts back, once for each walk, in any order. */
interface RedzProofAnswer {
	at: number;
	found: number;
}

interface RedzEventMap {
	/** The proof file, loaded into a page, gives its solver. */
	'redz:solver': CustomEvent<RedzSolve>;
}

interface DocumentEventMap extends RedzEventMap {}

// REDZ.UI, the proof of work of a form, as REDZ.ID issues it and REDZ CMS's visitor forms ask it: a task names a
// label, an id of 16 bytes as 32 hex characters, a cost, a max, a hex prefix and a kmac. Its key for a counter is
// PBKDF2-SHA256 of the label, salted by the id's bytes and the counter as an unsigned 32-bit big-endian number, cost
// times, 32 bytes; the counter sought is the one whose key starts with the prefix and signs the id's text, by
// HMAC-SHA256, into the kmac in base64url without padding. Lanes walk the counters from 0 below max side by side, 4
// unless told. Shared by the proof file (proof/proof.js) and the sign-in package (signin/signin.js).
const encoder = new TextEncoder();

/** A text of hex as lower case, each byte two digits. */
const hexOf = (bytes) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

/** Bytes in base64url, without padding. */
const base64urlOf = (bytes) => btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Whether the task is one this walk knows: its algorithm, a label, and every field of the shape it must have. */
const known = (task) => task !== null && typeof task === 'object' && task.alg === 'pbkdf2-sha256' && typeof task.label === 'string' && task.label !== ''
	&& typeof task.id === 'string' && /^[0-9a-f]{32}$/i.test(task.id) && typeof task.prefix === 'string' && /^(?:[0-9a-f]{2})*$/i.test(task.prefix)
	&& typeof task.kmac === 'string' && /^[\w-]+$/.test(task.kmac) && Number.isInteger(task.cost) && task.cost > 0
	&& Number.isInteger(task.max) && task.max > 0 && task.max <= 2 ** 32;

/** Walks the task: answers the counter, or -1 for a task it does not know, none found below max, an end by the signal
 *  or anything the browser's cryptography refuses. Never rejects. */
export const solve = async (task, {width = 4, signal} = {}) => {
	try {
		if (!known(task) || signal?.aborted) {
			return -1;
		}
		const subtle = crypto.subtle;
		const base = await subtle.importKey('raw', encoder.encode(task.label), 'PBKDF2', false, ['deriveBits']);
		const id = Uint8Array.from(task.id.match(/../g), (pair) => parseInt(pair, 16));
		const text = encoder.encode(task.id);
		const prefix = task.prefix.toLowerCase();
		let next = 0;
		let found = -1;
		const lane = async () => {
			while (found < 0 && next < task.max && !signal?.aborted) {
				const counter = next++;
				const salt = new Uint8Array(20);
				salt.set(id);
				new DataView(salt.buffer).setUint32(16, counter);
				const key = new Uint8Array(await subtle.deriveBits({name: 'PBKDF2', hash: 'SHA-256', salt, iterations: task.cost}, base, 256));
				if (found >= 0 || hexOf(key.subarray(0, prefix.length / 2)) !== prefix) {
					continue;
				}
				const mac = await subtle.importKey('raw', key, {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
				if (base64urlOf(new Uint8Array(await subtle.sign('HMAC', mac, text))) === task.kmac) {
					found = counter;
				}
			}
		};
		const lanes = Number.isInteger(width) && width > 0 ? Math.min(width, 16) : 4;
		const ended = new Promise((resolve) => {
			signal?.addEventListener('abort', resolve, {once: true});
		});
		await Promise.race([Promise.all(Array.from({length: lanes}, lane)), ended]);
		return signal?.aborted ? -1 : found;
	} catch {
		return -1;
	}
};

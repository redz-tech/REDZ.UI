// REDZ.UI, sign-in (a package of the release, linked apart): passkeys, the way out of an app's own browser, and the
// proof of work of a form - the browser's side of REDZ.ID. It holds no network and no words: the page fetches every
// option, ticket and task and posts every answer, the results are codes, and the page's texts speak.
// - REDZ.ui.passkey takes the WebAuthn JSON forms a server gives - PublicKeyCredentialCreationOptionsJSON and
//   PublicKeyCredentialRequestOptionsJSON, binary members in base64url - and answers what credential.toJSON() gives,
//   built by itself where the browser lacks the call or a password manager's extension hands back a credential that
//   breaks it. create and get run at once, first in the press; autofill holds the field hint (an input with
//   autocomplete="username webauthn"), stopped while an explicit call runs and armed again when that one fails;
//   upgrade is the quiet creation after a password, silent whatever happens. A result is {ok: true, response} or
//   {ok: false, code, name, app}: unsupported, in_app, cancelled, exists, blocked, aborted, failed - never a browser's
//   own message. An explicit call refused faster than a person can act (300 ms; LINE on iOS does it in 4) is an app's
//   browser the marks missed: in_app, app 'unknown'.
// - [data-open-browser], hidden, shows in an app's own browser once it holds an address: it asks the page for a ticket
//   by redz:handoff ({url, expires}), again in the ticket's last minute while the page shows and when it shows again,
//   and keeps its own href when the page does not answer. Its press copies the address and leaves by the app's way;
//   where the app has none, or the page is still here a moment later, the text "handoff.copied" says it was copied.
// - REDZ.ui.solve runs a proof task in the proof file as a worker from the address the page gives (a string or its own
//   TrustedScriptURL), or in the page where none can start.
import {ask} from '../js/answer.js';
import {text} from '../js/text.js';
import {solve} from '../proof/walk.js';

// The apps whose own browser a page can tell, by a mark of the user agent, in this order: the first that matches names
// it. Telegram is told by the names its browser puts in the page, any other Android WebView by "; wv)", and an iPhone's
// or an iPad's by the missing "Safari/".
const APPS = [
	['line', /\bLine\//i],
	['messenger', /\bFB[\w]+\/Messenger|Orca-Android|MessengerForiOS/i],
	['threads', /\bBarcelona/i],
	['instagram', /\bInstagram/i],
	['facebook', /\bFB[\w]+\/|\bFacebook/i],
	['wechat', /\bMicroMessenger\//i],
	['kakaotalk', /\bKAKAOTALK/i],
	['tiktok', /musical_ly|trill_|Bytedance/i],
	['x', /\bTwitter/i],
	['snapchat', /\bSnapchat/i],
	['linkedin', /\bLinkedInApp/i],
	['pinterest', /\[Pinterest\//i],
	['whatsapp', /\b(?:WAiOS|WA4A)\//],
	['google', /\bGSA\//],
];

// How a page leaves an app's browser on iOS and on Android, by the app: its own scheme with the address encoded after
// it, or null where only the app's menu leads out. Any other app leaves by Safari's scheme on iOS, an intent to the
// default browser on Android; LINE by its parameter on both.
const OUT = {
	ios: {instagram: 'instagram://extbrowser/?url=', threads: 'barcelona://extbrowser/?url=', kakaotalk: 'kakaotalk://web/openExternal?url=', wechat: null, tiktok: null, snapchat: null},
	android: {kakaotalk: 'kakaotalk://web/openExternal?url=', wechat: null},
};

const KEYS = globalThis.PublicKeyCredential;
const FAST = 300;
const held = new Map();
let hint = null;
let refused = false;
let watching = false;

/** The app whose browser this is, or null for a browser of its own. */
const appOf = () => {
	const agent = navigator.userAgent;
	const found = APPS.find(([, mark]) => mark.test(agent));
	if (found) {
		return found[0];
	}
	if ('TelegramWebview' in globalThis || 'TelegramWebviewProxy' in globalThis || 'TelegramWebviewProxyProto' in globalThis) {
		return 'telegram';
	}
	if (/Android.*; wv\)/.test(agent) || /iPhone|iPad|iPod/.test(agent) && !/Safari\//.test(agent)) {
		return 'webview';
	}
	return refused ? 'unknown' : null;
};

/** Whether the page can ask for passkeys at all. */
const supported = () => typeof KEYS === 'function' && typeof navigator.credentials?.create === 'function' && isSecureContext;

/** An ArrayBuffer from base64url. */
const bytesOf = (base64url) => Uint8Array.from(atob(base64url.replace(/-/g, '+').replace(/_/g, '/')), (char) => char.charCodeAt(0)).buffer;

/** Bytes in base64url, without padding. */
const base64urlOf = (buffer) => btoa(Array.from(new Uint8Array(buffer), (byte) => String.fromCharCode(byte)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** The JSON without its null members, at every depth: Safari on iOS 18 refuses them. */
const clean = (value) => Array.isArray(value) ? value.map(clean) : value !== null && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([, member]) => member !== null && member !== undefined).map(([key, member]) => [key, clean(member)])) : value;

/** Credential descriptors with their ids as bytes. */
const descriptorsOf = (list) => list?.map((item) => ({...item, id: bytesOf(item.id)}));

/** The creation options of the JSON form, read by the browser where it can. */
const creationOf = (json) => {
	const options = clean(json);
	if (typeof KEYS.parseCreationOptionsFromJSON === 'function') {
		return KEYS.parseCreationOptionsFromJSON(options);
	}
	return {...options, challenge: bytesOf(options.challenge), user: {...options.user, id: bytesOf(options.user.id)}, excludeCredentials: descriptorsOf(options.excludeCredentials)};
};

/** The request options of the JSON form, read by the browser where it can. */
const requestOf = (json) => {
	const options = clean(json);
	if (typeof KEYS.parseRequestOptionsFromJSON === 'function') {
		return KEYS.parseRequestOptionsFromJSON(options);
	}
	return {...options, challenge: bytesOf(options.challenge), allowCredentials: descriptorsOf(options.allowCredentials)};
};

/** The credential's JSON form: its own toJSON, or the same members read one by one where that is missing or throws. */
const jsonOf = (credential) => {
	try {
		const json = credential.toJSON();
		if (typeof json?.rawId === 'string') {
			return json;
		}
	} catch {
		// A password manager's credential: read below.
	}
	const answer = credential.response;
	const call = (name) => typeof answer[name] === 'function' ? answer[name]() : null;
	const response = {clientDataJSON: base64urlOf(answer.clientDataJSON)};
	if (answer.attestationObject) {
		const data = call('getAuthenticatorData');
		const key = call('getPublicKey');
		Object.assign(response, {attestationObject: base64urlOf(answer.attestationObject), transports: call('getTransports') ?? []}, data ? {authenticatorData: base64urlOf(data)} : {}, key ? {publicKey: base64urlOf(key)} : {}, typeof answer.getPublicKeyAlgorithm === 'function' ? {publicKeyAlgorithm: answer.getPublicKeyAlgorithm()} : {});
	} else {
		Object.assign(response, {authenticatorData: base64urlOf(answer.authenticatorData), signature: base64urlOf(answer.signature)}, answer.userHandle ? {userHandle: base64urlOf(answer.userHandle)} : {});
	}
	const extensions = typeof credential.getClientExtensionResults === 'function' ? credential.getClientExtensionResults() : {};
	return {id: credential.id, rawId: base64urlOf(credential.rawId), type: credential.type, ...credential.authenticatorAttachment ? {authenticatorAttachment: credential.authenticatorAttachment} : {}, response, clientExtensionResults: extensions};
};

/** The result of a credential the browser gave, or of none; failed for one whose members cannot be read. */
const givenOf = (credential) => {
	try {
		return credential ? {ok: true, response: jsonOf(credential)} : {ok: false, code: 'cancelled'};
	} catch (error) {
		return {ok: false, code: 'failed', name: typeof error?.name === 'string' ? error.name : 'Error'};
	}
};

/** The result of a call the browser refused: its code by the error's name, kept beside it; took, for an explicit
 *  call, is how long the refusal took. */
const refusalOf = (error, kind, took = Infinity) => {
	const name = typeof error?.name === 'string' ? error.name : 'Error';
	const app = appOf();
	if (name === 'AbortError') {
		return {ok: false, code: 'aborted', name};
	}
	if (name === 'InvalidStateError' && kind === 'create') {
		return {ok: false, code: 'exists', name};
	}
	if (name === 'SecurityError' || name === 'NotSupportedError') {
		return {ok: false, code: name === 'SecurityError' ? 'blocked' : 'unsupported', name};
	}
	if (name === 'NotAllowedError' && app === null && took < FAST) {
		refused = true;
		takeAll();
		return {ok: false, code: 'in_app', app: 'unknown', name};
	}
	if (name === 'NotAllowedError') {
		return app === null ? {ok: false, code: 'cancelled', name} : {ok: false, code: 'in_app', app, name};
	}
	return {ok: false, code: 'failed', name};
};

/** The control busy while the promise runs, when the main script is on the page; answers the promise. */
const busyOf = (control, promise) => control && typeof globalThis.REDZ?.ui?.busy === 'function' ? globalThis.REDZ.ui.busy(control, promise) : promise;

/** The browser's capabilities as getClientCapabilities tells them, none where it cannot. */
const capabilitiesOf = () => typeof KEYS?.getClientCapabilities === 'function' ? KEYS.getClientCapabilities().catch(() => ({})) : Promise.resolve({});

/** The field hint stopped while another call runs. */
const pause = () => {
	if (hint !== null && !hint.paused) {
		hint.paused = true;
		hint.control?.abort();
	}
};

/** The field hint after the call that stopped it: ended when that one gave a credential, armed again when not. */
const resume = (result) => {
	if (hint?.paused) {
		if (result.ok) {
			hint.end({ok: false, code: 'aborted'});
		} else {
			armHint(hint);
		}
	}
	return result;
};

/** Asks the browser for the field hint, with the options given or a fresh set from the page's call. */
const armHint = (state) => {
	const control = new AbortController();
	state.control = control;
	state.paused = false;
	const live = () => state.control === control && !control.signal.aborted;
	Promise.resolve().then(() => typeof state.given === 'function' ? state.given() : state.given).then((json) => {
		if (live()) {
			return navigator.credentials.get({publicKey: requestOf(json), mediation: 'conditional', signal: control.signal}).then((credential) => {
				if (live()) {
					state.end(givenOf(credential));
				}
			}, (error) => {
				if (live()) {
					state.end(refusalOf(error, 'get'));
				}
			});
		}
		return null;
	}).catch((error) => {
		if (live()) {
			state.end({ok: false, code: 'failed', name: typeof error?.name === 'string' ? error.name : 'Error'});
		}
	});
};

/** The field hint: one promise for the page, settled by a passkey picked in the field, by the end of the hint or by a
 *  failure; a new hint ends the one before. */
const autofill = (given, {signal} = {}) => new Promise((resolve) => {
	hint?.end({ok: false, code: 'aborted'});
	if (!supported() || signal?.aborted) {
		resolve({ok: false, code: supported() ? 'aborted' : 'unsupported'});
		return;
	}
	const state = {given, control: null, paused: false, end: null};
	const stop = () => state.end({ok: false, code: 'aborted'});
	state.end = (result) => {
		if (hint === state) {
			hint = null;
		}
		state.control?.abort();
		signal?.removeEventListener('abort', stop);
		resolve(result);
	};
	signal?.addEventListener('abort', stop, {once: true});
	hint = state;
	Promise.resolve().then(() => KEYS.isConditionalMediationAvailable?.() ?? false).then((can) => {
		if (hint === state) {
			if (can) {
				armHint(state);
			} else {
				state.end({ok: false, code: 'unsupported'});
			}
		}
	}, () => state.end({ok: false, code: 'unsupported'}));
});

/** An explicit ceremony, run at once: the call is the first thing the press does. */
const ceremony = (kind, json, {busy, signal} = {}) => {
	if (!supported()) {
		return busyOf(busy, Promise.resolve({ok: false, code: 'unsupported'}));
	}
	pause();
	const started = performance.now();
	let call;
	try {
		call = kind === 'create' ? navigator.credentials.create({publicKey: creationOf(json), signal}) : navigator.credentials.get({publicKey: requestOf(json), signal});
	} catch (error) {
		call = Promise.reject(error);
	}
	return busyOf(busy, call.then(givenOf, (error) => signal?.aborted ? {ok: false, code: 'aborted'} : refusalOf(error, kind, performance.now() - started)).then(resume));
};

/** The quiet creation after a password, where the browser has it. */
const upgrade = (json) => supported() ? capabilitiesOf().then((capabilities) => {
	if (capabilities.conditionalCreate !== true) {
		return {ok: false, code: 'unsupported'};
	}
	pause();
	return Promise.resolve().then(() => navigator.credentials.create({publicKey: creationOf(json), mediation: 'conditional'})).then(givenOf, (error) => refusalOf(error, 'create')).then(resume);
}) : Promise.resolve({ok: false, code: 'unsupported'});

/** What this browser can do with passkeys, and the app whose browser it is. */
const probe = async () => {
	const passkeys = supported();
	const capabilities = passkeys ? await capabilitiesOf() : {};
	const flag = async (key, call) => typeof capabilities[key] === 'boolean' ? capabilities[key] : passkeys && typeof call === 'function' && Boolean(await Promise.resolve().then(() => call.call(KEYS)).catch(() => false));
	const app = appOf();
	return {
		passkeys,
		platform: await flag('userVerifyingPlatformAuthenticator', KEYS?.isUserVerifyingPlatformAuthenticatorAvailable),
		autofill: await flag('conditionalGet', KEYS?.isConditionalMediationAvailable),
		quietCreate: capabilities.conditionalCreate === true,
		signal: passkeys && typeof KEYS.signalUnknownCredential === 'function',
		app,
		works: passkeys && app === null,
	};
};

/** Tells the passkey manager by the Signal API, where the browser has it: true when told, false when refused or not
 *  there. Safari 26's promise of it may never settle, so a second is all it is given. */
const tell = (name, details) => typeof KEYS?.[name] !== 'function' ? Promise.resolve(false) : Promise.race([
	Promise.resolve().then(() => KEYS[name](details)).then(() => true, () => false),
	new Promise((resolve) => {
		setTimeout(resolve, 1000, true);
	}),
]);

const signals = {
	unknown: (details) => tell('signalUnknownCredential', details),
	accepted: (details) => tell('signalAllAcceptedCredentials', details),
	user: (details) => tell('signalCurrentUserDetails', details),
};

/** The address the press goes to in the app, for the page's address: null where the app leads out by its menu alone. */
const outOf = (app, url) => {
	if (app === 'line') {
		const out = new URL(url);
		out.searchParams.set('openExternalBrowser', '1');
		return out.href;
	}
	const agent = navigator.userAgent;
	const system = /iPhone|iPad|iPod/.test(agent) || /Macintosh/.test(agent) && navigator.maxTouchPoints > 1 ? 'ios' : /Android/.test(agent) ? 'android' : null;
	if (system === null) {
		return null;
	}
	const own = OUT[system][app];
	if (own !== undefined) {
		return own === null ? null : own + encodeURIComponent(url.href);
	}
	return system === 'ios' ? 'x-safari-' + url.href : 'intent://' + url.host + url.pathname + url.search + '#Intent;scheme=' + url.protocol.slice(0, -1) + ';action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end';
};

/** Copies the words: answers whether it did. */
const copy = (words) => {
	if (typeof navigator.clipboard?.writeText === 'function') {
		return navigator.clipboard.writeText(words).then(() => true, () => false);
	}
	const area = Object.assign(document.createElement('textarea'), {value: words, readOnly: true});
	area.setAttribute('aria-hidden', 'true');
	area.style.position = 'fixed';
	area.style.opacity = '0';
	const back = document.activeElement;
	document.body.append(area);
	area.select();
	let done = false;
	try {
		done = document.execCommand('copy');
	} catch {
		done = false;
	}
	area.remove();
	back?.focus?.({preventScroll: true});
	return Promise.resolve(done);
};

/** Asks the page for the control's ticket, and again in its last minute. */
const renew = (control) => {
	const state = held.get(control);
	clearTimeout(state.timer);
	const [, answer] = ask(control, 'redz:handoff', {app: appOf()});
	if (answer === null) {
		control.hidden = state.url === '';
		return;
	}
	answer.then((ticket) => {
		const expires = typeof ticket?.expires === 'number' ? ticket.expires : Date.parse(ticket?.expires);
		if (typeof ticket?.url !== 'string' || ticket.url === '') {
			throw new TypeError('no url');
		}
		state.url = ticket.url;
		state.expires = Number.isFinite(expires) ? expires : Infinity;
		control.hidden = false;
		if (state.expires < Infinity) {
			state.timer = setTimeout(() => {
				if (document.visibilityState === 'visible') {
					renew(control);
				}
			}, Math.max(10000, state.expires - 60000 - Date.now()));
		}
	}).catch(() => {
		state.url = '';
		control.hidden = true;
	});
};

/** The control taken up once: its href the address until the page gives a ticket. */
const take = (control) => {
	if (!held.has(control)) {
		held.set(control, {url: control.getAttribute('href') ?? '', expires: Infinity, timer: 0});
		renew(control);
	}
};

/** Every control of the page taken up, and those added later, in an app's browser. */
const takeAll = () => {
	if (appOf() === null) {
		return;
	}
	document.querySelectorAll('[data-open-browser]').forEach(take);
	if (!watching) {
		watching = true;
		new MutationObserver((records) => {
			for (const record of records) {
				for (const node of record.addedNodes) {
					if (node instanceof Element) {
						[...node.matches('[data-open-browser]') ? [node] : [], ...node.querySelectorAll('[data-open-browser]')].forEach(take);
					}
				}
			}
		}).observe(document.documentElement, {childList: true, subtree: true});
	}
};

document.addEventListener('click', (event) => {
	const control = event.target instanceof Element ? event.target.closest('[data-open-browser]') : null;
	const state = control === null ? undefined : held.get(control);
	if (state === undefined || state.url === '' || event.defaultPrevented) {
		return;
	}
	const url = new URL(state.url, location.href);
	const out = outOf(appOf(), url);
	const copied = copy(url.href);
	if (out === null || !(control instanceof HTMLAnchorElement)) {
		event.preventDefault();
	}
	// A link is followed as tapped, which an app's browser honours best; a button goes there by the script.
	if (out !== null && control instanceof HTMLAnchorElement) {
		control.href = out;
	} else if (out !== null) {
		location.assign(out);
	}
	setTimeout(() => {
		copied.then((done) => {
			if (done && document.visibilityState === 'visible') {
				globalThis.REDZ?.ui?.toast?.({text: text('handoff.copied')});
			}
		});
	}, out === null ? 0 : 1500);
});

document.addEventListener('visibilitychange', () => {
	if (document.visibilityState !== 'visible') {
		return;
	}
	for (const [control, state] of held) {
		if (!control.isConnected) {
			clearTimeout(state.timer);
			held.delete(control);
		} else if (state.expires - Date.now() < 60000) {
			renew(control);
		}
	}
});

/** Solves the proof task in the proof file as a worker, or in the page where none can start: the counter, or -1. */
const solveTask = (task, {worker, width, busy, signal} = {}) => busyOf(busy, new Promise((resolve) => {
	const here = () => solve(task, {width, signal}).then(resolve);
	let thread = null;
	try {
		thread = worker && !signal?.aborted ? new Worker(worker) : null;
	} catch {
		thread = null;
	}
	if (thread === null) {
		here();
		return;
	}
	const stop = () => end(-1);
	const end = (found) => {
		thread.terminate();
		signal?.removeEventListener('abort', stop);
		resolve(found);
	};
	thread.addEventListener('message', (event) => end(typeof event.data?.found === 'number' ? event.data.found : -1));
	thread.addEventListener('error', (event) => {
		event.preventDefault();
		thread.terminate();
		signal?.removeEventListener('abort', stop);
		here();
	});
	signal?.addEventListener('abort', stop, {once: true});
	thread.postMessage({at: 1, task, width});
}));

// The page's own scripts listen first: the controls are taken up once the document has loaded.
if (document.readyState === 'complete') {
	setTimeout(takeAll);
} else {
	document.addEventListener('DOMContentLoaded', takeAll, {once: true});
	addEventListener('load', takeAll, {once: true});
}

globalThis.REDZ = Object.assign(globalThis.REDZ ?? {}, {ui: {...globalThis.REDZ?.ui, passkey: {probe, create: (json, options) => ceremony('create', json, options), get: (json, options) => ceremony('get', json, options), autofill, upgrade, signal: signals}, solve: solveTask}});

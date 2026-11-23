/*! REDZ.UI - https://github.com/redz-tech/REDZ.UI */
// REDZ.UI, the sign-in package's types for an editor: REDZ.ui.passkey and REDZ.ui.solve, added to interface RedzUi of
// js/redz-ui.d.ts, and its event redz:handoff. The proof task's type is the proof file's, js/redz-ui-proof.d.ts. A
// browser never loads this file.

/** The app whose own browser the page is in: one the marks name, 'webview' for another app's, 'unknown' for one a call
 *  found by its refusal. */
type RedzApp = 'line' | 'messenger' | 'threads' | 'instagram' | 'facebook' | 'wechat' | 'kakaotalk' | 'tiktok' | 'x' | 'snapchat' | 'linkedin' | 'pinterest' | 'whatsapp' | 'google' | 'telegram' | 'webview' | 'unknown';

/** A passkey call's answer: the credential in its JSON form, as credential.toJSON() gives it, or the refusal's code -
 *  with the browser's error name beside it, and the app for in_app. */
type RedzPasskeyResult = {ok: true; response: RedzPasskeyResponse} | {ok: false; code: 'unsupported' | 'in_app' | 'cancelled' | 'exists' | 'blocked' | 'aborted' | 'failed'; name?: string; app?: RedzApp};

/** RegistrationResponseJSON or AuthenticationResponseJSON of WebAuthn Level 3, binary members in base64url. */
interface RedzPasskeyResponse {
	id: string;
	rawId: string;
	type: string;
	authenticatorAttachment?: string;
	response: {clientDataJSON: string; attestationObject?: string; transports?: string[]; authenticatorData?: string; publicKey?: string; publicKeyAlgorithm?: number; signature?: string; userHandle?: string};
	clientExtensionResults: Record<string, unknown>;
}

/** What the browser can do with passkeys: at all, by its own authenticator, in the field hint, created quietly after
 *  a password, by the Signal API; the app whose browser it is, null for a browser of its own; and whether a passkey
 *  works here. */
interface RedzPasskeyProbe {
	passkeys: boolean;
	platform: boolean;
	autofill: boolean;
	quietCreate: boolean;
	signal: boolean;
	app: RedzApp | null;
	works: boolean;
}

/** A ceremony's options: the control busy while it runs, and a signal that ends it. */
interface RedzPasskeyCall {
	busy?: Element;
	signal?: AbortSignal;
}

interface RedzUi {
	passkey: {
		/** What the browser can do with passkeys, and the app whose browser it is. */
		probe(): Promise<RedzPasskeyProbe>;
		/** Creates a passkey by PublicKeyCredentialCreationOptionsJSON: called first in the press, the options at hand. */
		create(options: object, call?: RedzPasskeyCall): Promise<RedzPasskeyResult>;
		/** Signs in by PublicKeyCredentialRequestOptionsJSON: called first in the press, the options at hand. */
		get(options: object, call?: RedzPasskeyCall): Promise<RedzPasskeyResult>;
		/** The field hint, by the options or a call that gives fresh ones at each arming: settles when a passkey is
		 *  picked in the field, 'aborted' when an explicit call succeeds, the signal ends it or a new hint comes. */
		autofill(options: object | (() => object | PromiseLike<object>), call?: {signal?: AbortSignal}): Promise<RedzPasskeyResult>;
		/** The quiet creation after a password sign-in, where the browser has it: every failure silent. */
		upgrade(options: object): Promise<RedzPasskeyResult>;
		/** The Signal API, where the browser has it: true when told, false when refused or missing; never waited on
		 *  longer than a second. */
		signal: {
			unknown(details: {rpId: string; credentialId: string}): Promise<boolean>;
			accepted(details: {rpId: string; userId: string; allAcceptedCredentialIds: string[]}): Promise<boolean>;
			user(details: {rpId: string; userId: string; name: string; displayName: string}): Promise<boolean>;
		};
	};
	/** Solves a proof task: in the proof file as a worker from that address, or in the page where none can start;
	 *  the counter, or -1 for a failure, an end by the signal or a task it does not know. */
	solve(task: RedzProofTask, options?: {worker?: string | URL | TrustedScriptURL; width?: number; busy?: Element; signal?: AbortSignal}): Promise<number>;
}

interface RedzEventMap {
	/** A [data-open-browser] control asks for the address that takes the person to the real browser: the page answers
	 *  {url, expires}, expires in epoch milliseconds or a date. */
	'redz:handoff': CustomEvent<RedzAsk<{app: RedzApp}, {url: string; expires: number | string}>>;
}

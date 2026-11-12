<?php
// probes, speech: the config's speech steps heard by a screen reader - VoiceOver in Safari, NVDA in Chrome and Firefox.
// One list for every reader: each step holds the words the page owns and the reader's own words apart; a reader acts,
// hears, says a page's words and gets ready for a page its own way through its verbs (Ready, Act, Heard, Says and, for a
// reader that reads a page whole, Read). A step "unsteady" for an engine, with the reason, misses its words there as a
// note.

// A reader is not the same twice - a phrase dropped, a hint late: a page is heard again, up to three times, until a
// hearing misses no words; otherwise the last hearing's findings stand.
const PROBE_SPEECH_HEARINGS = 3;

/** Calls the reader's $verb - PROBE__VoiceOverAct, PROBE__NvdaHeard… - on the reader's handle. */
function PROBE__Reader(array &$r, string $verb, mixed ...$args): mixed
{
	return ('PROBE__' . ucfirst($r['kind']) . $verb)($r, ...$args);
}

/** The words of $text as a step compares them: letters and digits in lowercase, one space between - a reader may say a
 *  sign as a word or leave it unsaid -, the words split where NVDA's built-in dictionary splits them: GitHub, HTMLParser,
 *  Tr0pical. */
function PROBE__SpeechWords(string $text): string
{
	$split = (string)preg_replace(['~(?<=\p{Ll})(?=\p{Lu})~u', '~(?<=\p{Lu})(?=\p{Lu}\p{Ll})~u', '~(?<=\p{L})(?=\p{N})~u'], ' ', $text);
	return trim((string)preg_replace('~[^\p{L}\p{N}]+~u', ' ', mb_strtolower($split)));
}

/** The words of $expect that $heard lacks, each as the reader says it (its verb Says). */
function PROBE__SpeechMissing(array &$r, array $expect, array $heard): array
{
	$said = PROBE__SpeechWords(implode(' · ', $heard));
	return array_values(array_filter($expect, fn(string $words): bool => !str_contains($said, PROBE__SpeechWords(PROBE__Reader($r, 'Says', $words)))));
}

/** Loads $page and waits for the library, a link that would leave the page held - judged last, as the click bubbles
 *  out of the window, so a link the page itself keeps, as the image viewer's, is not taken for one. */
function PROBE__SpeechLoad(array &$h, string $page, array $run): void
{
	PROBE__Do($h, 'Load', $run['base'] . $page, 1280, 900);
	for ($tries = 0; PROBE__Do($h, 'Eval', 'document.readyState === "complete" && "REDZ" in window') !== true; $tries++) {
		if ($tries > 100) {
			throw new RuntimeException($page . ' did not load: ' . json_encode(PROBE__Do($h, 'Eval', '[location.href, document.readyState, document.title]')));
		}
		usleep(100000);
	}
	PROBE__Do($h, 'Eval', '(() => { addEventListener("click", (event) => { const link = event.target instanceof Element ? event.target.closest("a[href]") : null; if (link !== null && !event.defaultPrevented && (link.origin !== location.origin || link.pathname !== location.pathname)) { event.preventDefault(); window.REDZ_PROBE_LEFT = link.href; } }); return true; })()');
}

/** One hearing of a page's steps: loaded, the reader ready, each step done and what the reader says after it held
 *  against the words it must contain; answers what was said and the findings, an exception's not among them. */
function PROBE__SpeechPage(array &$r, array &$h, string $page, array $steps, array $run, array &$report): array
{
	$name = $r['name'];
	PROBE__SpeechLoad($h, $page, $run);
	PROBE__Reader($r, 'Ready', $h, $page);
	$spoken = [];
	$findings = [];
	foreach ($steps as $step) {
		// A reader may carry the keyboard focus along with its own cursor: a key goes where the last step left the focus.
		$back = $step['do'] === 'focus' || $step['do'] === 'eval' ? null : PROBE__Do($h, 'Eval', '(() => { const kept = document.querySelector("[data-probe-focus]"); if (kept === null || document.activeElement === kept) { return null; } const away = document.activeElement?.outerHTML.slice(0, 60) ?? "none"; kept.focus(); return away; })()');
		if ($back !== null) {
			echo 'note: ', $name, ' ', $page, ' - before «', $step['label'], '» the focus was on ', $back, ', put back', "\n";
			PROBE__Reader($r, 'Heard', microtime(true) * 1000, microtime(true) * 1000, 1.0, 5);
		}
		$since = microtime(true) * 1000;
		match ($step['do']) {
			'focus' => PROBE__Do($h, 'Eval', '(() => { const el = document.querySelector(' . json_encode($step['target']) . '); if (el === null) { throw new Error(' . json_encode('no ' . $step['target'] . ' on the page') . '); } el.focus(); return true; })()'),
			'eval' => PROBE__Do($h, 'Eval', $step['script']),
			'key', 'type', 'chord' => PROBE__Reader($r, 'Act', $h, $step),
		};
		if ($step['do'] !== 'focus') {
			usleep(300000);
		}
		PROBE__Do($h, 'Eval', '(() => { for (const el of document.querySelectorAll("[data-probe-focus]")) { el.removeAttribute("data-probe-focus"); } (' . ($step['do'] === 'focus' ? 'document.querySelector(' . json_encode($step['target']) . ')' : 'document.activeElement') . ')?.setAttribute("data-probe-focus", ""); return true; })()');
		$heard = PROBE__Reader($r, 'Heard', $since, microtime(true) * 1000, $r['quiet'], 10);
		$left = PROBE__Do($h, 'Eval', 'window.REDZ_PROBE_LEFT ?? null');
		if ($left !== null) {
			$findings[] = $name . ' ' . $page . ' - ' . $step['label'] . ': a key pressed the link to ' . $left . ', which would leave the page';
			PROBE__Do($h, 'Eval', '(delete window.REDZ_PROBE_LEFT, true)');
		}
		$expect = [...$step['expect'], ...($step[$r['kind']] ?? [])];
		$missing = PROBE__SpeechMissing($r, $expect, $heard);
		$state = PROBE__Do($h, 'Eval', '(() => { const el = document.activeElement; const active = document.getElementById(el.getAttribute("aria-activedescendant") || ""); return (el.id || el.localName) + (active === null ? "" : " → " + active.textContent.trim()) + " · " + (el.matches("input, textarea") ? el.value : el.textContent.trim()).slice(0, 40); })()');
		$spoken[] = ['engine' => $name, 'step' => $step['label'], 'expect' => $expect, 'said' => $heard, 'state' => $state];
		$finding = $name . ' ' . $page . ' - ' . $step['label'] . ': ' . $r['reader'] . ' said «' . implode(' · ', $heard) . '», without «' . implode('», «', $missing) . '»';
		if ($missing !== [] && isset($step['unsteady'][$name])) {
			echo 'note: ', $finding, ' - unsteady here: ', $step['unsteady'][$name], "\n";
		} elseif ($missing !== [] && !PROBE__FindingAllowed($run['config'], $name, $finding, $page, $report)) {
			$findings[] = $finding;
		}
	}
	return [$spoken, $findings];
}

/** Every speech page heard by the reader, each up to PROBE_SPEECH_HEARINGS times; a reader that reads a page whole reads
 *  it once first, on a page of its own. What was said and read goes into the report. */
function PROBE__SpeechHear(array &$r, array &$h, array $run, array &$report): void
{
	$name = $r['name'];
	foreach ($run['config']['speech'] as $page => $steps) {
		[$read, $misread] = $r['reads'] ? PROBE__Reader($r, 'Read', $h, $page, $run, $report) : [[], []];
		for ($hearing = 1; $hearing <= PROBE_SPEECH_HEARINGS; $hearing++) {
			[$spoken, $findings] = PROBE__SpeechPage($r, $h, $page, $steps, $run, $report);
			if ($findings === []) {
				break;
			}
		}
		$hearing = min($hearing, PROBE_SPEECH_HEARINGS);
		if ($hearing > 1 && $findings === []) {
			echo 'note: ', $name, ' ', $page, ' - every step heard on hearing ', $hearing, "\n";
		}
		foreach ($spoken as $entry) {
			$report['spoken'][$page][] = $entry + ['hearing' => $hearing];
		}
		foreach ($read as $entry) {
			$report['read'][$page][] = $entry;
		}
		$report['findings'] = [...$report['findings'], ...$misread, ...$findings];
		$report['engines'][$name]['cells']++;
	}
}

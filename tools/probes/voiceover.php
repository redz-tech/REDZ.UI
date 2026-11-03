<?php
// probes, VoiceOver: what VoiceOver says while desktop Safari, driven by the Safari driver, goes through the steps of the
// config's "speech" pages — every phrase written by a listener as it comes, each step holding the words it must
// contain, the page's own for every reader and VoiceOver's apart; a step "unsteady" for an engine, with the reason,
// misses its words there as a note. VoiceOver obeys AppleScript only where the machine allows it: CI runs php
// tools/probe.php voiceover-setup (the defaults, the flag file and the TCC rows, after @guidepup/setup 0.29.3, MIT); a
// Mac's owner turns it on in VoiceOver Utility.

const PROBE_VOICEOVER = '/System/Library/CoreServices/VoiceOver.app/Contents/MacOS/VoiceOverStarter';
const PROBE_VOICEOVER_FLAG = '/private/var/db/Accessibility/.VoiceOverAppleScriptEnabled';
// VoiceOver is not the same twice — a phrase dropped, a hint late: a page is heard again, up to three times, until a
// hearing misses no words; otherwise the last hearing's findings stand.
const PROBE_VOICEOVER_HEARINGS = 3;

/** What osascript answers for the script; '' when it fails. */
function PROBE__AppleScript(string $script): string
{
	try {
		return trim(PROBE__Run(['/usr/bin/osascript', '-e', $script]));
	} catch (RuntimeException) {
		return '';
	}
}

/** Why VoiceOver cannot be driven here; '' when it can. */
function PROBE__VoiceOverBlocked(): string
{
	if (!is_file('/usr/bin/safaridriver') || !is_file(PROBE_VOICEOVER)) {
		return 'no safaridriver or VoiceOver on this machine';
	}
	$defaults = '';
	try {
		$defaults = trim(PROBE__Run(['/usr/bin/defaults', 'read', 'com.apple.VoiceOver4/default', 'SCREnableAppleScript']));
	} catch (RuntimeException) {
	}
	if ($defaults !== '1' || !file_exists(PROBE_VOICEOVER_FLAG)) {
		return 'VoiceOver may not be driven by AppleScript here — CI runs php tools/probe.php voiceover-setup; on a Mac its owner allows it in VoiceOver Utility';
	}
	return PROBE__ScreenLocked() ? 'the screen is locked, and Safari on the Mac draws no frames until it is unlocked' : '';
}

/** Starts the listener: a JXA loop that reads VoiceOver's last phrase every 30 ms and writes each new one to $file,
 *  after the time it was heard in ms — a phrase another quickly follows is kept, as one osascript per read lost it. */
function PROBE__VoiceOverListen(string $file)
{
	$script = 'const vo = Application("VoiceOver"); let last = ""; for (;;) { let phrase = ""; try { phrase = vo.lastPhrase.content(); } catch (error) {} if (phrase !== "" && phrase !== last) { last = phrase; console.log(Date.now() + "\t" + phrase.replace(/\s+/g, " ")); } delay(0.03); }';
	$proc = proc_open(['/usr/bin/osascript', '-l', 'JavaScript', '-e', $script], [0 => ['file', '/dev/null', 'r'], 1 => ['file', '/dev/null', 'a'], 2 => ['file', $file, 'a']], $pipes);
	if (!is_resource($proc)) {
		throw new RuntimeException('cannot start the VoiceOver listener');
	}
	return $proc;
}

/** The phrases the listener wrote since the action began at $since (ms), in order: read for at least 1.5 s after it
 *  ended at $acted, until $quiet seconds without a new one — longer than VoiceOver waits before a hint, and than a
 *  widget waits for the typing to pause — or $most seconds. */
function PROBE__VoiceOverHeard(string $file, float $since, float $acted, float $quiet, float $most): array
{
	while (true) {
		$heard = [];
		$spoke = $acted;
		foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
			[$at, $phrase] = explode("\t", $line, 2) + [1 => ''];
			if ((float)$at >= $since) {
				$heard[] = $phrase;
				$spoke = max($spoke, (float)$at);
			}
		}
		$now = microtime(true) * 1000;
		if ($now - $acted >= $most * 1000 || ($now - $acted >= 1500 && $now - $spoke >= $quiet * 1000)) {
			return $heard;
		}
		usleep(100000);
	}
}

/** One hearing of a page: loaded, its first words let pass, each step done and what VoiceOver says after it held
 *  against the words it must contain; answers what was said and the findings, an exception's not among them. */
function PROBE__VoiceOverPage(array &$h, string $name, string $page, array $steps, string $log, array $run, array &$report): array
{
	PROBE__Do($h, 'Load', $run['base'] . $page, 1280, 900);
	for ($tries = 0; PROBE__Do($h, 'Eval', 'document.readyState === "complete" && "REDZ" in window') !== true; $tries++) {
		if ($tries > 100) {
			throw new RuntimeException($page . ' did not load: ' . json_encode(PROBE__Do($h, 'Eval', '[location.href, document.readyState, document.title]')));
		}
		usleep(100000);
	}
	// The docs' own header and navigation are inert while VoiceOver hears a page: its cursor, and the focus it carries,
	// stay among the examples. A link that would leave the page is held.
	PROBE__Do($h, 'Eval', '(() => { for (const chrome of document.querySelectorAll(".app-header, #docs-nav")) { chrome.inert = true; } addEventListener("click", (event) => { const link = event.target instanceof Element ? event.target.closest("a[href]") : null; if (link !== null && (link.origin !== location.origin || link.pathname !== location.pathname)) { event.preventDefault(); window.REDZ_PROBE_LEFT = link.href; } }, true); return true; })()');
	PROBE__AppleScript('tell application "Safari" to activate');
	PROBE__VoiceOverHeard($log, microtime(true) * 1000, microtime(true) * 1000, 2.0, 10);
	$spoken = [];
	$findings = [];
	foreach ($steps as $step) {
		// VoiceOver may carry the keyboard focus along with its own cursor: a key goes where the last step left the focus.
		$back = $step['do'] === 'focus' || $step['do'] === 'eval' ? null : PROBE__Do($h, 'Eval', '(() => { const kept = document.querySelector("[data-probe-focus]"); if (kept === null || document.activeElement === kept) { return null; } const away = document.activeElement?.outerHTML.slice(0, 60) ?? "none"; kept.focus(); return away; })()');
		if ($back !== null) {
			echo 'note: ', $name, ' ', $page, ' — before «', $step['label'], '» the focus was on ', $back, ', put back', "\n";
			PROBE__VoiceOverHeard($log, microtime(true) * 1000, microtime(true) * 1000, 1.0, 5);
		}
		$since = microtime(true) * 1000;
		match ($step['do']) {
			'focus' => PROBE__Do($h, 'Eval', '(() => { const el = document.querySelector(' . json_encode($step['target']) . '); if (el === null) { throw new Error(' . json_encode('no ' . $step['target'] . ' on the page') . '); } el.focus(); return true; })()'),
			'key' => PROBE__Do($h, 'Key', $step['key']),
			'type' => PROBE__Do($h, 'Type', $step['text']),
			'chord' => PROBE__Do($h, 'Chord', $step['keys']),
			'eval' => PROBE__Do($h, 'Eval', $step['script']),
		};
		if ($step['do'] !== 'focus') {
			usleep(300000);
		}
		PROBE__Do($h, 'Eval', '(() => { for (const el of document.querySelectorAll("[data-probe-focus]")) { el.removeAttribute("data-probe-focus"); } (' . ($step['do'] === 'focus' ? 'document.querySelector(' . json_encode($step['target']) . ')' : 'document.activeElement') . ')?.setAttribute("data-probe-focus", ""); return true; })()');
		$heard = PROBE__VoiceOverHeard($log, $since, microtime(true) * 1000, 2.5, 10);
		$left = PROBE__Do($h, 'Eval', 'window.REDZ_PROBE_LEFT ?? null');
		if ($left !== null) {
			$findings[] = $name . ' ' . $page . ' — ' . $step['label'] . ': a key pressed the link to ' . $left . ', which would leave the page';
			PROBE__Do($h, 'Eval', '(delete window.REDZ_PROBE_LEFT, true)');
		}
		$said = mb_strtolower(implode(' · ', $heard));
		$expect = [...$step['expect'], ...($step['voiceover'] ?? [])];
		$missing = array_values(array_filter($expect, fn(string $words): bool => !str_contains($said, mb_strtolower($words))));
		$state = PROBE__Do($h, 'Eval', '(() => { const el = document.activeElement; const active = document.getElementById(el.getAttribute("aria-activedescendant") || ""); return (el.id || el.localName) + (active === null ? "" : " → " + active.textContent.trim()) + " · " + (el.matches("input, textarea") ? el.value : el.textContent.trim()).slice(0, 40); })()');
		$spoken[] = ['engine' => $name, 'step' => $step['label'], 'expect' => $expect, 'said' => $heard, 'state' => $state];
		$finding = $name . ' ' . $page . ' — ' . $step['label'] . ': VoiceOver said «' . implode(' · ', $heard) . '», without «' . implode('», «', $missing) . '»';
		if ($missing !== [] && isset($step['unsteady'][$name])) {
			echo 'note: ', $finding, ' — unsteady here: ', $step['unsteady'][$name], "\n";
		} elseif ($missing !== [] && !PROBE__FindingAllowed($run['config'], $name, $finding, $report)) {
			$findings[] = $finding;
		}
	}
	return [$spoken, $findings];
}

/** Starts VoiceOver and its listener, then Safari's session — VoiceOver's start would take the window from a session
 *  already open — goes through the config's speech steps on each page, records what VoiceOver says into the report;
 *  every phrase heard stays in the sheet's logs/NAME-phrases.log. */
function PROBE__VoiceOverRun(string $name, string $dir, array $run, array &$report): void
{
	PROBE__Run([PROBE_VOICEOVER]);
	$h = null;
	$listener = null;
	$log = $run['sheet'] . '/logs/' . $name . '-phrases.log';
	try {
		for ($tries = 0; PROBE__AppleScript('tell application "VoiceOver" to return bounds of vo cursor') === ''; $tries++) {
			if ($tries > 60) {
				throw new RuntimeException('VoiceOver did not answer AppleScript within 30 s');
			}
			usleep(500000);
		}
		@mkdir(dirname($log), 0777, true);
		$listener = PROBE__VoiceOverListen($log);
		$h = PROBE__SafariStart($dir);
		$report['engines'][$name] = ['version' => $h['version'] . ' · VoiceOver · macOS ' . trim(PROBE__Run(['/usr/bin/sw_vers', '-productVersion'])), 'cells' => 0];
		foreach ($run['config']['speech'] as $page => $steps) {
			for ($hearing = 1; $hearing <= PROBE_VOICEOVER_HEARINGS; $hearing++) {
				[$spoken, $findings] = PROBE__VoiceOverPage($h, $name, $page, $steps, $log, $run, $report);
				if ($findings === []) {
					break;
				}
			}
			$hearing = min($hearing, PROBE_VOICEOVER_HEARINGS);
			if ($hearing > 1 && $findings === []) {
				echo 'note: ', $name, ' ', $page, ' — every step heard on hearing ', $hearing, "\n";
			}
			foreach ($spoken as $entry) {
				$report['spoken'][$page][] = $entry + ['hearing' => $hearing];
			}
			$report['findings'] = [...$report['findings'], ...$findings];
			$report['engines'][$name]['cells']++;
		}
	} catch (Throwable $e) {
		try {
			if ($h !== null) {
				file_put_contents($run['sheet'] . '/shots/' . $name . '-stopped.png', PROBE__Do($h, 'Shot'));
			}
		} catch (Throwable) {
			// Without a shot the error itself still goes up.
		}
		throw $e;
	} finally {
		if ($h !== null) {
			PROBE__Do($h, 'Stop');
		}
		if ($listener !== null) {
			proc_terminate($listener);
			PROBE__Wait($listener);
		}
		PROBE__AppleScript('tell application "VoiceOver" to quit');
	}
}

/** Lets VoiceOver be driven by AppleScript, as CI needs: its defaults, the flag file and the TCC rows for the runner. */
function PROBE__VoiceOverSetup(): int
{
	PROBE__Run(['/usr/bin/defaults', 'write', 'com.apple.VoiceOver4/default', 'SCREnableAppleScript', '-bool', 'true']);
	PROBE__Run(['/usr/bin/defaults', 'write', 'com.apple.VoiceOverTraining', 'doNotShowSplashScreen', '-bool', 'true']);
	PROBE__Run(['/usr/bin/sudo', '-n', '/bin/sh', '-c', 'printf a > ' . PROBE_VOICEOVER_FLAG]);
	$major = (int)PROBE__Run(['/usr/bin/sw_vers', '-productVersion']);
	$db = getenv('HOME') . '/Library/Application Support/com.apple.TCC/TCC.db';
	if ($major >= 27) {
		$found = array_filter(explode("\n", PROBE__Run(['/usr/bin/sudo', '-n', '/usr/bin/find', '/private/var/containers/Data/ProtectedSystem', '-mindepth', '6', '-maxdepth', '6', '-type', 'f', '-path', '*/Data/Library/Application Support/com.apple.TCC/TCC.db'])));
		$open = array_map(fn(string $line): string => substr($line, 1), array_filter(explode("\n", PROBE__Run(['/usr/bin/sudo', '-n', '/usr/sbin/lsof', '-c', 'tccd', '-Fn'])), fn(string $line): bool => str_starts_with($line, 'n')));
		$active = array_values(count($found) === 1 ? $found : array_intersect($found, $open));
		if (count($active) !== 1) {
			fwrite(STDERR, "cannot tell the active TCC database among:\n" . implode("\n", $found) . "\n");
			return 1;
		}
		$db = $active[0];
	}
	$clients = ['/bin/bash', '/bin/zsh', '/usr/bin/osascript', '/usr/sbin/sshd', PHP_BINARY, '/usr/local/opt/runner/runprovisioner.sh', '/usr/local/opt/runner/provisioner/provisioner', '/opt/hca/start_hca.sh', '/opt/hca/hosted-compute-agent'];
	$now = time();
	$tail = $major >= 23 ? ",NULL,NULL,'UNUSED'," . $now : '';
	$rows = [];
	foreach ($clients as $client) {
		$path = "'" . str_replace("'", "''", $client) . "'";
		foreach (['kTCCServiceAccessibility', 'kTCCServicePostEvent'] as $service) {
			$rows[] = "('" . $service . "'," . $path . ",1,2,3,1,NULL,NULL,NULL,'UNUSED',NULL,0," . $now . $tail . ')';
		}
		foreach (['com.apple.VoiceOver', 'com.apple.systemevents', 'com.apple.Safari'] as $app) {
			$rows[] = "('kTCCServiceAppleEvents'," . $path . ",1,2,3,1,NULL,NULL,0,'" . $app . "',NULL,NULL," . $now . $tail . ')';
		}
	}
	$columns = ['service', 'client', 'client_type', 'auth_value', 'auth_reason', 'auth_version', 'csreq', 'policy_id', 'indirect_object_identifier_type', 'indirect_object_identifier', 'indirect_object_code_identity', 'flags', 'last_modified', ...($major >= 23 ? ['pid', 'pid_version', 'boot_uuid', 'last_reminded'] : [])];
	$updated = ['auth_value', 'auth_reason', 'auth_version', 'flags', 'last_modified', ...($major >= 23 ? ['pid', 'pid_version', 'boot_uuid', 'last_reminded'] : [])];
	$sql = "BEGIN IMMEDIATE;\nINSERT INTO access (" . implode(',', $columns) . ') VALUES ' . implode(',', $rows) . ' ON CONFLICT DO UPDATE SET ' . implode(',', array_map(fn(string $column): string => $column . '=excluded.' . $column, $updated)) . ";\nCOMMIT;";
	PROBE__Run(['/usr/bin/sudo', '-n', '/usr/bin/sqlite3', '-bail', $db, $sql]);
	echo 'VoiceOver may be driven by AppleScript; ', count($rows), ' TCC rows in ', $db, "\n";
	return 0;
}

<?php
// probes, VoiceOver: what VoiceOver says while desktop Safari, driven by the Safari driver, goes through the steps of the
// config's "speech" pages — its last phrase read by AppleScript until it falls quiet, each step holding the words it
// must contain, the page's own for every reader and VoiceOver's apart. VoiceOver obeys AppleScript only where the
// machine allows it: CI runs php tools/probe.php
// voiceover-setup (the defaults, the flag file and the TCC rows, after @guidepup/setup 0.29.3, MIT); a Mac's owner turns
// it on in VoiceOver Utility.

const PROBE_VOICEOVER = '/System/Library/CoreServices/VoiceOver.app/Contents/MacOS/VoiceOverStarter';
const PROBE_VOICEOVER_FLAG = '/private/var/db/Accessibility/.VoiceOverAppleScriptEnabled';

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

/** Each phrase VoiceOver says after an action, in order: listened for at least 1.5 s, until a second of quiet or $most seconds. */
function PROBE__VoiceOverHeard(string $before, float $most): array
{
	$heard = [];
	$last = $before;
	$start = microtime(true);
	$spoke = $start;
	while (microtime(true) - $start < $most && (microtime(true) - $start < 1.5 || microtime(true) - $spoke < 1.0)) {
		usleep(150000);
		$phrase = PROBE__AppleScript('tell application "VoiceOver" to return content of last phrase');
		if ($phrase !== '' && $phrase !== $last) {
			$heard[] = $phrase;
			$last = $phrase;
			$spoke = microtime(true);
		}
	}
	return $heard;
}

/** Starts VoiceOver, then Safari's session — VoiceOver's start would take the window from a session already open —
 *  goes through the config's steps on each page, records what VoiceOver says into the report. */
function PROBE__VoiceOverRun(string $name, string $dir, array $run, array &$report): void
{
	PROBE__Run([PROBE_VOICEOVER]);
	$h = null;
	try {
		for ($tries = 0; PROBE__AppleScript('tell application "VoiceOver" to return bounds of vo cursor') === ''; $tries++) {
			if ($tries > 60) {
				throw new RuntimeException('VoiceOver did not answer AppleScript within 30 s');
			}
			usleep(500000);
		}
		$h = PROBE__SafariStart($dir);
		$report['engines'][$name] = ['version' => $h['version'] . ' · VoiceOver · macOS ' . trim(PROBE__Run(['/usr/bin/sw_vers', '-productVersion'])), 'cells' => 0];
		foreach ($run['config']['speech'] as $page => $steps) {
			PROBE__Do($h, 'Load', $run['base'] . $page, 1280, 900);
			for ($tries = 0; PROBE__Do($h, 'Eval', 'document.readyState === "complete" && "REDZ" in window') !== true; $tries++) {
				if ($tries > 100) {
					throw new RuntimeException($page . ' did not load: ' . json_encode(PROBE__Do($h, 'Eval', '[location.href, document.readyState, document.title]')));
				}
				usleep(100000);
			}
			PROBE__AppleScript('tell application "Safari" to activate');
			PROBE__VoiceOverHeard('', 3);
			foreach ($steps as $step) {
				$before = PROBE__AppleScript('tell application "VoiceOver" to return content of last phrase');
				match ($step['do']) {
					'focus' => PROBE__Do($h, 'Eval', '(() => { const el = document.querySelector(' . json_encode($step['target']) . '); if (el === null) { throw new Error("no ' . $step['target'] . ' on the page"); } el.focus(); return true; })()'),
					'key' => PROBE__Do($h, 'Key', $step['key']),
					'type' => PROBE__Do($h, 'Type', $step['text']),
					'chord' => PROBE__Do($h, 'Chord', $step['keys']),
					'eval' => PROBE__Do($h, 'Eval', $step['script']),
				};
				$heard = PROBE__VoiceOverHeard($before, 6);
				$said = mb_strtolower(implode(' · ', $heard));
				$expect = [...$step['expect'], ...($step['voiceover'] ?? [])];
				$missing = array_values(array_filter($expect, fn(string $words): bool => !str_contains($said, mb_strtolower($words))));
				$state = PROBE__Do($h, 'Eval', '(() => { const el = document.activeElement; const active = document.getElementById(el.getAttribute("aria-activedescendant") || ""); return (el.id || el.localName) + (active === null ? "" : " → " + active.textContent.trim()) + " · " + (el.matches("input, textarea") ? el.value : el.textContent.trim()).slice(0, 40); })()');
				$report['spoken'][$page][] = ['engine' => $name, 'step' => $step['label'], 'expect' => $expect, 'said' => $heard, 'state' => $state];
				if ($missing !== []) {
					$report['findings'][] = $name . ' ' . $page . ' — ' . $step['label'] . ': VoiceOver said «' . implode(' · ', $heard) . '», without «' . implode('», «', $missing) . '»';
				}
			}
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

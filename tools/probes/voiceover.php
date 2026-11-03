<?php
// probes, VoiceOver: the reader of tools/probes/speech.php in desktop Safari - its keys pressed by the Safari driver,
// every phrase written by a listener as it comes. VoiceOver obeys AppleScript only where the machine allows it: CI runs
// php tools/probe.php voiceover-setup (the defaults, the flag file and the TCC rows, after @guidepup/setup 0.29.3, MIT); a
// Mac's owner turns it on in VoiceOver Utility.

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
		return 'VoiceOver may not be driven by AppleScript here - CI runs php tools/probe.php voiceover-setup; on a Mac its owner allows it in VoiceOver Utility';
	}
	return PROBE__ScreenLocked() ? 'the screen is locked, and Safari on the Mac draws no frames until it is unlocked' : PROBE__SafariBusy();
}

/** Starts the listener: a JXA loop that reads VoiceOver's last phrase every 30 ms and writes each new one to $file,
 *  after the time it was heard in ms - a phrase another quickly follows is kept, as one osascript per read lost it. */
function PROBE__VoiceOverListen(string $file)
{
	$script = 'const vo = Application("VoiceOver"); let last = ""; for (;;) { let phrase = ""; try { phrase = vo.lastPhrase.content(); } catch (error) {} if (phrase !== "" && phrase !== last) { last = phrase; console.log(Date.now() + "\t" + phrase.replace(/\s+/g, " ")); } delay(0.03); }';
	$proc = proc_open(['/usr/bin/osascript', '-l', 'JavaScript', '-e', $script], [0 => ['file', PROBE_NULL, 'r'], 1 => ['file', PROBE_NULL, 'a'], 2 => ['file', $file, 'a']], $pipes);
	if (!is_resource($proc)) {
		throw new RuntimeException('cannot start the VoiceOver listener');
	}
	return $proc;
}

/** The phrases the listener wrote since the action began at $since (ms), in order: read for at least 1.5 s after it
 *  ended at $acted, until $quiet seconds without a new one - longer than VoiceOver waits before a hint, and than a
 *  widget waits for the typing to pause - or $most seconds. */
function PROBE__VoiceOverHeard(array &$r, float $since, float $acted, float $quiet, float $most): array
{
	while (true) {
		$heard = [];
		$spoke = $acted;
		foreach (file($r['log'], FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
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

/** A loaded page made ready for VoiceOver: the docs' own header and navigation inert - its cursor, and the focus it
 *  carries, stay among the examples -, Safari in front, its first words let pass. */
function PROBE__VoiceOverReady(array &$r, array &$h, string $page): void
{
	PROBE__Do($h, 'Eval', '(() => { for (const chrome of document.querySelectorAll(".app-header, #docs-nav")) { chrome.inert = true; } return true; })()');
	PROBE__AppleScript('tell application "Safari" to activate');
	PROBE__VoiceOverHeard($r, microtime(true) * 1000, microtime(true) * 1000, 2.0, 10);
}

/** A page's $words as VoiceOver says them: as they are. */
function PROBE__VoiceOverSays(array &$r, string $words): string
{
	return $words;
}

/** A step's keys, pressed by the Safari driver. */
function PROBE__VoiceOverAct(array &$r, array &$h, array $step): void
{
	match ($step['do']) {
		'key' => PROBE__Do($h, 'Key', $step['key']),
		'type' => PROBE__Do($h, 'Type', $step['text']),
		'chord' => PROBE__Do($h, 'Chord', $step['keys']),
	};
}

/** Starts VoiceOver and its listener, then Safari's session - VoiceOver's start would take the window from a session
 *  already open - goes through the config's speech steps on each page, records what VoiceOver says into the report;
 *  every phrase heard stays in the sheet's logs/NAME-phrases.log. */
function PROBE__VoiceOverRun(string $name, string $dir, array $run, array &$report): void
{
	PROBE__Run([PROBE_VOICEOVER]);
	$h = null;
	$listener = null;
	$r = ['kind' => 'voiceover', 'name' => $name, 'reader' => 'VoiceOver', 'reads' => false, 'quiet' => 2.5, 'log' => $run['sheet'] . '/logs/' . $name . '-phrases.log'];
	try {
		for ($tries = 0; PROBE__AppleScript('tell application "VoiceOver" to return bounds of vo cursor') === ''; $tries++) {
			if ($tries > 60) {
				throw new RuntimeException('VoiceOver did not answer AppleScript within 30 s');
			}
			usleep(500000);
		}
		@mkdir(dirname($r['log']), 0777, true);
		$listener = PROBE__VoiceOverListen($r['log']);
		$h = PROBE__SafariStart($dir);
		$report['engines'][$name] = ['version' => $h['version'] . ' · VoiceOver · macOS ' . trim(PROBE__Run(['/usr/bin/sw_vers', '-productVersion'])), 'cells' => 0];
		PROBE__SpeechHear($r, $h, $run, $report);
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

<?php
// probes, NVDA: the reader of tools/probes/speech.php in Chrome and Firefox on Windows. A portable NVDA of the pinned
// version, made from its official installer, runs on a config of the run; its Remote Access serves itself on a port of
// the run as the follower, and the probe joins as the leader over TLS, the relay's own certificate pinned by its
// fingerprint - every utterance comes as a phrase, every key goes in as a user's, so NVDA meets a page in browse mode and
// switches to focus mode by itself. Before a page's steps NVDA reads the page whole by its quick navigation, against
// what the page holds (tools/probes/read.js). CI runs php tools/probe.php nvda-setup first.

// The named keys: the Windows virtual key code and whether the key is an extended one. NVDA is the NVDA key - Insert.
const PROBE_NVDA_KEYS = ['Enter' => [0x0D, false], 'Space' => [0x20, false], 'Escape' => [0x1B, false], 'Tab' => [0x09, false], 'Backspace' => [0x08, false], 'ArrowDown' => [0x28, true], 'ArrowUp' => [0x26, true], 'ArrowLeft' => [0x25, true], 'ArrowRight' => [0x27, true], 'Home' => [0x24, true], 'End' => [0x23, true], 'Delete' => [0x2E, true], 'F6' => [0x75, false], 'Shift' => [0x10, false], 'Control' => [0x11, false], 'Alt' => [0x12, false], 'NVDA' => [0x2D, true]];
// The signs of the US layout on their own keys, and the shifted ones by the sign or digit of their key.
const PROBE_NVDA_SIGNS = ['-' => 0xBD, '=' => 0xBB, '[' => 0xDB, ']' => 0xDD, '\\' => 0xDC, ';' => 0xBA, "'" => 0xDE, ',' => 0xBC, '.' => 0xBE, '/' => 0xBF, '`' => 0xC0];
const PROBE_NVDA_SHIFTED = ['_' => '-', '+' => '=', '{' => '[', '}' => ']', '|' => '\\', ':' => ';', '"' => "'", '<' => ',', '>' => '.', '?' => '/', '~' => '`', '!' => '1', '@' => '2', '#' => '3', '$' => '4', '%' => '5', '^' => '6', '&' => '7', '*' => '8', '(' => '9', ')' => '0'];
// The reading of a page: the quick navigation key of each kind of item and what NVDA says past the last one. F's form
// fields hold the buttons B would visit.
const PROBE_NVDA_READ = ['heading' => ['h', 'no next heading'], 'landmark' => ['d', 'no next landmark'], 'field' => ['f', 'no next form field']];
// What NVDA calls a landmark of each role.
const PROBE_NVDA_LANDMARKS = ['banner' => 'banner', 'navigation' => 'navigation', 'main' => 'main', 'complementary' => 'complementary', 'contentinfo' => 'content info', 'search' => 'search', 'region' => 'region', 'form' => 'form'];

/** Why NVDA cannot run here; '' when it can. */
function PROBE__NvdaBlocked(): string
{
	return PHP_OS_FAMILY === 'Windows' ? '' : 'NVDA runs on Windows only - CI\'s windows-2025';
}

/** The nvda.exe of the portable copy of the config's NVDA, made once into the cache from its official installer, whose
 *  sha256 is checked. */
function PROBE__NvdaPortable(array $nvda): string
{
	$home = PROBE__Cache() . '/engines/nvda-' . $nvda['version'];
	if (is_file($home . '/nvda.exe')) {
		return $home . '/nvda.exe';
	}
	$installer = PROBE__Download('nvda-' . $nvda['version'], $nvda);
	$part = $home . '.part';
	PROBE__Remove($part);
	PROBE__Run([$installer, '--create-portable-silent', '--portable-path=' . $part]);
	if (!is_file($part . '/nvda.exe')) {
		throw new RuntimeException('the NVDA ' . $nvda['version'] . ' installer made no portable copy in ' . $part);
	}
	PROBE__Remove($home);
	rename($part, $home);
	unlink($installer);
	return $home . '/nvda.exe';
}

/** NVDA's config of a run: no welcome, updates, statistics, sounds or reading a page aloud at its load; the I/O log;
 *  the browse and focus mode said, not sounded; no reading under the mouse, which the probe never moves - a pointer
 *  passing over a watched desktop would speak; Remote Access serving itself on $port with $key as the follower. */
function PROBE__NvdaIni(int $port, string $key): string
{
	return <<<INI
	schemaVersion = 25
	[general]
		language = en
		showWelcomeDialogAtStartup = False
		askToExit = False
		playStartAndExitSounds = False
		saveConfigurationOnExit = False
		loggingLevel = IO
	[update]
		autoCheck = False
		startupNotification = False
		allowUsageStats = False
		askedAllowUsageStats = True
	[addonStore]
		automaticUpdates = disabled
	[speech]
		synth = oneCore
	[virtualBuffers]
		autoSayAllOnPageLoad = False
		passThroughAudioIndication = False
	[mouse]
		enableMouseTracking = False
	[remote]
		enabled = True
		[[controlServer]]
			autoconnect = True
			selfHosted = True
			connectionMode = 0
			port = $port
			key = $key
		[[ui]]
			confirmDisconnectAsFollower = False
			muteOnLocalControl = False

	INI;
}

/** Starts the portable NVDA $exe on a config of the run in $dir and joins its relay as the leader; answers the reader's
 *  handle once NVDA, the follower, is in the channel. Every phrase heard is written to $log. */
function PROBE__NvdaStart(string $name, string $exe, string $dir, string $log): array
{
	$config = $dir . '/nvda-config';
	PROBE__Remove($config);
	mkdir($config, 0777, true);
	$port = PROBE__FreePort();
	$key = bin2hex(random_bytes(8));
	file_put_contents($config . '/nvda.ini', PROBE__NvdaIni($port, $key));
	$proc = proc_open([$exe, '--config-path=' . $config, '--log-file=' . $dir . '/nvda.log'], [0 => ['file', PROBE_NULL, 'r'], 1 => ['file', PROBE_NULL, 'a'], 2 => ['file', PROBE_NULL, 'a']], $pipes);
	if (!is_resource($proc)) {
		throw new RuntimeException('cannot start ' . $exe);
	}
	$r = ['kind' => 'nvda', 'name' => $name, 'reader' => 'NVDA', 'reads' => true, 'quiet' => 1.5, 'log' => $log, 'exe' => $exe, 'proc' => $proc, 'socket' => null, 'buf' => '', 'heard' => [], 'clients' => [], 'symbols' => PROBE__NvdaSymbols(dirname($exe) . '/locale/en/symbols.dic')];
	try {
		PROBE__NvdaJoin($r, $port, $key, $config . '/remoteAccess/localRelay/NvdaRemoteRelay.fingerprint');
	} catch (Throwable $e) {
		PROBE__NvdaStop($r);
		throw $e;
	}
	return $r;
}

/** Joins the relay on $port with $key as the leader once its certificate's fingerprint is in $fingerprint - the relay
 *  writes it as it starts -, that certificate pinned; returns when the follower is in the channel. */
function PROBE__NvdaJoin(array &$r, int $port, string $key, string $fingerprint): void
{
	for ($until = microtime(true) + 60; true; usleep(250000)) {
		if (is_file($fingerprint)) {
			$context = stream_context_create(['ssl' => ['verify_peer' => false, 'verify_peer_name' => false, 'allow_self_signed' => true, 'peer_fingerprint' => ['sha256' => trim((string)file_get_contents($fingerprint))]]]);
			$socket = @stream_socket_client('tls://127.0.0.1:' . $port, $errno, $error, 5, STREAM_CLIENT_CONNECT, $context);
			if ($socket !== false) {
				break;
			}
		}
		if (microtime(true) > $until || ($r['proc'] !== null && !proc_get_status($r['proc'])['running'])) {
			throw new RuntimeException('NVDA did not serve its Remote Access within 60 s, see nvda.log');
		}
	}
	stream_set_blocking($socket, false);
	$r['socket'] = $socket;
	PROBE__NvdaSend($r, ['type' => 'protocol_version', 'version' => 2]);
	PROBE__NvdaSend($r, ['type' => 'join', 'channel' => $key, 'connection_type' => 'master']);
	for ($until = microtime(true) + 30; !in_array('slave', $r['clients'], true); PROBE__NvdaPump($r, 0.1)) {
		if (microtime(true) > $until) {
			throw new RuntimeException('NVDA did not join its own relay within 30 s, see nvda.log');
		}
	}
}

/** Sends $message to NVDA's relay as one line. */
function PROBE__NvdaSend(array &$r, array $message): void
{
	$line = json_encode($message, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n";
	$until = microtime(true) + 10;
	for ($at = 0, $total = strlen($line); $at < $total; $at += $written) {
		$written = fwrite($r['socket'], substr($line, $at));
		if ($written === false || ($written === 0 && microtime(true) > $until)) {
			throw new RuntimeException('NVDA\'s relay took no more from the probe');
		}
		if ($written === 0) {
			usleep(10000);
		}
	}
}

/** Reads what NVDA's relay sends within $seconds: each utterance a phrase heard at its time in ms, written to the log;
 *  who is in the channel; a relay error throws. */
function PROBE__NvdaPump(array &$r, float $seconds): void
{
	$until = microtime(true) + $seconds;
	do {
		$chunk = fread($r['socket'], 65536);
		if ($chunk === false || ($chunk === '' && feof($r['socket']))) {
			throw new RuntimeException('NVDA\'s relay closed, see nvda.log');
		}
		$r['buf'] .= $chunk;
		while (($end = strpos($r['buf'], "\n")) !== false) {
			$message = json_decode(substr($r['buf'], 0, $end), true);
			$r['buf'] = substr($r['buf'], $end + 1);
			match (is_array($message) ? $message['type'] ?? '' : '') {
				'speak' => PROBE__NvdaPhrase($r, $message['sequence'] ?? []),
				'channel_joined' => $r['clients'] = array_column($message['clients'] ?? [], 'connection_type'),
				'client_joined' => $r['clients'][] = $message['client']['connection_type'] ?? '',
				'error' => throw new RuntimeException('NVDA\'s relay answered ' . ($message['message'] ?? 'an error')),
				default => null,
			};
		}
		if ($chunk === '') {
			$read = [$r['socket']];
			$write = null;
			$except = null;
			@stream_select($read, $write, $except, 0, 20000);
		}
	} while (microtime(true) < $until);
}

/** Keeps the words of an utterance - its strings; its commands of pitch, pauses and indexes left out - as a phrase. The
 *  state of a lock key is no page's word: a virtual machine's host syncs NumLock as its window takes the focus, so it is
 *  logged, not heard. */
function PROBE__NvdaPhrase(array &$r, array $sequence): void
{
	$phrase = trim((string)preg_replace('~\s+~u', ' ', implode(', ', array_filter($sequence, fn(mixed $part): bool => is_string($part) && trim($part) !== ''))));
	if ($phrase === '') {
		return;
	}
	$at = microtime(true) * 1000;
	if (preg_match('~^(caps|num|scroll) lock (on|off)$~i', $phrase) === 1) {
		file_put_contents($r['log'], round($at) . "\t(not heard) " . $phrase . "\n", FILE_APPEND);
		return;
	}
	$r['heard'][] = [$at, $phrase];
	file_put_contents($r['log'], round($at) . "\t" . $phrase . "\n", FILE_APPEND);
}

/** The phrases NVDA said since the action began at $since (ms), in order: read for at least 0.3 s after it ended at
 *  $acted, until $quiet seconds without a new one - longer than a widget waits for the typing to pause - or $most
 *  seconds. After a key NVDA always $answers, the quiet counts from its first phrase: a busy browser answers late, and
 *  the next key's words would join this one's. */
function PROBE__NvdaHeard(array &$r, float $since, float $acted, float $quiet, float $most, bool $answers = false): array
{
	$r['heard'] = array_values(array_filter($r['heard'], fn(array $phrase): bool => $phrase[0] >= $since));
	while (true) {
		PROBE__NvdaPump($r, 0.05);
		$heard = array_column($r['heard'], 1);
		$spoke = max([$acted, ...array_column($r['heard'], 0)]);
		$now = microtime(true) * 1000;
		if ($now - $acted >= $most * 1000 || ($now - $acted >= 300 && $now - $spoke >= $quiet * 1000 && (!$answers || $heard !== []))) {
			return $heard;
		}
	}
}

/** The signs NVDA says as words at its default symbol level, some, read from the pinned copy's own $dic, the way NVDA
 *  tries them: its complex symbols first - every one, so a sentence's end is never a "dot" -, then the single signs,
 *  the longest first. Answers one pattern of a group a symbol and the words of the groups, '' for one said at a higher
 *  level only. */
function PROBE__NvdaSymbols(string $dic): array
{
	$levels = ['none' => 0, 'some' => 1, 'most' => 2, 'all' => 3, 'char' => 4];
	$section = '';
	$complex = [];
	$symbols = [];
	foreach (file($dic, FILE_IGNORE_NEW_LINES) ?: throw new RuntimeException('no ' . $dic) as $line) {
		$fields = explode("\t", $line);
		if (preg_match('~^(complexSymbols|symbols):$~', $line, $m) === 1) {
			$section = $m[1];
		} elseif ($line === '' || $line[0] === '#' || count($fields) < 2) {
			continue;
		} elseif ($section === 'complexSymbols') {
			if (preg_match('~(?<!\\\\)\((?!\?)~', $fields[1]) === 1) {
				throw new RuntimeException($dic . ': the complex symbol ' . $fields[0] . ' has a group of its own, which the probe cannot tell from its own');
			}
			$complex[$fields[0]] = $fields[1];
		} elseif ($section === 'symbols') {
			$sign = $fields[0] === '\\#' ? '#' : $fields[0];
			$said = ($levels[$fields[2] ?? 'all'] ?? 3) <= 1 ? $fields[1] : '';
			if (isset($complex[$sign])) {
				$symbols[] = [[0, 0], $complex[$sign], $said];
			} elseif ($said !== '' && !str_starts_with($sign, '\\')) {
				$symbols[] = [[1, -mb_strlen($sign)], preg_quote($sign, '~'), $said];
			}
		}
	}
	usort($symbols, fn(array $a, array $b): int => $a[0] <=> $b[0]);
	return ['pattern' => '~' . implode('|', array_map(fn(array $symbol): string => '(' . $symbol[1] . ')', $symbols)) . '~u', 'words' => array_column($symbols, 2)];
}

/** A page's $words as NVDA says them: each sign of level some as its word, the others as they are. */
function PROBE__NvdaSays(array &$r, string $words): string
{
	return (string)preg_replace_callback($r['symbols']['pattern'], fn(array $m): string => ' ' . $r['symbols']['words'][count($m) - 2] . ' ', $words);
}

/** The virtual key of $char on the US layout and whether Shift is held for it. */
function PROBE__NvdaChar(string $char): array
{
	return match (true) {
		preg_match('~^[a-z0-9 ]$~', $char) === 1 => [ord(strtoupper($char)), false],
		preg_match('~^[A-Z]$~', $char) === 1 => [ord($char), true],
		isset(PROBE_NVDA_SIGNS[$char]) => [PROBE_NVDA_SIGNS[$char], false],
		isset(PROBE_NVDA_SHIFTED[$char]) => [PROBE__NvdaChar(PROBE_NVDA_SHIFTED[$char])[0], true],
		default => throw new RuntimeException('NVDA cannot type «' . $char . '»: it is not on the US layout'),
	};
}

/** Sends the keys - [virtual key, extended] - down in order, then up in reverse, through NVDA. */
function PROBE__NvdaKeys(array &$r, array $keys): void
{
	foreach ([true, false] as $pressed) {
		foreach ($pressed ? $keys : array_reverse($keys) as [$vk, $extended]) {
			PROBE__NvdaSend($r, ['type' => 'key', 'vk_code' => $vk, 'extended' => $extended, 'pressed' => $pressed]);
		}
	}
}

/** Presses $combination - Enter, Control+Home, NVDA+t -, its modifiers held around its last key; Meta is Control here,
 *  as the library's shortcuts answer on Windows. */
function PROBE__NvdaPress(array &$r, string $combination): void
{
	$keys = [];
	foreach (explode('+', $combination) as $part) {
		$keys[] = PROBE_NVDA_KEYS[$part === 'Meta' ? 'Control' : $part] ?? (strlen($part) === 1 ? [PROBE__NvdaChar(strtolower($part))[0], false] : throw new RuntimeException('no key ' . $part . ' for NVDA'));
	}
	PROBE__NvdaKeys($r, $keys);
}

/** Types $text through NVDA, a key a character. */
function PROBE__NvdaType(array &$r, string $text): void
{
	foreach (mb_str_split($text) as $char) {
		[$vk, $shift] = PROBE__NvdaChar($char);
		PROBE__NvdaKeys($r, $shift ? [PROBE_NVDA_KEYS['Shift'], [$vk, false]] : [[$vk, false]]);
	}
}

/** Presses $combination and answers what NVDA said after it, until $quiet seconds without a new phrase, counted from its
 *  first phrase for a key NVDA always $answers. */
function PROBE__NvdaSay(array &$r, string $combination, float $quiet = 0.5, bool $answers = false): array
{
	$since = microtime(true) * 1000;
	PROBE__NvdaPress($r, $combination);
	return PROBE__NvdaHeard($r, $since, microtime(true) * 1000, $quiet, $answers ? 5 : 3, $answers);
}

/** A loaded page made ready for NVDA as a user meets it: the browser's window in front - Alt+Escape until NVDA's title
 *  is the page's -, the focus on the page, not the browser's bar - F6 until the document has it -, browse mode from the
 *  top, its first words let pass. */
function PROBE__NvdaReady(array &$r, array &$h, string $page): void
{
	$title = (string)PROBE__Do($h, 'Eval', 'document.title');
	PROBE__Do($h, 'Front');
	// What NVDA said of the load passes first - it holds the title too -, and a busy browser may take a second to answer.
	PROBE__NvdaHeard($r, microtime(true) * 1000, microtime(true) * 1000, 1.0, 10);
	for ($tries = 0; PROBE__SpeechMissing($r, [$title], $said = PROBE__NvdaSay($r, 'NVDA+t', 1.0, true)) !== []; $tries++) {
		if ($tries >= 10) {
			throw new RuntimeException($page . ': the browser\'s window never came in front - NVDA+T said «' . implode(' · ', $said) . '»');
		}
		PROBE__NvdaSay($r, 'Alt+Escape', 1.0);
	}
	for ($tries = 0; PROBE__Do($h, 'Eval', 'document.hasFocus()') !== true; $tries++) {
		if ($tries >= 6) {
			throw new RuntimeException($page . ': F6 never put the focus on the page');
		}
		PROBE__NvdaSay($r, 'F6');
	}
	// Firefox can leave NVDA on the whole browser after its window comes in front (nvaccess/nvda #5758); a switch to focus
	// mode and back puts NVDA on the page - told by NVDA's words, as the page may come up in focus mode already, the focus
	// put in a menu or a field. The switch focuses what NVDA's cursor is on - NVDA brings its cursor back where it was on
	// the page's last load -, so the focus leaves it again: a step's focus must arrive.
	for ($modes = []; array_slice($modes, -2) !== ['focus mode', 'browse mode'];) {
		if (count($modes) >= 4) {
			throw new RuntimeException($page . ': NVDA+Space never went to focus mode and back - NVDA said «' . implode(' · ', $modes) . '»');
		}
		$said = PROBE__SpeechWords(implode(', ', PROBE__NvdaSay($r, 'NVDA+Space', 0.5, true)));
		$modes[] = str_contains($said, 'browse mode') ? 'browse mode' : (str_contains($said, 'focus mode') ? 'focus mode' : $said);
	}
	PROBE__Do($h, 'Eval', '(() => { document.activeElement?.blur(); window.REDZ_PROBE_ESCAPES ??= (addEventListener("keydown", (event) => { if (event.key === "Escape") { window.REDZ_PROBE_ESCAPES += 1; } }, true), 0); return true; })()');
	PROBE__NvdaSay($r, 'Control+Home');
	PROBE__NvdaHeard($r, microtime(true) * 1000, microtime(true) * 1000, 1.0, 5);
}

/** A step's keys, pressed through NVDA. */
function PROBE__NvdaAct(array &$r, array &$h, array $step): void
{
	match ($step['do']) {
		'key' => $step['key'] === 'Escape' ? PROBE__NvdaEscape($r, $h) : PROBE__NvdaPress($r, $step['key']),
		'type' => PROBE__NvdaType($r, $step['text']),
		'chord' => PROBE__NvdaPress($r, $step['keys']),
	};
}

/** Escape as a user presses it under NVDA: NVDA takes an Escape in focus mode for itself, back to browse mode, the page
 *  none the wiser - then the user presses it again, and NVDA hands it to the page. */
function PROBE__NvdaEscape(array &$r, array &$h): void
{
	$seen = PROBE__Do($h, 'Eval', 'window.REDZ_PROBE_ESCAPES ?? 0');
	PROBE__NvdaSay($r, 'Escape', 0.3);
	if (PROBE__Do($h, 'Eval', 'window.REDZ_PROBE_ESCAPES ?? 0') === $seen) {
		PROBE__NvdaPress($r, 'Escape');
	}
}

/** What NVDA says at each press of its quick navigation's $key from the top of the page until it says $end, at most
 *  $presses; null when it answers a press with nothing - in browse mode it answers every one, past the last with "no next
 *  heading" and the like. */
function PROBE__NvdaReadKind(array &$r, string $key, string $end, int $presses): ?array
{
	// The top of the page is already inside its first item - the banner -, which NVDA says there, not at the first key.
	$said = [implode(', ', PROBE__NvdaSay($r, 'Control+Home', 0.5, true))];
	for ($press = 0; $press < $presses; $press++) {
		$words = implode(', ', PROBE__NvdaSay($r, $key, 0.4, true));
		if ($words === '') {
			return null;
		}
		if (str_contains(PROBE__SpeechWords($words), $end)) {
			break;
		}
		$said[] = $words;
	}
	return $said;
}

/** NVDA reads the page whole by its quick navigation, on a page of its own: for each kind of item - headings by H,
 *  landmarks by D, form fields by F - from the top until NVDA says there is no next one, each press's words held in
 *  order against what the page holds (tools/probes/read.js). An item NVDA never says, and an item with no words to say,
 *  are findings; answers what was read and the findings, an exception's not among them. */
function PROBE__NvdaRead(array &$r, array &$h, string $page, array $run, array &$report): array
{
	$name = $r['name'];
	PROBE__SpeechLoad($h, $page, $run);
	PROBE__NvdaReady($r, $h, $page);
	$holds = PROBE__Do($h, 'Eval', $run['read']);
	$read = [];
	$findings = [];
	foreach (PROBE_NVDA_READ as $kind => [$key, $end]) {
		$items = $holds[$kind];
		// A key NVDA leaves unanswered went to the page in focus mode - a click in the window put the focus in a menu or a
		// field -: the page made ready again, the kind is read anew.
		for ($again = 0; ($said = PROBE__NvdaReadKind($r, $key, $end, 2 * count($items) + 10)) === null; $again++) {
			if ($again >= 2) {
				throw new RuntimeException($page . ': NVDA answered no ' . strtoupper($key) . ' - it does not read the page in browse mode');
			}
			PROBE__NvdaReady($r, $h, $page);
			// Ready leaves NVDA at the top, inside the banner, which the kind's own Control+Home then would not say.
			PROBE__NvdaSay($r, 'Control+End');
		}
		$at = 0;
		foreach ($items as $k => $item) {
			$label = $kind . ' ' . ($k + 1) . ' of ' . count($items) . ' (' . $item['what'] . ')';
			$expect = array_values(array_filter([$item['words'], PROBE_NVDA_LANDMARKS[$item['role'] ?? ''] ?? ''], fn(string $words): bool => $words !== ''));
			$found = null;
			for ($i = $at; $found === null && $i < count($said) && $expect !== []; $i++) {
				$found = PROBE__SpeechMissing($r, $expect, [$said[$i]]) === [] ? $i : null;
			}
			$read[] = ['engine' => $name, 'kind' => $kind, 'item' => $label, 'expect' => $expect, 'said' => $found === null ? '' : $said[$found]];
			$finding = match (true) {
				$item['words'] === '' && $kind !== 'landmark' => $name . ' ' . $page . " - NVDA's reading by " . strtoupper($key) . ': ' . $label . ' has no words to say',
				$found === null => $name . ' ' . $page . " - NVDA's reading by " . strtoupper($key) . ' never said «' . implode('», «', $expect) . '» of ' . $label,
				default => '',
			};
			$at = $found === null ? $at : $found + 1;
			if ($finding !== '' && !PROBE__FindingAllowed($run['config'], $name, $finding, $page, $report)) {
				$findings[] = $finding;
			}
		}
	}
	return [$read, $findings];
}

/** Starts NVDA, then the engine's browser in a shown window; NVDA reads each speech page and hears its steps into the
 *  report; every phrase heard stays in the sheet's logs/NAME-phrases.log, NVDA's own log in logs/. */
function PROBE__NvdaRun(string $name, array $engine, string $binary, string $dir, array $run, array &$report): void
{
	$log = $run['sheet'] . '/logs/' . $name . '-phrases.log';
	@mkdir(dirname($log), 0777, true);
	$exe = PROBE__NvdaPortable($run['config']['nvda']);
	$r = PROBE__NvdaStart($name, $exe, $dir, $log);
	$h = null;
	try {
		$h = $engine['browser'] === 'chrome' ? PROBE__ChromeStart($binary, $dir, true) : PROBE__FirefoxStart($binary, $dir, ['browser.aboutwelcome.enabled' => false, 'browser.startup.homepage_override.mstone' => 'ignore', 'browser.startup.upgradeDialog.enabled' => false], true);
		$report['engines'][$name] = ['version' => $h['version'] . ' · NVDA ' . $run['config']['nvda']['version'] . ' · Windows ' . php_uname('r') . ' ' . php_uname('v'), 'cells' => 0];
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
		PROBE__NvdaStop($r);
	}
}

/** Leaves NVDA's relay and quits NVDA. */
function PROBE__NvdaStop(array &$r): void
{
	if ($r['socket'] !== null) {
		@fclose($r['socket']);
		$r['socket'] = null;
	}
	try {
		PROBE__Run([$r['exe'], '--quit']);
	} catch (RuntimeException) {
		// An NVDA that does not answer --quit is ended by PROBE__Wait.
	}
	PROBE__Wait($r['proc']);
}

/** Readies CI's Windows for NVDA: the apps' notifications off - NVDA reads one aloud and follows it, as it did Firefox's
 *  "pin to taskbar" in the middle of a page -, and a window the probe starts may come in front of the others: Windows'
 *  foreground lock off for later sessions, and for this one where Windows lets the setup change it - otherwise NVDA's
 *  Alt+Escape brings the window. */
function PROBE__NvdaSetup(): int
{
	if (PROBE__NvdaBlocked() !== '') {
		fwrite(STDERR, PROBE__NvdaBlocked() . "\n");
		return 1;
	}
	PROBE__Run(['reg', 'add', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\PushNotifications', '/v', 'ToastEnabled', '/t', 'REG_DWORD', '/d', '0', '/f']);
	foreach (['ForegroundLockTimeout', 'ForegroundFlashCount'] as $value) {
		PROBE__Run(['reg', 'add', 'HKCU\\Control Panel\\Desktop', '/v', $value, '/t', 'REG_DWORD', '/d', '0', '/f']);
	}
	$script = 'Add-Type -Namespace Probe -Name User32 -MemberDefinition \'[DllImport("user32.dll")] public static extern bool SystemParametersInfo(uint action, uint param, System.IntPtr value, uint flags);\'; [Probe.User32]::SystemParametersInfo(0x2001, 0, [System.IntPtr]::Zero, 3)';
	$now = trim(PROBE__Run(['powershell', '-NoProfile', '-NonInteractive', '-EncodedCommand', base64_encode(mb_convert_encoding($script, 'UTF-16LE', 'UTF-8'))]));
	echo 'the foreground lock is off for later sessions', $now === 'True' ? ' and this one' : '; this session keeps it (Windows refused the change), so NVDA\'s Alt+Escape brings the window', "\n";
	return 0;
}

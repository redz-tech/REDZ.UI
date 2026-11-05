<?php
// probes, Chrome: the DevTools protocol over --remote-debugging-pipe, or over a port and our WebSocket on Windows, where
// PHP cannot hand a child the pipe's descriptors - one headless Chrome a run with one page, a shown one for a screen
// reader; the viewport, the color scheme and forced colors by emulation; full-page shots, print to PDF, errors from the
// page's events.

/** Starts the Chrome at $binary with its profile in $dir - headless, or $shown in a window a screen reader can read -
 *  and opens the page every load goes to. */
function PROBE__ChromeStart(string $binary, string $dir, bool $shown = false): array
{
	$port = PHP_OS_FAMILY === 'Windows';
	$window = $shown ? ['--force-renderer-accessibility', '--window-position=0,0', '--window-size=1280,900'] : ['--headless'];
	// Ubuntu 24.04 keeps unprivileged user namespaces from Chrome's sandbox, so CI's Linux machines run it without one.
	$flags = [...$window, ...(PHP_OS_FAMILY === 'Linux' ? ['--no-sandbox'] : []), $port ? '--remote-debugging-port=0' : '--remote-debugging-pipe', '--no-first-run', '--no-default-browser-check', '--use-mock-keychain', '--password-store=basic', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--user-data-dir=' . $dir . '/profile'];
	$descriptors = [0 => ['file', PROBE_NULL, 'r'], 1 => ['file', $dir . '/chrome.log', 'a'], 2 => ['file', $dir . '/chrome.log', 'a']] + ($port ? [] : [3 => ['pipe', 'r'], 4 => ['pipe', 'w']]);
	$proc = proc_open([$binary, ...$flags, 'about:blank'], $descriptors, $pipes);
	if (!is_resource($proc)) {
		throw new RuntimeException('cannot start ' . $binary);
	}
	$h = ['kind' => 'chrome', 'proc' => $proc, 'pipes' => $pipes, 'socket' => null, 'buf' => '', 'id' => 0, 'events' => [], 'session' => ''];
	if ($port) {
		$h['socket'] = PROBE__ChromeSocket($proc, $dir . '/profile');
	} else {
		stream_set_blocking($pipes[4], false);
	}
	$h['version'] = str_replace('HeadlessChrome', 'Chrome', (string)PROBE__ChromeSend($h, 'Browser.getVersion', [], false)['product']);
	$target = PROBE__ChromeSend($h, 'Target.createTarget', ['url' => 'about:blank'], false)['targetId'];
	$h['session'] = PROBE__ChromeSend($h, 'Target.attachToTarget', ['targetId' => $target, 'flatten' => true], false)['sessionId'];
	foreach (['Page.enable', 'Runtime.enable', 'Network.enable', 'Log.enable'] as $method) {
		PROBE__ChromeSend($h, $method);
	}
	PROBE__ChromeSend($h, 'Network.setCacheDisabled', ['cacheDisabled' => true]);
	PROBE__ChromeSend($h, 'Emulation.setScrollbarsHidden', ['hidden' => true]);
	// A shown window keeps the real focus, which a screen reader follows and the page tells by document.hasFocus().
	if (!$shown) {
		PROBE__ChromeSend($h, 'Emulation.setFocusEmulationEnabled', ['enabled' => true]);
	}
	return $h;
}

/** The WebSocket of the browser endpoint Chrome writes into DevToolsActivePort of its profile $profile once it listens. */
function PROBE__ChromeSocket($proc, string $profile)
{
	$file = $profile . '/DevToolsActivePort';
	$until = microtime(true) + 60;
	while (count($lines = is_file($file) ? file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] : []) < 2) {
		if (microtime(true) > $until || !proc_get_status($proc)['running']) {
			proc_terminate($proc);
			throw new RuntimeException('Chrome did not open its DevTools port, see chrome.log');
		}
		usleep(100000);
	}
	return PROBE__WsOpen((int)$lines[0], $lines[1]);
}

/** Reads what Chrome writes within $seconds into the handle's messages - with $first only until a message is in. */
function PROBE__ChromePump(array &$h, float $seconds, bool $first = false): void
{
	$until = microtime(true) + $seconds;
	do {
		$write = null;
		$except = null;
		$had = count($h['events']);
		if ($h['socket'] !== null) {
			// A frame read may leave the next ones in the stream's own buffer, which the select does not see.
			$read = [$h['socket']];
			if (stream_get_meta_data($h['socket'])['unread_bytes'] > 0 || stream_select($read, $write, $except, 0, 20000) > 0) {
				$text = PROBE__WsRead($h['socket']);
				if ($text === null) {
					throw new RuntimeException('Chrome left');
				}
				$h['events'][] = json_decode($text, true);
			}
		} else {
			$read = [$h['pipes'][4]];
			if (stream_select($read, $write, $except, 0, 20000) > 0) {
				$chunk = (string)fread($h['pipes'][4], 1048576);
				if ($chunk === '' && feof($h['pipes'][4])) {
					throw new RuntimeException('Chrome left');
				}
				$h['buf'] .= $chunk;
			}
			while (($end = strpos($h['buf'], "\0")) !== false) {
				$h['events'][] = json_decode(substr($h['buf'], 0, $end), true);
				$h['buf'] = substr($h['buf'], $end + 1);
			}
		}
		if ($first && count($h['events']) > $had) {
			return;
		}
	} while (microtime(true) < $until);
}

/** Sends $method - to the page, or to the browser when $page is false - and answers its result; an error answer throws. */
function PROBE__ChromeSend(array &$h, string $method, array $params = [], bool $page = true): array
{
	$id = ++$h['id'];
	$message = ['id' => $id, 'method' => $method, 'params' => (object)$params] + ($page ? ['sessionId' => $h['session']] : []);
	$json = json_encode($message, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
	if ($h['socket'] !== null) {
		PROBE__WsSend($h['socket'], $json);
	} else {
		fwrite($h['pipes'][3], $json . "\0");
	}
	$until = microtime(true) + 120;
	while (microtime(true) < $until) {
		foreach ($h['events'] as $k => $answer) {
			if (($answer['id'] ?? null) === $id) {
				unset($h['events'][$k]);
				if (isset($answer['error'])) {
					throw new RuntimeException('Chrome ' . $method . ': ' . json_encode($answer['error']));
				}
				return $answer['result'] ?? [];
			}
		}
		PROBE__ChromePump($h, 0.02, true);
	}
	throw new RuntimeException('Chrome gave no answer to ' . $method . (isset($params['expression']) ? ' of ' . substr((string)preg_replace('~^\(async \(\) => JSON\.stringify\(await \(~', '', (string)$params['expression']), 0, 90) : ''));
}

/** Loads $url in a $width × $height viewport (a phone below 600 px, two device pixels a CSS pixel) with the color scheme
 *  $scheme and forced colors on or off; answers when the document is complete. */
function PROBE__ChromeLoad(array &$h, string $url, int $width, int $height, string $scheme = 'light', bool $forced = false): void
{
	$phone = $width < 600;
	PROBE__ChromeSend($h, 'Emulation.setDeviceMetricsOverride', ['width' => $width, 'height' => $height, 'deviceScaleFactor' => $phone ? 2 : 1, 'mobile' => $phone]);
	PROBE__ChromeSend($h, 'Emulation.setEmulatedMedia', ['media' => '', 'features' => [['name' => 'prefers-color-scheme', 'value' => $scheme], ['name' => 'forced-colors', 'value' => $forced ? 'active' : 'none']]]);
	$h['events'] = [];
	PROBE__ChromeSend($h, 'Page.navigate', ['url' => $url]);
	$until = microtime(true) + 30;
	while (PROBE__ChromeEval($h, 'document.readyState === "complete" && location.href === ' . json_encode($url)) !== true) {
		if (microtime(true) > $until) {
			throw new RuntimeException('Chrome did not load ' . $url);
		}
		usleep(10000);
	}
}

/** Runs the script $source in the page. */
function PROBE__ChromeInject(array &$h, string $source): void
{
	$r = PROBE__ChromeSend($h, 'Runtime.evaluate', ['expression' => $source, 'returnByValue' => true]);
	if (isset($r['exceptionDetails'])) {
		throw new RuntimeException('the page threw: ' . ($r['exceptionDetails']['exception']['description'] ?? $r['exceptionDetails']['text']));
	}
}

/** The value of $expression in the page, a promise awaited; the value travels as JSON. */
function PROBE__ChromeEval(array &$h, string $expression): mixed
{
	$r = PROBE__ChromeSend($h, 'Runtime.evaluate', ['expression' => '(async () => JSON.stringify(await (' . $expression . ')))()', 'awaitPromise' => true, 'returnByValue' => true]);
	if (isset($r['exceptionDetails'])) {
		throw new RuntimeException('the page threw: ' . ($r['exceptionDetails']['exception']['description'] ?? $r['exceptionDetails']['text']));
	}
	return json_decode((string)($r['result']['value'] ?? 'null'), true);
}

/** Presses and releases the key, a name of PROBE_KEYS, as the user would. */
function PROBE__ChromeKey(array &$h, string $key): void
{
	[, $code, $text] = PROBE_KEYS[$key];
	$event = ['key' => $key === 'Space' ? ' ' : $key, 'code' => $key, 'windowsVirtualKeyCode' => $code];
	PROBE__ChromeSend($h, 'Input.dispatchKeyEvent', ['type' => $text === '' ? 'rawKeyDown' : 'keyDown'] + $event + ($text === '' ? [] : ['text' => $text, 'unmodifiedText' => $text]));
	PROBE__ChromeSend($h, 'Input.dispatchKeyEvent', ['type' => 'keyUp'] + $event);
}

/** Types the text key by key, as the user would. */
function PROBE__ChromeType(array &$h, string $text): void
{
	foreach (mb_str_split($text) as $char) {
		PROBE__ChromeSend($h, 'Input.dispatchKeyEvent', ['type' => 'keyDown', 'text' => $char, 'unmodifiedText' => $char, 'key' => $char]);
		PROBE__ChromeSend($h, 'Input.dispatchKeyEvent', ['type' => 'keyUp', 'key' => $char]);
	}
}

/** Clicks the primary mouse button at the point of the viewport. */
function PROBE__ChromeClick(array &$h, int $x, int $y): void
{
	foreach (['mousePressed', 'mouseReleased'] as $type) {
		PROBE__ChromeSend($h, 'Input.dispatchMouseEvent', ['type' => $type, 'x' => $x, 'y' => $y, 'button' => 'left', 'clickCount' => 1]);
	}
}

/** Drags the mouse from one point of the viewport to another with the left button held, in five moves. */
function PROBE__ChromeDrag(array &$h, int $x, int $y, int $toX, int $toY): void
{
	PROBE__ChromeSend($h, 'Input.dispatchMouseEvent', ['type' => 'mousePressed', 'x' => $x, 'y' => $y, 'button' => 'left', 'buttons' => 1, 'clickCount' => 1]);
	foreach ([0.1, 0.3, 0.6, 0.9, 1.0] as $t) {
		PROBE__ChromeSend($h, 'Input.dispatchMouseEvent', ['type' => 'mouseMoved', 'x' => $x + ($toX - $x) * $t, 'y' => $y + ($toY - $y) * $t, 'button' => 'left', 'buttons' => 1]);
		usleep(40000);
	}
	PROBE__ChromeSend($h, 'Input.dispatchMouseEvent', ['type' => 'mouseReleased', 'x' => $toX, 'y' => $toY, 'button' => 'left', 'buttons' => 0, 'clickCount' => 1]);
}

/** Moves the mouse to the point of the viewport. */
function PROBE__ChromeHover(array &$h, int $x, int $y): void
{
	PROBE__ChromeSend($h, 'Input.dispatchMouseEvent', ['type' => 'mouseMoved', 'x' => $x, 'y' => $y]);
}

/**
 * The fonts the engine drew the text of each element matching $selector with: the elements' order => family names.
 * @return list<list<string>>
 */
function PROBE__ChromeFonts(array &$h, string $selector): array
{
	$mark = count($h['events']);
	PROBE__ChromeSend($h, 'DOM.enable');
	PROBE__ChromeSend($h, 'CSS.enable');
	$root = PROBE__ChromeSend($h, 'DOM.getDocument', ['depth' => 0])['root']['nodeId'];
	$fonts = [];
	foreach (PROBE__ChromeSend($h, 'DOM.querySelectorAll', ['nodeId' => $root, 'selector' => $selector])['nodeIds'] as $node) {
		$fonts[] = array_column(PROBE__ChromeSend($h, 'CSS.getPlatformFontsForNode', ['nodeId' => $node])['fonts'] ?? [], 'familyName');
	}
	PROBE__ChromeSend($h, 'CSS.disable');
	PROBE__ChromeSend($h, 'DOM.disable');
	PROBE__ChromePump($h, 0.2);
	$own = fn(array $m): bool => ($m['method'] ?? '') === 'Network.loadingFailed' && ($m['params']['errorText'] ?? '') === 'net::ERR_CACHE_MISS';
	$h['events'] = [...array_slice($h['events'], 0, $mark), ...array_filter(array_slice($h['events'], $mark), fn(array $m): bool => !$own($m))];
	return $fonts;
}

/** Brings the page's window in front of the others. */
function PROBE__ChromeFront(array &$h): void
{
	PROBE__ChromeSend($h, 'Page.bringToFront');
}

/** A PNG of the whole page. */
function PROBE__ChromeShot(array &$h): string
{
	$size = PROBE__ChromeSend($h, 'Page.getLayoutMetrics')['cssContentSize'];
	$clip = ['x' => 0, 'y' => 0, 'width' => $size['width'], 'height' => min($size['height'], PROBE_SHOT_MAX), 'scale' => 1];
	return base64_decode(PROBE__ChromeSend($h, 'Page.captureScreenshot', ['format' => 'png', 'captureBeyondViewport' => true, 'clip' => $clip])['data']);
}

/** A PDF of the page printed on A4 the way a reader prints it, backgrounds off. */
function PROBE__ChromePrint(array &$h): string
{
	return base64_decode(PROBE__ChromeSend($h, 'Page.printToPDF', ['paperWidth' => 8.27, 'paperHeight' => 11.69, 'printBackground' => false])['data']);
}

/** The page's errors since its load: exceptions, console errors and warnings, failed requests, answers from 400. */
function PROBE__ChromeErrors(array &$h): array
{
	PROBE__ChromePump($h, 0.2);
	$errors = [];
	foreach ($h['events'] as $m) {
		$params = $m['params'] ?? [];
		if (str_ends_with((string)($params['response']['url'] ?? $params['entry']['url'] ?? ''), '/favicon.ico')) {
			continue;
		}
		$errors[] = match ($m['method'] ?? '') {
			'Network.responseReceived' => $params['response']['status'] >= 400 ? $params['response']['status'] . ' ' . $params['response']['url'] : '',
			'Network.loadingFailed' => empty($params['canceled']) ? 'failed ' . $params['errorText'] : '',
			'Runtime.exceptionThrown' => 'exception ' . ($params['exceptionDetails']['exception']['description'] ?? $params['exceptionDetails']['text']),
			'Runtime.consoleAPICalled' => in_array($params['type'], ['error', 'warning'], true) ? 'console ' . json_encode($params['args'][0]['value'] ?? $params['args'][0] ?? '', JSON_UNESCAPED_SLASHES) : '',
			'Log.entryAdded' => in_array($params['entry']['level'], ['error', 'warning'], true) ? 'log ' . $params['entry']['text'] : '',
			default => '',
		};
	}
	return array_values(array_unique(array_filter($errors)));
}

/** Closes Chrome and waits for it to leave. */
function PROBE__ChromeStop(array &$h): void
{
	try {
		PROBE__ChromeSend($h, 'Browser.close', [], false);
	} catch (Throwable) {
		// Chrome may leave before it answers; PROBE__Wait ends it either way.
	}
	foreach ($h['pipes'] as $pipe) {
		@fclose($pipe);
	}
	if ($h['socket'] !== null) {
		@fclose($h['socket']);
	}
	PROBE__Wait($h['proc']);
}

<?php
// probes, Chrome: the DevTools protocol over --remote-debugging-pipe — one headless Chrome a run with one page; the
// viewport, the color scheme and forced colors by emulation; full-page shots, print to PDF, errors from the page's events.

/** Starts the Chrome at $binary with its profile in $dir and opens the page every load goes to. */
function PROBE__ChromeStart(string $binary, string $dir): array
{
	$flags = ['--headless', '--remote-debugging-pipe', '--no-first-run', '--no-default-browser-check', '--use-mock-keychain', '--password-store=basic', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--user-data-dir=' . $dir . '/profile'];
	$proc = proc_open([$binary, ...$flags, 'about:blank'], [0 => ['file', '/dev/null', 'r'], 1 => ['file', $dir . '/chrome.log', 'a'], 2 => ['file', $dir . '/chrome.log', 'a'], 3 => ['pipe', 'r'], 4 => ['pipe', 'w']], $pipes);
	if (!is_resource($proc)) {
		throw new RuntimeException('cannot start ' . $binary);
	}
	stream_set_blocking($pipes[4], false);
	$h = ['kind' => 'chrome', 'proc' => $proc, 'pipes' => $pipes, 'buf' => '', 'id' => 0, 'events' => [], 'session' => ''];
	$h['version'] = str_replace('HeadlessChrome', 'Chrome', (string)PROBE__ChromeSend($h, 'Browser.getVersion', [], false)['product']);
	$target = PROBE__ChromeSend($h, 'Target.createTarget', ['url' => 'about:blank'], false)['targetId'];
	$h['session'] = PROBE__ChromeSend($h, 'Target.attachToTarget', ['targetId' => $target, 'flatten' => true], false)['sessionId'];
	foreach (['Page.enable', 'Runtime.enable', 'Network.enable', 'Log.enable'] as $method) {
		PROBE__ChromeSend($h, $method);
	}
	PROBE__ChromeSend($h, 'Network.setCacheDisabled', ['cacheDisabled' => true]);
	PROBE__ChromeSend($h, 'Emulation.setScrollbarsHidden', ['hidden' => true]);
	PROBE__ChromeSend($h, 'Emulation.setFocusEmulationEnabled', ['enabled' => true]);
	return $h;
}

/** Reads what Chrome writes within $seconds into the handle's messages. */
function PROBE__ChromePump(array &$h, float $seconds): void
{
	$until = microtime(true) + $seconds;
	do {
		$read = [$h['pipes'][4]];
		$write = null;
		$except = null;
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
	} while (microtime(true) < $until);
}

/** Sends $method — to the page, or to the browser when $page is false — and answers its result; an error answer throws. */
function PROBE__ChromeSend(array &$h, string $method, array $params = [], bool $page = true): array
{
	$id = ++$h['id'];
	$message = ['id' => $id, 'method' => $method, 'params' => (object)$params] + ($page ? ['sessionId' => $h['session']] : []);
	fwrite($h['pipes'][3], json_encode($message, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\0");
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
		PROBE__ChromePump($h, 0.02);
	}
	throw new RuntimeException('Chrome gave no answer to ' . $method);
}

/** Loads $url in a $width × $height viewport (a phone below 600 px, two device pixels a CSS pixel) with the color scheme
 *  $scheme and forced colors on or off; answers when the document is complete. */
function PROBE__ChromeLoad(array &$h, string $url, int $width, int $height, string $scheme, bool $forced): void
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
		usleep(50000);
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
	$event = ['key' => $key, 'code' => $key, 'windowsVirtualKeyCode' => $code, 'nativeVirtualKeyCode' => $code];
	PROBE__ChromeSend($h, 'Input.dispatchKeyEvent', ['type' => $text === '' ? 'rawKeyDown' : 'keyDown'] + $event + ($text === '' ? [] : ['text' => $text, 'unmodifiedText' => $text]));
	PROBE__ChromeSend($h, 'Input.dispatchKeyEvent', ['type' => 'keyUp'] + $event);
}

/** Clicks the primary mouse button at the point of the viewport. */
function PROBE__ChromeClick(array &$h, int $x, int $y): void
{
	foreach (['mousePressed', 'mouseReleased'] as $type) {
		PROBE__ChromeSend($h, 'Input.dispatchMouseEvent', ['type' => $type, 'x' => $x, 'y' => $y, 'button' => 'left', 'clickCount' => 1]);
	}
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
	PROBE__Wait($h['proc']);
}

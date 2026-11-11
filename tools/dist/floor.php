<?php
// floor - the browser floor checker of REDZ.UI: every property, value, function, unit, selector, at-rule, media feature,
// element and attribute of a stylesheet or a page, and the globals, statics, members and statements of a script (.js,
// .mjs, read by min.php beside it), judged by floor.json beside it - each name's verdict at the floor from MDN's
// browser-compat-data, and the release's exceptions. The core of the library's own gate, tools/floor.php, and shipped as
// it is in each release's redz-ui-tools-<version>.zip. PHP 8.4+, no network.
// Usage: php floor.php check [--allow=FILE] [--json] FILE… - a finding a line on stdout, FILE:LINE  NAME (KEY) - BROWSER
// VERSION VERDICT, …, the notes to check by hand and the summary on stderr; exit 0 clean, 1 findings, 2 anything else.
// A member of one plain word short of the floor - bytes, sync - is as often the page's own data: a note, failing nothing. A block counts only for the
// browsers that apply it (@media, @supports), and a vendor form beside a property covers it; a script that tests a name
// ('X' in o, typeof, ?., o.X && …) is spared it. An exception needs a reason: /* floor-allow NAME[, NAME…] -- reason */
// (or // in a script) covers those names on its own lines and the next one, and --allow=FILE reads
// {"allow": [{"name": NAME, "browsers": [BROWSER…], "reason": TEXT}]}; one that allows nothing is a finding.

require_once is_file(__DIR__ . '/min.php') ? __DIR__ . '/min.php' : dirname(__DIR__) . '/min.php';

const FLOOR_BROWSERS = ['chrome', 'chrome_android', 'edge', 'firefox', 'firefox_android', 'safari', 'safari_ios'];
// Where an exception of the release holds: for any stylesheet, or for the library's own files, whose code stands in.
const FLOOR_SCOPES = ['any', 'library'];
const FLOOR_LIST_PROPERTIES = ['transition', 'transition-property', 'will-change'];
const FLOOR_RULE_AT_RULES = ['media', 'supports', 'container', 'layer', 'starting-style', 'scope'];
const FLOOR_SYSTEM_COLORS = ['accentcolor', 'accentcolortext', 'activetext', 'buttonborder', 'buttonface', 'buttontext', 'canvas', 'canvastext', 'field', 'fieldtext', 'graytext', 'highlight', 'highlighttext', 'linktext', 'mark', 'marktext', 'selecteditem', 'selecteditemtext', 'visitedtext'];
const FLOOR_COMBINATORS = ['>' => 'child', '+' => 'next-sibling', '~' => 'subsequent-sibling', '*' => 'universal', '&' => 'nesting', '|' => 'namespace'];
const FLOOR_SELECTOR_ARGUMENTS = ['is', 'where', 'not', 'has', 'host', 'host-context', 'slotted'];
const FLOOR_RANGE = ['<', '>', '='];
const FLOOR_FUNCTION_ALIASES = ['rgba' => 'rgb'];
// The kinds of the names a script's tokens give; floor.json holds only those short of the floor somewhere.
const FLOOR_JS_KINDS = ['global', 'new', 'static', 'member', 'navigator', 'document', 'statement', 'regexp'];
// The names through which a script reads the global object, and the objects whose members have keys of their own.
const FLOOR_JS_GLOBAL_OBJECTS = ['window', 'globalThis', 'self'];
const FLOOR_JS_RECEIVERS = ['navigator', 'document'];
// The operators after which a name is tested, not used: `o.X && …`, and `o.X === undefined` with the word after them.
const FLOOR_JS_TESTS = ['&&', '||', '??', '?'];
const FLOOR_JS_COMPARE = ['===', '!==', '==', '!='];
// A member's name of one plain word: the page's own data as often as the browser's, so its gap is a note to check by hand.
const FLOOR_JS_PLAIN = '~^member:[a-z]+$~';
// The samples the checker proves itself on before it judges: [kind, sample, a text its findings hold, or '' for none].
const FLOOR_FUSES = [
	['css', '.a { field-sizing: content; }', 'property:field-sizing'],
	['css', '@supports (field-sizing: content) { .a { field-sizing: content; } }', ''],
	['css', '.a { colr: red; }', 'property:colr'],
	['css', '.a { user-select: none; }', 'property:user-select'],
	['css', '.a { -webkit-user-select: none; user-select: none; }', ''],
	['css', '.a, ::-webkit-inner-spin-button { block-size: auto; }', 'vendor pseudo-element'],
	['css', '.a { inline-size: 10pxx; }', 'unit:pxx'],
	['css', 'details:open { color: red; }', 'selector:open'],
	['css', '@media (prefers-colour-scheme: dark) { .a { color: red; } }', 'media:prefers-colour-scheme'],
	['css', '.a { position-anchor: normal; }', 'value:position-anchor:normal'],
	['css', '.a { position-anchor: auto; }', ''],
	['css', '.a { color: contrast-color(red); }', 'function:contrast-color'],
	['css', '@media (forced-colors: active) { .a { forced-color-adjust: preserve-parent-color; } }', 'preserve-parent-color'],
	['css', '.a { word-wrap: break-word; }', ''],
	['css', "/* floor-allow selector:open -- styled as closed below the floor */\ndetails:open { color: red; }", ''],
	['css', "details:open { color: red; } /* floor-allow selector:open, property:field-sizing, value:field-sizing:content -- the same line */\n.a { field-sizing: content; }", ''],
	['css', "/* floor-allow selector:open */\ndetails:open { color: red; }", 'needs NAME'],
	['css', "/* floor-allow selector:open -- two lines away */\n\ndetails:open { color: red; }", 'fuse:3  selector:open (css.selectors.open)'],
	['css', "/* floor-allow property:color -- nothing to allow */\n.a { color: red; }", 'allows nothing'],
	['css', ".a { content: \"/* floor-allow selector:open -- in a string */\"; }\ndetails:open { color: red; }", 'selector:open'],
	['html', '<div popover="hint"></div>', 'popover:hint'],
	['html', '<div style="color: red"></div>', 'style='],
	['html', '<button commandfor="d" command="show-modal">Open</button>', ''],
	['html', '<blink>Old</blink>', 'element:blink'],
	['js', "cookieStore.get('a');", 'fuse:1  global:cookieStore (api.Window.cookieStore)'],
	['js', 'Promise.try(() => 1);', 'static:Promise.try (javascript.builtins.Promise.try)'],
	['js', 'list.moveBefore(a, b);', 'member:moveBefore (api.'],
	['js', 'const data = await blob.bytes();', 'a plain word, maybe the page\'s own: check by hand'],
	['js', "const route = new URLPattern({pathname: '/a'});", 'global:URLPattern (api.URLPattern)'],
	['js', 'const registry = new CustomElementRegistry();', 'new:CustomElementRegistry (api.CustomElementRegistry.CustomElementRegistry)'],
	['js', 'const brands = navigator.userAgentData.brands;', 'navigator:userAgentData (api.Navigator.userAgentData)'],
	['js', 'window.scheduler.yield();', 'global:scheduler (api.scheduler)'],
	['js', 'document.startViewTransition(paint);', 'document:startViewTransition (api.Document.startViewTransition)'],
	['js', "import data from './a.json' with {type: 'json'};", 'statement:import.import_attributes.type_json'],
	['js', 'using lock = take();', 'statement:using (javascript.statements.using)'],
	['js', 'const word = /(?i:a)b/;', 'regexp:modifier'],
	['js', "/* floor-allow member:moveBefore */\nlist.moveBefore(a, b);", 'needs NAME'],
	['js', "// floor-allow global:cookieStore -- nothing to allow\nconst a = 1;", 'allows nothing'],
	['js', "/* floor-allow member:moveBefore -- two lines away */\n\nlist.moveBefore(a, b);", 'fuse:3  member:moveBefore'],
	['js', "const s = '// floor-allow member:moveBefore -- in a string';\nlist.moveBefore(a, b);", 'fuse:2  member:moveBefore ('],
	['js', "// floor-allow member:moveBefore -- the page's own list\nlist.moveBefore(a, b);", ''],
	['js', "if ('cookieStore' in window) {\n\tcookieStore.get('a');\n}", ''],
	['js', "if (typeof cookieStore !== 'undefined') {\n\tcookieStore.get('a');\n}", ''],
	['js', "if (typeof list.moveBefore === 'function') {\n\tlist.moveBefore(a, b);\n}", ''],
	['js', "globalThis.cookieStore?.get('a');", ''],
	['js', 'dialog.requestClose?.();', ''],
	['js', "if (list.moveBefore) {\n\tlist.moveBefore(a, b);\n}", ''],
	['js', 'const moved = list.moveBefore ? list.moveBefore(a, b) : null;', ''],
	['js', 'const moved = list.moveBefore && list.moveBefore(a, b);', ''],
	['js', "if ('highlights' in CSS) {\n\tCSS.highlights.set('a', new Highlight(range));\n}", ''],
	['js', "const cookieStore = {get: () => 1};\ncookieStore.get('a');", ''],
	['js', "const {cookieStore} = settings;\ncookieStore.get('a');", ''],
	['js', 'const flags = {cookieStore: 1, moveBefore: 2};', ''],
	['js', "const pick = {items, take};\npick.take(items[0]);", ''],
	['js', "const rows = {moveBefore(a, b) {}};\nrows.moveBefore(a, b);", ''],
	['js', "class Rows {\n\tsize = 0;\n\tmoveBefore = null;\n}\nnew Rows().moveBefore(a, b);", ''],
	['js', 'const last = rows.at(-1) ?? map.has(key) ?? rows.find(match);', ''],
	['js', 'const where = row.dataset.move;', ''],
	['js', "list.addEventListener('scrollend', paint);", ''],
	['js', 'const share = /(?:a)b/g.test(text) ? total / count / 2 : 0;', ''],
	['js', "import {using} from './a.js';\nusing(1);", ''],
	['js', 'const names = agent.brands.map((one) => one.brand);', ''],
	['js', "if (a) {}\n/b/.test(c);", 'fuse:2  the script cannot be read'],
];
/** The fuses: FLOOR_FUSES and one built by sprintf, so that no literal holds markup an editor checks as HTML. */
function FLOOR__Fuses(): array
{
	return [...FLOOR_FUSES, ['html', sprintf('<%1$s %2$s="tip">Info</%1$s>', 'button', 'interestfor'), 'attribute:button:interestfor']];
}

const FLOOR_VENDOR = '~^(-[a-z]+-)(.+)$~';
const FLOOR_ALLOW_COMMENT = '~^floor-allow\b~';
const FLOOR_USAGE = "usage: php floor.php check [--allow=FILE] [--json] FILE…\n";
// The byte classes of the C locale, read without the ctype extension.
const FLOOR_SPACE = " \t\n\r\x0B\x0C";
const FLOOR_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const FLOOR_ALNUM = FLOOR_LETTERS . '0123456789';

/** Whether $s has bytes and every one is of $set, as the ctype functions read them in the C locale. */
function FLOOR__Bytes(string $s, string $set): bool
{
	return $s !== '' && strspn($s, $set) === strlen($s);
}

/** The UTF-8 bytes of code point $cp, '' for a surrogate or one past U+10FFFF, as mb_chr gives them. */
function FLOOR__Utf8(int $cp): string
{
	return match (true) {
		$cp < 0x80 => chr($cp),
		$cp < 0x800 => chr(0xC0 | $cp >> 6) . chr(0x80 | $cp & 0x3F),
		($cp >= 0xD800 && $cp <= 0xDFFF) || $cp > 0x10FFFF => '',
		$cp < 0x10000 => chr(0xE0 | $cp >> 12) . chr(0x80 | $cp >> 6 & 0x3F) . chr(0x80 | $cp & 0x3F),
		default => chr(0xF0 | $cp >> 18) . chr(0x80 | $cp >> 12 & 0x3F) . chr(0x80 | $cp >> 6 & 0x3F) . chr(0x80 | $cp & 0x3F),
	};
}

/**
 * The table of floor.json's text: the floor, the BCD version, each name's key, web-features and verdicts - by browser,
 * where it falls short, and the browsers that take each vendor form -, the web-features of each word a script's name
 * ends with, and the release's exceptions.
 * @return array{floor: array<string, string>, bcd: array<string, string>, names: array<string, array{key: string, features: list<string>, verdicts: array<string, string>, prefixes: array<string, array<string, true>>}>, words: array<string, array<string, true>>, allow: list<array<string, mixed>>}
 * @throws JsonException when the text is not JSON
 * @throws RuntimeException when it is not floor.json's shape
 */
function FLOOR__Table(string $json): array
{
	$list = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
	if (!is_array($list) || !is_array($list['floor'] ?? null) || !is_array($list['bcd'] ?? null) || !is_array($list['names'] ?? null) || !array_is_list($list['allow'] ?? null)) {
		throw new RuntimeException('floor.json has no floor, bcd, names or allow');
	}
	foreach (FLOOR_BROWSERS as $browser) {
		if (!is_string($list['floor'][$browser] ?? null)) {
			throw new RuntimeException('floor.json has no floor version for ' . $browser);
		}
	}
	$names = [];
	foreach ($list['names'] as $name => $info) {
		$entry = ['key' => '', 'features' => [], 'verdicts' => [], 'prefixes' => []];
		foreach ($info === 'ok' ? [] : (is_array($info) ? $info : throw new RuntimeException('floor.json: a name it cannot read: ' . $name)) as $field => $value) {
			match (true) {
				$field === 'key' && is_string($value) => $entry['key'] = $value,
				$field === 'features' && is_array($value) && array_is_list($value) && array_all($value, fn(mixed $one): bool => is_string($one)) => $entry['features'] = $value,
				in_array($field, FLOOR_BROWSERS, true) && is_string($value) => $entry['verdicts'][$field] = $value,
				preg_match('~^-?[a-z]+(?:-[a-z]+)*-?$~', (string)$field) === 1 && is_array($value) => $entry['prefixes'][$field] = array_fill_keys($value, true),
				default => throw new RuntimeException('floor.json: a field it cannot read in ' . $name . ': ' . $field),
			};
		}
		$names[(string)$name] = $entry;
	}
	foreach ($list['allow'] as $entry) {
		if (!is_string($entry['reason'] ?? null) || !in_array($entry['scope'] ?? null, FLOOR_SCOPES, true) || !(is_string($entry['name'] ?? null) xor is_array($entry['names'] ?? null))) {
			throw new RuntimeException('floor.json: an exception it cannot read: ' . json_encode($entry));
		}
	}
	$words = [];
	foreach ($names as $name => $entry) {
		foreach ($entry['features'] as $feature) {
			$words[(string)preg_replace('~^.*[:.]~', '', $name)][$feature] = true;
		}
	}
	return ['floor' => $list['floor'], 'bcd' => $list['bcd'], 'names' => $names, 'words' => $words, 'allow' => $list['allow']];
}

/** The verdict of $name in $browser at the floor: 'full', 'partial', 'none' or 'unknown'; with $prefix, whether that
 *  vendor form has full support, 'full' or 'none'. */
function FLOOR__NameVerdict(array $data, string $name, string $browser, string $prefix = ''): string
{
	$entry = $data['names'][$name] ?? null;
	if ($entry === null) {
		return 'unknown';
	}
	if ($prefix !== '') {
		return isset($entry['prefixes'][$prefix][$browser]) ? 'full' : 'none';
	}
	$verdict = $entry['verdicts'][$browser] ?? 'full';
	return str_starts_with($verdict, 'none') ? 'none' : $verdict;
}

/** The browsers of $live in which every one of $names has full support (with $prefix for the first one). */
function FLOOR__SupportedIn(array $data, array $live, array $names, string $prefix = ''): array
{
	return array_values(array_filter($live, fn(string $browser): bool => array_all($names, fn(string $name, int $k): bool => FLOOR__NameVerdict($data, $name, $browser, $k === 0 ? $prefix : '') === 'full')));
}

/** The release's exceptions of $scopes, by their id `release#K`, K their place in floor.json. */
function FLOOR__ReleaseAllow(array $data, array $scopes): array
{
	$allow = [];
	foreach ($data['allow'] as $k => $entry) {
		if (in_array($entry['scope'], $scopes, true)) {
			$allow['release#' . $k] = $entry;
		}
	}
	return $allow;
}

/**
 * The exceptions of an allow file, by their id `file#K`: {"allow": [{"name", "browsers"?, "reason"}]}.
 * @throws JsonException when the file is not JSON
 * @throws RuntimeException when it cannot be read or an exception lacks its name or reason
 */
function FLOOR__AllowFile(string $path): array
{
	$list = json_decode(FLOOR__Read($path), true, 512, JSON_THROW_ON_ERROR);
	if (!is_array($list) || !array_is_list($list['allow'] ?? null)) {
		throw new RuntimeException($path . ' has no list allow');
	}
	$allow = [];
	foreach ($list['allow'] as $k => $entry) {
		$browsers = $entry['browsers'] ?? null;
		if (!is_array($entry) || !is_string($entry['name'] ?? null) || preg_match('~^\S+$~', $entry['name']) !== 1 || trim((string)($entry['reason'] ?? '')) === '' || ($browsers !== null && (!array_is_list($browsers) || $browsers === [] || array_diff($browsers, FLOOR_BROWSERS) !== []))) {
			throw new RuntimeException($path . ': an exception needs a name, a reason and maybe browsers of ' . implode(', ', FLOOR_BROWSERS) . ': ' . json_encode($entry));
		}
		$allow['file#' . $k] = ['name' => $entry['name'], 'reason' => $entry['reason'], 'file' => $path] + ($browsers === null ? [] : ['browsers' => $browsers]);
	}
	return $allow;
}

/** The text of $path, or a refusal that names it. */
function FLOOR__Read(string $path): string
{
	$text = is_file($path) && is_readable($path) ? file_get_contents($path) : false;
	if ($text === false) {
		throw new RuntimeException('cannot read ' . $path);
	}
	return $text;
}

/**
 * The floor-allow comments of a stylesheet as exceptions, by their id `inline:FILE:LINE:K`, each covering its name from
 * the comment's first line to the line after its last; a comment that starts with floor-allow in another form is a
 * finding in $findings.
 */
function FLOOR__CssAllowComments(string $css, string $file, array &$findings): array
{
	$allow = [];
	$n = strlen($css);
	$i = 0;
	$line = 1;
	while ($i < $n) {
		$c = $css[$i];
		if ($c === '/' && ($css[$i + 1] ?? '') === '*') {
			$end = strpos($css, '*/', $i + 2);
			$end = $end === false ? $n : $end + 2;
			$body = substr($css, $i + 2, max(0, $end - $i - 4));
			$last = $line + substr_count($css, "\n", $i, $end - $i);
			FLOOR__AllowCommentParse(trim($body), $file, $line, $last, $allow, $findings);
			$line = $last;
			$i = $end;
			continue;
		}
		if (($c === 'u' || $c === 'U') && preg_match('~\Gurl\(\s*[^"\'()\s]*\s*\)~i', $css, $m, 0, $i) === 1) {
			$i += strlen($m[0]);
			continue;
		}
		if ($c === '"' || $c === "'") {
			$i++;
			while ($i < $n && $css[$i] !== $c && $css[$i] !== "\n") {
				$line += $css[$i] === '\\' && ($css[$i + 1] ?? '') === "\n" ? 1 : 0;
				$i += $css[$i] === '\\' ? 2 : 1;
			}
			$i++;
			continue;
		}
		$line += $c === "\n" ? 1 : 0;
		$i++;
	}
	return $allow;
}

/** One comment's text on lines $line to $last: a floor-allow adds its names to $allow, covering them to the line after
 *  $last, and one in another form is a finding. */
function FLOOR__AllowCommentParse(string $body, string $file, int $line, int $last, array &$allow, array &$findings): void
{
	if (preg_match(FLOOR_ALLOW_COMMENT, $body) !== 1) {
		return;
	}
	if (preg_match('~^floor-allow\s+(\S.*?)\s+--\s+(\S.*)$~s', $body, $m) !== 1) {
		$findings[] = FLOOR__Finding($file, $line, '', 'a floor-allow needs NAME[, NAME…] -- reason');
		return;
	}
	foreach (array_map('trim', explode(',', $m[1])) as $k => $name) {
		$allow['inline:' . $file . ':' . $line . ':' . $k] = ['name' => $name, 'reason' => $m[2], 'file' => $file, 'line' => $line, 'lines' => [$line, $last + 1]];
	}
}

/** Whether an exception of $allow allows $name in $browser at $line ('' for a check of no browser) - a name exception
 *  by its name, its browsers and its lines, a key exception by the names under its key, only for a browser -; marks it in $used. */
function FLOOR__Allowed(array $allow, string $name, string $browser, int $line, array &$used): bool
{
	foreach ($allow as $id => $entry) {
		$browsers = $entry['browsers'] ?? null;
		$hit = isset($entry['name'])
			? $entry['name'] === $name && ($browsers === null || in_array($browser, $browsers, true)) && (!isset($entry['lines']) || ($line >= $entry['lines'][0] && $line <= $entry['lines'][1]))
			: $browser !== '' && in_array($name, $entry['names'], true) && ($browsers === null || in_array($browser, $browsers, true));
		if ($hit) {
			$used[$id] = true;
			return true;
		}
	}
	return false;
}

/** One finding: where, the name it is about, its BCD key and verdicts by browser when it falls short, its text, and
 *  whether it is only a note to check by hand. */
function FLOOR__Finding(string $file, int $line, string $name, string $text, string $key = '', array $browsers = [], bool $hand = false): array
{
	return ['file' => $file, 'line' => $line, 'name' => $name, 'key' => $key, 'browsers' => $browsers, 'text' => $text, 'hand' => $hand];
}

/** A finding as its line: FILE:LINE  TEXT. */
function FLOOR__FindingLine(array $finding): string
{
	return $finding['file'] . ($finding['line'] > 0 ? ':' . $finding['line'] : '') . '  ' . $finding['text'];
}

/** The tokens of a stylesheet by CSS Syntax 3: [type, value, line] and the unit of a dimension. */
function FLOOR__CssTokens(string $css): array
{
	$tokens = [];
	$n = strlen($css);
	$i = 0;
	$line = 1;
	while ($i < $n) {
		$c = $css[$i];
		$at = $line;
		if ($c === '/' && ($css[$i + 1] ?? '') === '*') {
			$end = strpos($css, '*/', $i + 2);
			$end = $end === false ? $n : $end + 2;
			$line += substr_count($css, "\n", $i, $end - $i);
			$i = $end;
			continue;
		}
		if (FLOOR__Bytes($c, FLOOR_SPACE)) {
			$start = $i;
			while ($i < $n && FLOOR__Bytes($css[$i], FLOOR_SPACE)) {
				$i++;
			}
			$line += substr_count($css, "\n", $start, $i - $start);
			$tokens[] = ['ws', ' ', $at];
			continue;
		}
		if ($c === '"' || $c === "'") {
			$i++;
			$value = '';
			while ($i < $n && $css[$i] !== $c && $css[$i] !== "\n") {
				if ($css[$i] === '\\' && $i + 1 < $n) {
					$line += $css[$i + 1] === "\n" ? 1 : 0;
					$value .= $css[$i + 1];
					$i += 2;
					continue;
				}
				$value .= $css[$i++];
			}
			$i++;
			$tokens[] = ['string', $value, $at];
			continue;
		}
		if (preg_match('~\G[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?~', $css, $m, 0, $i) === 1) {
			$i += strlen($m[0]);
			if (($css[$i] ?? '') === '%') {
				$i++;
				$tokens[] = ['percentage', $m[0], $at];
			} elseif (FLOOR__CssNameStarts($css, $i)) {
				$tokens[] = ['dimension', $m[0], $at, strtolower(FLOOR__CssName($css, $i))];
			} else {
				$tokens[] = ['number', $m[0], $at];
			}
			continue;
		}
		if ($c === '#' && FLOOR__CssNameChar($css, $i + 1)) {
			$i++;
			$tokens[] = ['hash', FLOOR__CssName($css, $i), $at];
			continue;
		}
		if ($c === '@' && FLOOR__CssNameStarts($css, $i + 1)) {
			$i++;
			$tokens[] = ['at', strtolower(FLOOR__CssName($css, $i)), $at];
			continue;
		}
		if (FLOOR__CssNameStarts($css, $i)) {
			$name = FLOOR__CssName($css, $i);
			if (($css[$i] ?? '') !== '(') {
				$tokens[] = ['ident', $name, $at];
				continue;
			}
			$i++;
			if (strtolower($name) === 'url' && preg_match('~\G\s*([^"\'()\s]*)\s*\)~', $css, $m, 0, $i) === 1) {
				$i += strlen($m[0]);
				$tokens[] = ['url', $m[1], $at];
				continue;
			}
			$tokens[] = ['function', strtolower($name), $at];
			continue;
		}
		$i++;
		$tokens[] = [str_contains(':;,{}()[]', $c) ? $c : 'delim', $c, $at];
	}
	return $tokens;
}

/** Whether a CSS name starts at $i: a letter, `_`, non-ASCII, an escape, or `-` before one of those or `-`. */
function FLOOR__CssNameStarts(string $css, int $i): bool
{
	$c = $css[$i] ?? '';
	if ($c === '-') {
		$next = $css[$i + 1] ?? '';
		return $next === '-' || ($next !== '' && (FLOOR__Bytes($next, FLOOR_LETTERS) || $next === '_' || ord($next) >= 0x80 || $next === '\\'));
	}
	return $c !== '' && (FLOOR__Bytes($c, FLOOR_LETTERS) || $c === '_' || ord($c) >= 0x80 || $c === '\\');
}

/** Whether the byte at $i continues a CSS name. */
function FLOOR__CssNameChar(string $css, int $i): bool
{
	$c = $css[$i] ?? '';
	return $c !== '' && (FLOOR__Bytes($c, FLOOR_ALNUM) || $c === '-' || $c === '_' || ord($c) >= 0x80 || $c === '\\');
}

/** The CSS name at $i with its escapes decoded; moves $i past it. */
function FLOOR__CssName(string $css, int &$i): string
{
	$name = '';
	while (FLOOR__CssNameChar($css, $i)) {
		if ($css[$i] !== '\\') {
			$name .= $css[$i++];
			continue;
		}
		if (preg_match('~\G\\\\([0-9a-fA-F]{1,6})\s?~', $css, $m, 0, $i) === 1) {
			$name .= FLOOR__Utf8((int)hexdec($m[1]));
			$i += strlen($m[0]);
			continue;
		}
		$name .= $css[$i + 1] ?? '';
		$i += 2;
	}
	return $name;
}

/** The tokens from $i up to the first of $stops outside brackets; moves $i onto the stop. */
function FLOOR__CssUntil(array $tokens, int &$i, array $stops): array
{
	$part = [];
	$depth = 0;
	for ($n = count($tokens); $i < $n; $i++) {
		$type = $tokens[$i][0];
		if ($depth === 0 && in_array($type, $stops, true)) {
			break;
		}
		if (in_array($type, ['(', '[', '{', 'function'], true)) {
			$depth++;
		} elseif (in_array($type, [')', ']', '}'], true)) {
			$depth--;
		}
		$part[] = $tokens[$i];
	}
	return $part;
}

/** The facts of a stylesheet: each feature it uses, its line and the browsers in which its block applies. */
function FLOOR__CssFacts(string $css, array $data): array
{
	$tokens = FLOOR__CssTokens($css);
	$facts = [];
	$i = 0;
	FLOOR__CssBlock($tokens, $i, FLOOR_BROWSERS, 'rules', '', $data, $facts);
	return $facts;
}

/** Reads a block of rules, keyframes, declarations or the descriptors of at-rule $owner into $facts; stops on its `}`. */
function FLOOR__CssBlock(array $tokens, int &$i, array $live, string $kind, string $owner, array $data, array &$facts): void
{
	$declarations = [];
	for ($n = count($tokens); $i < $n; $i++) {
		$token = $tokens[$i];
		if ($token[0] === '}') {
			break;
		}
		if ($token[0] === 'ws' || $token[0] === ';') {
			continue;
		}
		if ($token[0] === 'at') {
			$i++;
			$prelude = FLOOR__CssUntil($tokens, $i, ['{', ';']);
			$inner = FLOOR__CssAtRule($token[1], $prelude, $token[2], $live, $data, $facts);
			if (($tokens[$i][0] ?? '') === '{') {
				$i++;
				$innerKind = match (true) {
					in_array($token[1], FLOOR_RULE_AT_RULES, true) => $kind === 'declarations' ? 'declarations' : 'rules',
					$token[1] === 'keyframes' => 'keyframes',
					default => 'descriptors',
				};
				FLOOR__CssBlock($tokens, $i, $inner, $innerKind, $token[1], $data, $facts);
			}
			continue;
		}
		$line = $token[2];
		$head = FLOOR__CssUntil($tokens, $i, ['{', ';', '}']);
		if (($tokens[$i][0] ?? '') !== '{') {
			if ($kind !== 'rules' && $kind !== 'keyframes') {
				$declarations[] = [$head, $line];
			}
			$i -= ($tokens[$i][0] ?? '') === '}' ? 1 : 0;
			continue;
		}
		if ($kind !== 'keyframes') {
			FLOOR__SelectorFacts($facts, $head, $line, $live);
		}
		$i++;
		FLOOR__CssBlock($tokens, $i, $live, 'declarations', '', $data, $facts);
	}
	FLOOR__CssDeclarations($facts, $declarations, $live, $kind === 'descriptors' ? $owner : '', $data);
}

/** Adds the fact $name at $line for the $live browsers; $prefix is the vendor prefix a declaration wrote; the prefixes
 *  of $covered, written beside it, cover a browser that takes name $cover (the fact's own when '') with one of them. */
function FLOOR__Fact(array &$facts, string $name, int $line, array $live, string $prefix = '', array $covered = [], string $cover = ''): void
{
	if ($live !== []) {
		$facts[] = ['name' => $name, 'line' => $line, 'live' => $live, 'prefix' => $prefix, 'covered' => $covered, 'cover' => $cover === '' ? $name : $cover];
	}
}

/** Facts of a rule's selector list; a vendor pseudo-element beside other selectors drops the rule where it is unknown. */
function FLOOR__SelectorFacts(array &$facts, array $head, int $line, array $live): void
{
	$parts = [[]];
	foreach ($head as $token) {
		if ($token[0] === ',') {
			$parts[] = [];
			continue;
		}
		$parts[count($parts) - 1][] = $token;
	}
	$vendor = 0;
	foreach ($parts as $part) {
		$names = FLOOR__SelectorNames($part);
		$vendor += count(array_filter($names, fn(string $name): bool => str_starts_with($name, 'selector:-'))) > 0 ? 1 : 0;
	}
	if ($vendor > 0 && $vendor < count($parts)) {
		FLOOR__Fact($facts, 'mixed:vendor-list', $line, $live);
	}
	foreach (FLOOR__SelectorNames($head) as $name) {
		FLOOR__Fact($facts, $name, $line, $live);
	}
}

/** The selector names of a selector list: pseudo-classes and pseudo-elements, combinators and simple selectors. */
function FLOOR__SelectorNames(array $tokens): array
{
	$names = [];
	$count = count($tokens);
	$compound = false;
	for ($i = 0; $i < $count; $i++) {
		[$type, $value] = $tokens[$i];
		if ($type === ',') {
			$names[] = 'selector:list';
			$compound = false;
			continue;
		}
		if ($type === 'ws') {
			$prev = $tokens[$i - 1][1] ?? ',';
			$next = $tokens[$i + 1][1] ?? ',';
			if ($compound && $i + 1 < $count && !in_array($next, [',', '>', '+', '~', ')', '{'], true) && !in_array($prev, [',', '>', '+', '~', '('], true)) {
				$names[] = 'selector:descendant';
			}
			continue;
		}
		if ($type === 'delim' && isset(FLOOR_COMBINATORS[$value])) {
			$names[] = 'selector:' . FLOOR_COMBINATORS[$value];
			$compound = $value === '*' || $value === '&';
			continue;
		}
		$compound = true;
		if ($type === 'delim' && $value === '.') {
			$names[] = 'selector:class';
			$i++;
			continue;
		}
		if ($type === 'hash') {
			$names[] = 'selector:id';
			continue;
		}
		if ($type === 'ident') {
			$names[] = 'selector:type';
			continue;
		}
		if ($type === '[') {
			$names[] = 'selector:attribute';
			$i++;
			FLOOR__CssUntil($tokens, $i, [']']);
			continue;
		}
		if ($type !== ':') {
			continue;
		}
		$i += ($tokens[$i + 1][0] ?? '') === ':' ? 2 : 1;
		[$what, $pseudo] = $tokens[$i] ?? ['', ''];
		$pseudo = strtolower((string)$pseudo);
		$names[] = 'selector:' . $pseudo;
		if ($what !== 'function') {
			continue;
		}
		$i++;
		$argument = FLOOR__CssUntil($tokens, $i, [')']);
		if (in_array($pseudo, FLOOR_SELECTOR_ARGUMENTS, true)) {
			$names = [...$names, ...FLOOR__SelectorNames($argument)];
			if ($pseudo === 'not' && in_array(',', array_column($argument, 0), true)) {
				$names[] = 'selector:not.selector_list';
			}
		} elseif (str_starts_with($pseudo, 'nth-')) {
			$words = array_map(fn($v): string => strtolower((string)$v), array_column($argument, 1));
			if (in_array('of', $words, true)) {
				$names[] = 'selector:' . $pseudo . '.of_syntax';
			}
		}
	}
	return array_values(array_unique($names));
}

/** Reads an at-rule's prelude into $facts; returns the browsers in which its block applies. */
function FLOOR__CssAtRule(string $name, array $prelude, int $line, array $live, array $data, array &$facts): array
{
	FLOOR__Fact($facts, 'at-rule:' . $name, $line, $live);
	$supported = FLOOR__SupportedIn($data, $live, ['at-rule:' . $name]);
	$words = array_map(fn(array $t): string => strtolower((string)$t[1]), $prelude);
	if ($name === 'media') {
		foreach (FLOOR__MediaFeatures($prelude) as $feature) {
			if (!isset($data['names']['media:' . $feature])) {
				FLOOR__Fact($facts, 'media:' . $feature, $line, $live);
			}
			$supported = FLOOR__SupportedIn($data, $supported, ['media:' . $feature]);
		}
		if (array_intersect(FLOOR_RANGE, $words) !== []) {
			FLOOR__Fact($facts, 'media:range_syntax', $line, $live);
		}
		if (in_array('or', $words, true)) {
			FLOOR__Fact($facts, 'media:or_syntax', $line, $live);
		}
	} elseif ($name === 'container') {
		$functions = array_filter($prelude, fn(array $t): bool => $t[0] === 'function');
		if (in_array('style', array_column($functions, 1), true)) {
			FLOOR__Fact($facts, 'container:style_queries_for_custom_properties', $line, $live);
		}
	} elseif ($name === 'supports') {
		$at = 0;
		$holds = FLOOR__SupportsTrue($prelude, $at, $data);
		$supported = array_values(array_intersect($supported, $holds));
	} elseif ($name === 'import') {
		if (in_array('layer', $words, true)) {
			FLOOR__Fact($facts, 'import:layer', $line, $live);
		}
		if (in_array('supports', $words, true)) {
			FLOOR__Fact($facts, 'import:supports', $line, $live);
		}
	}
	return $supported;
}

/** The media features a media query names: in `(feature: value)`, `(feature)` and the range forms, min- / max- dropped. */
function FLOOR__MediaFeatures(array $prelude): array
{
	$features = [];
	$depth = 0;
	$solid = array_values(array_filter($prelude, fn(array $t): bool => $t[0] !== 'ws'));
	foreach ($solid as $k => [$type, $value]) {
		$depth += $type === '(' ? 1 : ($type === ')' ? -1 : 0);
		if ($depth === 0 || $type !== 'ident') {
			continue;
		}
		$prev = $solid[$k - 1] ?? ['', ''];
		$next = $solid[$k + 1] ?? ['', ''];
		if ($prev[0] === ':') {
			continue;
		}
		$range = fn(array $t): bool => $t[0] === 'delim' && in_array($t[1], FLOOR_RANGE, true);
		if ($next[0] === ':' || ($next[0] === ')' && $prev[0] === '(') || $range($next) || $range($prev)) {
			$features[] = (string)preg_replace('~^(min-|max-)~', '', strtolower((string)$value));
		}
	}
	return array_values(array_unique($features));
}

/** The browsers in which a @supports condition holds: `not`, `and`, `or`, `(property: value)`, `selector()`. */
function FLOOR__SupportsTrue(array $tokens, int &$i, array $data): array
{
	$result = null;
	$join = 'and';
	$negate = false;
	for ($n = count($tokens); $i < $n; $i++) {
		[$type, $value] = $tokens[$i];
		$word = strtolower((string)$value);
		if ($type === ')') {
			break;
		}
		if ($type === 'ident' && ($word === 'and' || $word === 'or')) {
			$join = $word;
			continue;
		}
		if ($type === 'ident' && $word === 'not') {
			$negate = true;
			continue;
		}
		if ($type === '(') {
			$i++;
			$probe = $i;
			$inner = FLOOR__CssUntil($tokens, $probe, [')']);
			if (in_array(':', array_column($inner, 0), true) && !in_array('(', array_column($inner, 0), true)) {
				$set = FLOOR__SupportsDeclaration($inner, $data);
				$i = $probe;
			} else {
				$set = FLOOR__SupportsTrue($tokens, $i, $data);
			}
		} elseif ($type === 'function' && $word === 'selector') {
			$i++;
			$set = FLOOR__SupportedIn($data, FLOOR_BROWSERS, ['supports:selector', ...FLOOR__SelectorNames(FLOOR__CssUntil($tokens, $i, [')']))]);
		} else {
			continue;
		}
		if ($negate) {
			$set = array_values(array_diff(FLOOR_BROWSERS, $set));
			$negate = false;
		}
		$result = $result === null ? $set : array_values($join === 'or' ? array_unique([...$result, ...$set]) : array_intersect($result, $set));
	}
	return $result ?? FLOOR_BROWSERS;
}

/** The browsers that support every feature of a `property: value` condition of @supports. */
function FLOOR__SupportsDeclaration(array $tokens, array $data): array
{
	$facts = [];
	FLOOR__CssDeclarations($facts, [[$tokens, 0]], FLOOR_BROWSERS, '', $data);
	$set = FLOOR_BROWSERS;
	foreach ($facts as $fact) {
		$set = FLOOR__SupportedIn($data, $set, [$fact['name']], $fact['prefix']);
	}
	return $set;
}

/** Facts of a block's declarations, or of the descriptors of at-rule $owner; a prefixed sibling covers its property. */
function FLOOR__CssDeclarations(array &$facts, array $declarations, array $live, string $owner, array $data): void
{
	$parsed = [];
	$prefixed = [];
	foreach ($declarations as [$tokens, $line]) {
		$colon = array_search(':', array_column($tokens, 0), true);
		if ($colon === false) {
			continue;
		}
		$head = array_column(array_slice($tokens, 0, $colon), 1);
		$property = trim(implode('', $head));
		$property = strtolower($property);
		$parsed[] = [$property, array_slice($tokens, $colon + 1), $line];
		if (preg_match(FLOOR_VENDOR, $property, $m) === 1) {
			$prefixed[$m[2]][] = $m[1];
		}
	}
	foreach ($parsed as [$property, $value, $line]) {
		if ($owner !== '') {
			FLOOR__Fact($facts, 'descriptor:' . $owner . ':' . $property, $line, $live);
			continue;
		}
		$prefix = '';
		$base = str_starts_with($property, '--') ? '--*' : $property;
		if ($base !== '--*' && preg_match(FLOOR_VENDOR, $property, $m) === 1 && !isset($data['names']['property:' . $property])) {
			[$prefix, $base] = [$m[1], $m[2]];
		}
		$covered = $prefix === '' ? $prefixed[$base] ?? [] : [];
		FLOOR__Fact($facts, 'property:' . $base, $line, $live, $prefix, $covered);
		FLOOR__ValueFacts($facts, $base, $property[0] === '-' && $base !== '--*', $value, $line, $live, $data, $covered);
	}
}

/** Facts of a declaration's value: the keywords of its property, functions, units and hex colors; the keywords are
 *  covered with the property by its prefixed siblings. */
function FLOOR__ValueFacts(array &$facts, string $property, bool $vendor, array $value, int $line, array $live, array $data, array $covered = []): void
{
	foreach ($value as $k => $token) {
		[$type, $text] = $token;
		$word = strtolower((string)$text);
		if ($type === 'ident') {
			if ($vendor || $property === '--*' || ($word === 'important' && ($value[$k - 1][1] ?? '') === '!')) {
				continue;
			}
			if (in_array($property, FLOOR_LIST_PROPERTIES, true) && isset($data['names']['property:' . $word])) {
				continue;
			}
			$name = isset($data['names']['value:' . $property . ':' . $word]) ? 'value:' . $property . ':' . $word : 'keyword:' . $word;
			if (isset($data['names'][$name])) {
				FLOOR__Fact($facts, $name, $line, $live, '', str_starts_with($name, 'value:') ? $covered : [], 'property:' . $property);
			} elseif (in_array($word, FLOOR_SYSTEM_COLORS, true)) {
				FLOOR__Fact($facts, 'keyword:system-color', $line, $live);
			}
			continue;
		}
		if ($type === 'function') {
			FLOOR__Fact($facts, FLOOR__FunctionName($data, $property, $word), $line, $live);
		} elseif ($type === 'url') {
			FLOOR__Fact($facts, 'function:url', $line, $live);
		} elseif ($type === 'dimension') {
			FLOOR__Fact($facts, 'unit:' . $token[3], $line, $live);
		} elseif ($type === 'hash') {
			FLOOR__Fact($facts, in_array(strlen((string)$text), [4, 8], true) ? 'hash:alpha' : 'hash:rgb', $line, $live);
		}
	}
}

/** The name of function $word in a value of $property: the property's own, a global one, or another property's. */
function FLOOR__FunctionName(array $data, string $property, string $word): string
{
	$word = FLOOR_FUNCTION_ALIASES[$word] ?? $word;
	if (isset($data['names']['function:' . $property . ':' . $word])) {
		return 'function:' . $property . ':' . $word;
	}
	if (isset($data['names']['function:' . $word])) {
		return 'function:' . $word;
	}
	foreach (array_keys($data['names']) as $known) {
		if (str_starts_with($known, 'function:') && str_ends_with($known, ':' . $word)) {
			return $known;
		}
	}
	return 'function:' . $word;
}

/** The facts of an HTML page: elements, the attributes and values BCD knows (it omits basic ones such as an input's
 *  value), inline CSS and handlers as unchecked. */
function FLOOR__HtmlFacts(string $html, array $data): array
{
	$facts = [];
	$html = (string)preg_replace_callback('~<!--.*?-->~s', fn(array $m): string => str_repeat("\n", substr_count($m[0], "\n")), $html);
	$tag = '~<([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s"\'>/=]+(?:\s*=\s*(?:"[^"]*"|\'[^\']*\'|[^\s"\'=<>`]+))?)*)\s*/?>~';
	$at = 0;
	while (preg_match($tag, $html, $m, PREG_OFFSET_CAPTURE, $at) === 1) {
		$element = strtolower($m[1][0]);
		$line = substr_count($html, "\n", 0, $m[0][1]) + 1;
		$at = $m[0][1] + strlen($m[0][0]);
		FLOOR__Fact($facts, in_array($element, ['style', 'svg', 'math'], true) ? 'unchecked:<' . $element . '>' : 'element:' . $element, $line, FLOOR_BROWSERS);
		preg_match_all('~([^\s"\'>/=]+)(?:\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|([^\s"\'=<>`]+)))?~', $m[2][0], $attributes, PREG_SET_ORDER);
		foreach ($attributes as $a) {
			$name = strtolower($a[1]);
			$value = strtolower(($a[2] ?? '') . ($a[3] ?? '') . ($a[4] ?? ''));
			if ($name === 'role' || str_starts_with($name, 'aria-') || str_starts_with($name, 'data-')) {
				continue;
			}
			if ($name === 'style' || str_starts_with($name, 'on')) {
				FLOOR__Fact($facts, 'unchecked:' . $name . '=', $line, FLOOR_BROWSERS);
				continue;
			}
			foreach (['attribute:' . $element . ':' . $name, 'attribute:*:' . $name] as $known) {
				if (isset($data['names'][$known])) {
					FLOOR__Fact($facts, $known, $line, FLOOR_BROWSERS);
					break;
				}
			}
			foreach (['attr-value:' . $element . ':' . $name . ':' . $value, 'attr-value:*:' . $name . ':' . $value] as $known) {
				if ($value !== '' && isset($data['names'][$known])) {
					FLOOR__Fact($facts, $known, $line, FLOOR_BROWSERS);
					break;
				}
			}
		}
		if (in_array($element, ['script', 'style', 'svg', 'math', 'textarea', 'title'], true)) {
			$close = stripos($html, '</' . $element, $at);
			$at = $close === false ? strlen($html) : $close;
		}
	}
	return $facts;
}

/** Whether $name is a script's, of a kind of FLOOR_JS_KINDS. */
function FLOOR__NameIsJs(string $name): bool
{
	return in_array(strstr($name, ':', true), FLOOR_JS_KINDS, true);
}

/**
 * The tokens of a script as min.php's reader gives them, each [kind, text, byte, line], and its comments - what lies
 * between two tokens beside white space -, each [text, line, last line].
 * @return array{list<array{string, string, int, int}>, list<array{string, int, int}>}
 * @throws RuntimeException where the reader stops, its code the byte
 */
function FLOOR__JsTokens(string $js): array
{
	$js = str_starts_with($js, "\xEF\xBB\xBF") ? '   ' . substr($js, 3) : $js;
	$tokens = [];
	$comments = [];
	$line = 1;
	$at = 0;
	foreach ([...MIN__JsLex($js), ['end', '', strlen($js)]] as [$kind, $text, $byte]) {
		$gap = substr($js, $at, $byte - $at);
		$from = 0;
		while (preg_match('~\G\s*(//[^\n]*|/\*.*?\*/)~s', $gap, $m, PREG_OFFSET_CAPTURE, $from) === 1) {
			$first = $line + substr_count(substr($gap, 0, $m[1][1]), "\n");
			$comments[] = [$m[1][0], $first, $first + substr_count($m[1][0], "\n")];
			$from = $m[0][1] + strlen($m[0][0]);
		}
		$line += substr_count($gap, "\n");
		if ($kind !== 'end') {
			$tokens[] = [$kind, $text, $byte, $line];
			$line += substr_count($text, "\n");
		}
		$at = $byte + strlen($text);
	}
	return [$tokens, $comments];
}

/** The floor-allow comments of a script, block and line comments, as FLOOR__CssAllowComments reads a stylesheet's. */
function FLOOR__JsAllowComments(array $comments, string $file, array &$findings): array
{
	$allow = [];
	foreach ($comments as [$text, $line, $last]) {
		FLOOR__AllowCommentParse(trim(str_starts_with($text, '//') ? substr($text, 2) : substr($text, 2, -2)), $file, $line, $last, $allow, $findings);
	}
	return $allow;
}

/** For each bracket of a script's tokens - `(`, `[`, `{` and a template's `${` - its partner, both ways, and for each
 *  token the index of the open bracket it stands in, -1 at the top. */
function FLOOR__JsBrackets(array $tokens): array
{
	$match = [];
	$within = [];
	$open = [];
	foreach ($tokens as $t => [$kind, $text]) {
		if ((($kind === 'punctuator' && in_array($text, [')', ']', '}'], true)) || ($kind === 'template' && $text[0] === '}')) && $open !== []) {
			$from = array_pop($open);
			$match[$from] = $t;
			$match[$t] = $from;
		}
		$within[$t] = $open === [] ? -1 : $open[count($open) - 1];
		if (($kind === 'punctuator' && in_array($text, ['(', '[', '{'], true)) || ($kind === 'template' && str_ends_with($text, '${'))) {
			$open[] = $t;
		}
	}
	return [$match, $within];
}

/** Whether the token at $t follows `.` or `?.`: a member's name. */
function FLOOR__JsIsMember(array $tokens, int $t): bool
{
	return in_array($tokens[$t - 1][1] ?? '', ['.', '?.'], true) && ($tokens[$t - 1][0] ?? '') === 'punctuator';
}

/** The first name of the chain `a.b?.c` that ends at $t. */
function FLOOR__JsChainStart(array $tokens, int $t): int
{
	while (FLOOR__JsIsMember($tokens, $t) && ($tokens[$t - 2][0] ?? '') === 'name') {
		$t -= 2;
	}
	return $t;
}

/** The names a bracket of parameters or a pattern binds, between $from and $to: neither a member nor a key. */
function FLOOR__JsGroupNames(array $tokens, int $from, int $to): array
{
	$names = [];
	for ($t = $from + 1; $t < $to; $t++) {
		if ($tokens[$t][0] === 'name' && !FLOOR__JsIsMember($tokens, $t) && ($tokens[$t + 1][1] ?? '') !== ':' && !in_array($tokens[$t][1], MIN_JS_KEYWORDS, true)) {
			$names[] = $tokens[$t][1];
		}
	}
	return $names;
}

/** The names a declaration binds from its first binding at $t - names and the names of patterns, each after a `,` - to
 *  its `;`, its `in` or `of`, or the end of the bracket it stands in. */
function FLOOR__JsBindings(array $tokens, array $match, int $t): array
{
	$names = [];
	$binding = true;
	for ($count = count($tokens); $t < $count; $t++) {
		[$kind, $text] = $tokens[$t];
		if ($binding && $kind === 'name') {
			$names[] = $text;
		} elseif ($kind === 'punctuator' && in_array($text, ['(', '[', '{'], true) && isset($match[$t])) {
			$names = $binding ? [...$names, ...FLOOR__JsGroupNames($tokens, $t, $match[$t])] : $names;
			$t = $match[$t];
		} elseif (($kind === 'punctuator' && in_array($text, [';', ')', ']', '}'], true)) || ($kind === 'name' && in_array($text, ['in', 'of'], true))) {
			break;
		}
		$binding = $kind === 'punctuator' && $text === ',';
	}
	return $names;
}

/** The declaration a `using` at $t begins - 'using' or 'await_using' - or '' where the word is a name. */
function FLOOR__JsUsing(array $tokens, int $t): string
{
	$binding = $tokens[$t + 1] ?? ['', '', 0, 0];
	if ($tokens[$t][1] !== 'using' || FLOOR__JsIsMember($tokens, $t) || $binding[0] !== 'name' || in_array($binding[1], MIN_JS_KEYWORDS, true) || $binding[3] !== $tokens[$t][3] || !in_array($tokens[$t + 2][1] ?? '', ['=', 'of'], true)) {
		return '';
	}
	return ($tokens[$t - 1][1] ?? '') === 'await' ? 'await_using' : 'using';
}

/** Whether the name at $t is a key, a label, a method or a class member, not a value the script reads. */
function FLOOR__JsIsKey(array $tokens, array $match, array $within, array $classes, int $t): bool
{
	$prev = $tokens[$t - 1] ?? ['', ''];
	$next = $tokens[$t + 1][1] ?? '';
	if ($next === ':' && in_array($prev[1], ['', '{', ',', ';', '}'], true)) {
		return true;
	}
	if ($next === '(' && isset($match[$t + 1]) && ($tokens[$match[$t + 1] + 1][1] ?? '') === '{' && !in_array($tokens[$t][1], [...MIN_JS_HEADS, 'function'], true)) {
		return true;
	}
	return isset($classes[$within[$t]]) && ($prev[0] !== 'punctuator' || in_array($prev[1], ['{', '}', ';', ')', ']', '*'], true));
}

/** Whether a regular expression literal holds a modifier group, (?i:…) or (?-i:…). */
function FLOOR__JsRegexpHasModifier(string $regexp): bool
{
	$body = substr($regexp, 1, (int)strrpos($regexp, '/') - 1);
	$class = false;
	for ($i = 0, $n = strlen($body); $i < $n; $i++) {
		$c = $body[$i];
		if ($c === '\\') {
			$i++;
		} elseif ($class) {
			$class = $c !== ']';
		} elseif ($c === '[') {
			$class = true;
		} elseif ($c === '(' && preg_match('~\G\(\?(?:[ims]+(?:-[ims]*)?|-[ims]+):~', $body, $m, 0, $i) === 1) {
			return true;
		}
	}
	return false;
}

/**
 * What a script's tokens tell of the whole file: the names it declares (a declaration, a parameter, an import, a global
 * it assigns), the member names it defines (a key, `{X}`, a method, a class member, `o.X = …`), the names it tests
 * (`'X' in o`, `typeof o.X`, `X?.`, `o.X &&`, `!o.X`, `if (o.X)`, `o.X === undefined`) and its class bodies' braces.
 * @return array{declared: array<string, true>, defined: array<string, true>, tested: array<string, true>, classes: array<int, true>}
 */
function FLOOR__JsScan(array $tokens, array $match, array $within): array
{
	$scan = ['declared' => [], 'defined' => [], 'tested' => [], 'classes' => []];
	$count = count($tokens);
	for ($t = 0; $t < $count; $t++) {
		[$kind, $text] = $tokens[$t];
		$next = $tokens[$t + 1][1] ?? '';
		if ($kind === 'string' && $next === 'in' && preg_match('~^[\'"]([\w$]+)[\'"]$~', $text, $m) === 1) {
			$scan['tested'][$m[1]] = true;
		} elseif ($kind === 'string' && $next === ':' && in_array($tokens[$t - 1][1] ?? '', ['{', ','], true)) {
			$scan['defined'][substr($text, 1, -1)] = true;
		} elseif ($kind === 'punctuator' && $text === ')' && $next === '=>' && isset($match[$t])) {
			$scan['declared'] += array_fill_keys(FLOOR__JsGroupNames($tokens, $match[$t], $t), true);
		}
		if ($kind !== 'name') {
			continue;
		}
		$start = FLOOR__JsChainStart($tokens, $t);
		$before = $tokens[$start - 1][1] ?? '';
		$end = !in_array($next, ['.', '?.', '(', '['], true) && ($tokens[$t + 1][0] ?? '') !== 'template';
		$condition = $next === ')' && isset($match[$t + 1]) && in_array($tokens[$match[$t + 1] - 1][1] ?? '', ['if', 'while'], true);
		if ($next === '?.' || ($end && (in_array($next, FLOOR_JS_TESTS, true) || $before === '!' || ($condition && in_array($before, ['(', '&&', '||'], true)) || (in_array($next, FLOOR_JS_COMPARE, true) && in_array($tokens[$t + 2][1] ?? '', ['undefined', 'null'], true)) || (in_array($before, FLOOR_JS_COMPARE, true) && in_array($tokens[$start - 2][1] ?? '', ['undefined', 'null'], true))))) {
			$scan['tested'][$text] = true;
		}
		if (!FLOOR__JsIsMember($tokens, $t) && in_array($tokens[$t - 1][1] ?? '', ['{', ','], true) && in_array($next, [',', '}', '='], true)) {
			$scan['defined'][$text] = true;
		}
		if (FLOOR__JsIsMember($tokens, $t)) {
			if (in_array($next, ['=', '||=', '&&=', '??='], true)) {
				$scan['defined'][$text] = true;
				if (in_array($tokens[$t - 2][1] ?? '', FLOOR_JS_GLOBAL_OBJECTS, true) && !FLOOR__JsIsMember($tokens, $t - 2)) {
					$scan['declared'][$text] = true;
				}
			}
			continue;
		}
		if ($text === 'typeof') {
			$k = $t + 1;
			while (($tokens[$k][1] ?? '') === '(') {
				$k++;
			}
			while (($tokens[$k][0] ?? '') === 'name') {
				$scan['tested'][$tokens[$k][1]] = true;
				if (!in_array($tokens[$k + 1][1] ?? '', ['.', '?.'], true)) {
					break;
				}
				$k += 2;
			}
		} elseif (in_array($text, ['let', 'const', 'var'], true) && (($tokens[$t + 1][0] ?? '') === 'name' || $next === '{' || $next === '[')) {
			$scan['declared'] += array_fill_keys(FLOOR__JsBindings($tokens, $match, $t + 1), true);
		} elseif (FLOOR__JsUsing($tokens, $t) !== '') {
			$scan['declared'][$next] = true;
		} elseif ($text === 'function' || ($text === 'catch' && $next === '(')) {
			$k = $t + 1 + ($next === '*' ? 1 : 0);
			if (($tokens[$k][0] ?? '') === 'name') {
				$scan['declared'][$tokens[$k++][1]] = true;
			}
			if (($tokens[$k][1] ?? '') === '(' && isset($match[$k])) {
				$scan['declared'] += array_fill_keys(FLOOR__JsGroupNames($tokens, $k, $match[$k]), true);
			}
		} elseif ($text === 'class' && $next !== ':') {
			if (($tokens[$t + 1][0] ?? '') === 'name' && $next !== 'extends') {
				$scan['declared'][$next] = true;
			}
			$k = $t + 1;
			while ($k < $count && !($tokens[$k][1] === '{' && $within[$k] === $within[$t])) {
				$k++;
			}
			$scan['classes'][$k] = true;
		} elseif ($text === 'import' && $next !== '(' && $next !== '.') {
			for ($k = $t + 1; $k < $count && $tokens[$k][0] !== 'string' && $tokens[$k][1] !== ';'; $k++) {
				if ($tokens[$k][0] === 'name' && !in_array($tokens[$k][1], ['as', 'from'], true)) {
					$scan['declared'][$tokens[$k][1]] = true;
				}
			}
		} elseif (FLOOR__JsIsKey($tokens, $match, $within, $scan['classes'], $t)) {
			$scan['defined'][$text] = true;
			if ($next === '(' && isset($match[$t + 1])) {
				$scan['declared'] += array_fill_keys(FLOOR__JsGroupNames($tokens, $t + 1, $match[$t + 1]), true);
			}
		} elseif ($next === '=>' || ($next === '=' && !in_array($text, MIN_JS_KEYWORDS, true))) {
			$scan['declared'][$text] = true;
		}
	}
	return $scan;
}

/** The facts of a script: each global, constructor, static, member and statement it uses whose name floor.json holds,
 *  but for the names the file declares, defines or tests - a test spares every name of the tested one's web-features -
 *  and the members of a dataset. */
function FLOOR__JsFacts(array $tokens, array $data): array
{
	[$match, $within] = FLOOR__JsBrackets($tokens);
	$scan = FLOOR__JsScan($tokens, $match, $within);
	$tested = [];
	foreach (array_keys($scan['tested']) as $word) {
		$tested += $data['words'][$word] ?? [];
	}
	$facts = [];
	foreach ($tokens as $t => [$kind, $text, , $line]) {
		$next = $tokens[$t + 1][1] ?? '';
		$words = [$text];
		$name = '';
		if ($kind === 'regexp') {
			$name = FLOOR__JsRegexpHasModifier($text) ? 'regexp:modifier' : '';
			$words = [];
		} elseif ($kind === 'string' && in_array($tokens[$t - 1][1] ?? '', ['from', 'import'], true) && in_array($next, ['with', 'assert'], true) && ($tokens[$t + 2][1] ?? '') === '{') {
			$name = 'statement:import.' . ($next === 'with' ? 'import_attributes' : 'import_assertions');
			for ($k = $t + 3; $k < ($match[$t + 2] ?? 0); $k++) {
				if (trim($tokens[$k][1], '\'"') === 'type' && ($tokens[$k + 1][1] ?? '') === ':' && isset($data['names'][$name . '.type_' . trim($tokens[$k + 2][1] ?? '', '\'"')])) {
					$name .= '.type_' . trim($tokens[$k + 2][1], '\'"');
					break;
				}
			}
			$words = [];
		} elseif ($kind !== 'name') {
			continue;
		} elseif (FLOOR__JsUsing($tokens, $t) !== '') {
			$name = 'statement:' . FLOOR__JsUsing($tokens, $t);
			$words = [];
		} elseif (FLOOR__JsIsMember($tokens, $t)) {
			if (in_array($next, ['=', '||=', '&&=', '??='], true) || (($tokens[$t - 2][1] ?? '') === 'dataset' && FLOOR__JsIsMember($tokens, $t - 2))) {
				continue;
			}
			$receiver = ($tokens[$t - 2][0] ?? '') === 'name' ? $tokens[$t - 2][1] : '';
			$free = $receiver !== '' && !FLOOR__JsIsMember($tokens, $t - 2);
			$throughGlobal = $receiver !== '' && !$free && in_array($tokens[$t - 4][1] ?? '', FLOOR_JS_GLOBAL_OBJECTS, true) && !FLOOR__JsIsMember($tokens, $t - 4);
			$name = match (true) {
				$free && (in_array($receiver, ['window', 'globalThis'], true) || ($receiver === 'self' && !isset($scan['declared']['self']))) => 'global:' . $text,
				($free || $throughGlobal) && in_array($receiver, FLOOR_JS_RECEIVERS, true) => $receiver . ':' . $text,
				($free && !isset($scan['declared'][$receiver])) || $throughGlobal => 'static:' . $receiver . '.' . $text,
				default => '',
			};
			$words = str_starts_with($name, 'static:') ? [$receiver, $text] : [$text];
			if (!isset($data['names'][$name])) {
				$name = isset($scan['defined'][$text]) ? '' : 'member:' . $text;
				$words = [$text];
			}
		} elseif (!in_array($text, MIN_JS_KEYWORDS, true) && !isset($scan['declared'][$text]) && !in_array($tokens[$t - 1][1] ?? '', ['break', 'continue'], true) && !FLOOR__JsIsKey($tokens, $match, $within, $scan['classes'], $t)) {
			$name = ($tokens[$t - 1][1] ?? '') === 'new' && $next !== '.' && $next !== '?.' && isset($data['names']['new:' . $text]) ? 'new:' . $text : 'global:' . $text;
		}
		if (!isset($data['names'][$name])) {
			continue;
		}
		$spared = $words !== [] && (array_any($words, fn(string $word): bool => isset($scan['tested'][$word])) || array_any($data['names'][$name]['features'], fn(string $feature): bool => isset($tested[$feature])));
		if (!$spared) {
			FLOOR__Fact($facts, $name, $line, FLOOR_BROWSERS);
		}
	}
	return $facts;
}

/** The findings of $facts in $file: a missing or partial feature, an unknown name, a prefix no engine takes, unchecked code. */
function FLOOR__Findings(array $facts, string $file, array $data, array $allow, array &$used): array
{
	$findings = [];
	foreach ($facts as $fact) {
		$name = $fact['name'];
		$line = $fact['line'];
		if (str_starts_with($name, 'unchecked:')) {
			$findings[] = FLOOR__Finding($file, $line, $name, substr($name, 10) . ' - not checked by the floor gate: keep CSS in stylesheets and behavior in scripts');
			continue;
		}
		if ($name === 'mixed:vendor-list') {
			$findings[] = FLOOR__Finding($file, $line, $name, 'a vendor pseudo-element in a list with other selectors drops the whole rule where it is unknown - give it a rule of its own');
			continue;
		}
		if (!isset($data['names'][$name])) {
			if (!FLOOR__Allowed($allow, $name, '', $line, $used)) {
				$findings[] = FLOOR__Finding($file, $line, $name, $name . ' - not in browser-compat-data ' . $data['bcd']['version'] . ': a typo, or an exception with its reason');
			}
			continue;
		}
		if ($fact['prefix'] !== '' || preg_match('~^(property|selector):-[a-z]~', $name) === 1) {
			if (FLOOR__SupportedIn($data, $fact['live'], [$name], $fact['prefix']) === [] && !FLOOR__Allowed($allow, $name, '', $line, $used)) {
				$findings[] = FLOOR__Finding($file, $line, $name, ($fact['prefix'] === '' ? $name : $name . ' with ' . $fact['prefix']) . ' - no browser at the floor takes this vendor form');
			}
			continue;
		}
		$lacking = [];
		foreach ($fact['live'] as $browser) {
			$verdict = FLOOR__NameVerdict($data, $name, $browser);
			if ($verdict === 'full' || FLOOR__Allowed($allow, $name, $browser, $line, $used)) {
				continue;
			}
			foreach ($fact['covered'] as $prefix) {
				if (FLOOR__NameVerdict($data, $fact['cover'], $browser, $prefix) === 'full') {
					continue 2;
				}
			}
			$lacking[$browser] = $data['names'][$name]['verdicts'][$browser];
		}
		if ($lacking !== []) {
			$key = $data['names'][$name]['key'];
			$verdicts = array_map(fn(string $browser, string $verdict): string => $browser . ' ' . $data['floor'][$browser] . ' ' . $verdict, array_keys($lacking), $lacking);
			$hand = preg_match(FLOOR_JS_PLAIN, $name) === 1;
			$findings[] = FLOOR__Finding($file, $line, $name, $name . ' (' . $key . ') - ' . implode(', ', $verdicts) . ($hand ? ' - a plain word, maybe the page\'s own: check by hand' : ''), $key, $lacking, $hand);
		}
	}
	return $findings;
}

/** The findings of one stylesheet ('css'), page ('html') or script ('js') shown as $file, with the exceptions of $allow
 *  and, in a stylesheet or a script, its floor-allow comments; a comment that allows nothing is a finding, and so is a
 *  script min.php's reader cannot read. */
function FLOOR__FileFindings(string $text, string $kind, string $file, array $data, array $allow, array &$used): array
{
	$findings = [];
	if ($kind === 'js') {
		try {
			[$tokens, $comments] = FLOOR__JsTokens($text);
		} catch (RuntimeException $e) {
			return [FLOOR__Finding($file, substr_count(substr($text, 0, $e->getCode()), "\n") + 1, '', 'the script cannot be read, so nothing in it is checked: ' . $e->getMessage())];
		}
		$inline = FLOOR__JsAllowComments($comments, $file, $findings);
		$facts = FLOOR__JsFacts($tokens, $data);
	} else {
		$inline = $kind === 'css' ? FLOOR__CssAllowComments($text, $file, $findings) : [];
		$facts = $kind === 'css' ? FLOOR__CssFacts($text, $data) : FLOOR__HtmlFacts($text, $data);
	}
	$findings = [...$findings, ...FLOOR__Findings($facts, $file, $data, [...$allow, ...$inline], $used)];
	foreach ($inline as $id => $entry) {
		if (!isset($used[$id])) {
			$findings[] = FLOOR__Finding($file, $entry['line'], $entry['name'], 'the floor-allow of ' . $entry['name'] . ' allows nothing - remove it');
		}
	}
	$unique = [];
	foreach ($findings as $finding) {
		$unique[FLOOR__FindingLine($finding)] ??= $finding;
	}
	return array_values($unique);
}

/** The findings of $files, by path the name to show: .html and .htm as pages, .js and .mjs as scripts, the rest as
 *  stylesheets. */
function FLOOR__Judge(array $data, array $allow, array $files, array &$used): array
{
	$findings = [];
	foreach ($files as $path => $shown) {
		$kind = match (true) {
			preg_match('~\.html?$~i', (string)$path) === 1 => 'html',
			preg_match('~\.m?js$~i', (string)$path) === 1 => 'js',
			default => 'css',
		};
		$findings = [...$findings, ...FLOOR__FileFindings(FLOOR__Read((string)$path), $kind, (string)$shown, $data, $allow, $used)];
	}
	return $findings;
}

/** The fuses of FLOOR__Fuses() that misfire under every exception of the release: a broken sample let through, or a sound one reported. */
function FLOOR__SelfTest(array $data): array
{
	$failures = [];
	$allow = FLOOR__ReleaseAllow($data, FLOOR_SCOPES);
	foreach (FLOOR__Fuses() as [$kind, $sample, $expect]) {
		$used = [];
		$lines = array_map('FLOOR__FindingLine', FLOOR__FileFindings($sample, $kind, 'fuse', $data, $allow, $used));
		$findings = implode("\n", $lines);
		if ($expect === '' ? $findings !== '' : !str_contains($findings, $expect)) {
			$failures[] = 'the fuse ' . json_encode($sample, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . ($expect === '' ? ' reports ' . $findings : ' does not report ' . $expect);
		}
	}
	return $failures;
}

/** check [--allow=FILE] [--json] FILE…: the findings of the files under the release's exceptions for any stylesheet and
 *  the allow file's, the notes to check by hand apart; 0 clean, 1 findings, 2 a wrong call or anything the checker
 *  cannot read or prove. */
function FLOOR__Cli(array $argv): int
{
	$json = false;
	$allowFile = null;
	$paths = [];
	$wrong = ($argv[1] ?? '') !== 'check';
	foreach (array_slice($argv, 2) as $arg) {
		if ($arg === '--json') {
			$json = true;
		} elseif (str_starts_with($arg, '--allow=') && $allowFile === null && strlen($arg) > 8) {
			$allowFile = substr($arg, 8);
		} elseif (str_starts_with($arg, '-')) {
			$wrong = true;
		} else {
			$paths[] = $arg;
		}
	}
	if ($wrong || $paths === []) {
		fwrite(STDERR, FLOOR_USAGE);
		return 2;
	}
	try {
		$data = FLOOR__Table(FLOOR__Read(__DIR__ . '/floor.json'));
		$misfires = FLOOR__SelfTest($data);
		if ($misfires !== []) {
			throw new RuntimeException("the checker cannot prove itself:\n" . implode("\n", $misfires));
		}
		$allow = [...FLOOR__ReleaseAllow($data, ['any']), ...($allowFile === null ? [] : FLOOR__AllowFile($allowFile))];
		$used = [];
		$findings = FLOOR__Judge($data, $allow, array_combine($paths, $paths), $used);
		foreach ($allow as $id => $entry) {
			if (str_starts_with($id, 'file#') && !isset($used[$id])) {
				$findings[] = FLOOR__Finding($entry['file'], 0, $entry['name'], 'the exception ' . $entry['name'] . ' allows nothing - remove it');
			}
		}
	} catch (Throwable $e) {
		fwrite(STDERR, 'floor.php: ' . $e->getMessage() . "\n");
		return 2;
	}
	$hand = array_values(array_filter($findings, fn(array $finding): bool => $finding['hand']));
	$findings = array_values(array_filter($findings, fn(array $finding): bool => !$finding['hand']));
	echo $json
		? json_encode(['floor' => $data['floor'], 'bcd' => $data['bcd']['version'], 'findings' => $findings, 'hand' => $hand], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n"
		: implode('', array_map(fn(array $finding): string => FLOOR__FindingLine($finding) . "\n", $findings));
	fwrite(STDERR, implode('', array_map(fn(array $finding): string => FLOOR__FindingLine($finding) . "\n", $json ? [] : $hand)));
	fwrite(STDERR, sprintf("floor %s · BCD %s · %d files · %s%s\n", implode(' ', array_map(fn(string $browser): string => $browser . ' ' . $data['floor'][$browser], FLOOR_BROWSERS)), $data['bcd']['version'], count($paths), $findings === [] ? 'CLEAN' : count($findings) . ' findings', $hand === [] ? '' : ' · ' . count($hand) . ' to check by hand'));
	return $findings === [] ? 0 : 1;
}

// Run as a command, the checker; asked for by a web server, nothing.
$script = (string)($_SERVER['SCRIPT_FILENAME'] ?? '');
if ($script !== '' && realpath($script) === __FILE__) {
	if (PHP_SAPI !== 'cli') {
		http_response_code(404);
		exit;
	}
	exit(FLOOR__Cli($argv));
}

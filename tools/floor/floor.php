<?php
// floor - the browser floor checker of REDZ.UI: every property, value, function, unit, selector, at-rule, media feature,
// element and attribute of a stylesheet or a page, judged by floor.json beside it - each name's verdict at the floor from
// MDN's browser-compat-data, and the release's exceptions. The core of the library's own gate, tools/floor.php, and
// shipped as it is in each release's redz-ui-tools-<version>.zip. PHP 8.4+, no network.
// Usage: php floor.php check [--allow=FILE] [--json] FILE… - a finding a line on stdout, FILE:LINE  NAME (KEY) - BROWSER
// VERSION VERDICT, …, the summary on stderr; exit 0 clean, 1 findings, 2 anything else. A block counts only for the
// browsers that apply it (@media, @supports), and a vendor form beside a property covers it. An exception needs a reason:
// /* floor-allow NAME[, NAME…] -- reason */ covers those names on its own lines and the next one, and --allow=FILE reads
// {"allow": [{"name": NAME, "browsers": [BROWSER…], "reason": TEXT}]}; one that allows nothing is a finding.

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
 * The table of floor.json's text: the floor, the BCD version, each name's key and verdicts - by browser, where it falls
 * short, and the browsers that take each vendor form - and the release's exceptions.
 * @return array{floor: array<string, string>, bcd: array<string, string>, names: array<string, array{key: string, verdicts: array<string, string>, prefixes: array<string, array<string, true>>}>, allow: list<array<string, mixed>>}
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
		$entry = ['key' => '', 'verdicts' => [], 'prefixes' => []];
		foreach ($info === 'ok' ? [] : (is_array($info) ? $info : throw new RuntimeException('floor.json: a name it cannot read: ' . $name)) as $field => $value) {
			match (true) {
				$field === 'key' && is_string($value) => $entry['key'] = $value,
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
	return ['floor' => $list['floor'], 'bcd' => $list['bcd'], 'names' => $names, 'allow' => $list['allow']];
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
			$body = trim($body);
			$last = $line + substr_count($css, "\n", $i, $end - $i);
			if (preg_match(FLOOR_ALLOW_COMMENT, $body) === 1) {
				if (preg_match('~^floor-allow\s+(\S.*?)\s+--\s+(\S.*)$~s', $body, $m) !== 1) {
					$findings[] = FLOOR__Finding($file, $line, '', 'a floor-allow needs NAME[, NAME…] -- reason');
				} else {
					foreach (array_map('trim', explode(',', $m[1])) as $k => $name) {
						$allow['inline:' . $file . ':' . $line . ':' . $k] = ['name' => $name, 'reason' => $m[2], 'file' => $file, 'line' => $line, 'lines' => [$line, $last + 1]];
					}
				}
			}
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

/** One finding: where, the name it is about, its BCD key and verdicts by browser when it falls short, and its text. */
function FLOOR__Finding(string $file, int $line, string $name, string $text, string $key = '', array $browsers = []): array
{
	return ['file' => $file, 'line' => $line, 'name' => $name, 'key' => $key, 'browsers' => $browsers, 'text' => $text];
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
			$findings[] = FLOOR__Finding($file, $line, $name, $name . ' (' . $key . ') - ' . implode(', ', $verdicts), $key, $lacking);
		}
	}
	return $findings;
}

/** The findings of one stylesheet ('css') or page ('html') shown as $file, with the exceptions of $allow and, in a
 *  stylesheet, its floor-allow comments; a comment that allows nothing is a finding. */
function FLOOR__FileFindings(string $text, string $kind, string $file, array $data, array $allow, array &$used): array
{
	$findings = [];
	$inline = $kind === 'css' ? FLOOR__CssAllowComments($text, $file, $findings) : [];
	$facts = $kind === 'css' ? FLOOR__CssFacts($text, $data) : FLOOR__HtmlFacts($text, $data);
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

/** The findings of $files, by path the name to show: .html and .htm as pages, the rest as stylesheets. */
function FLOOR__Judge(array $data, array $allow, array $files, array &$used): array
{
	$findings = [];
	foreach ($files as $path => $shown) {
		$kind = preg_match('~\.html?$~i', (string)$path) === 1 ? 'html' : 'css';
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
 *  the allow file's; 0 clean, 1 findings, 2 a wrong call or anything the checker cannot read or prove. */
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
	echo $json
		? json_encode(['floor' => $data['floor'], 'bcd' => $data['bcd']['version'], 'findings' => $findings], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n"
		: implode('', array_map(fn(array $finding): string => FLOOR__FindingLine($finding) . "\n", $findings));
	fwrite(STDERR, sprintf("floor %s · BCD %s · %d files · %s\n", implode(' ', array_map(fn(string $browser): string => $browser . ' ' . $data['floor'][$browser], FLOOR_BROWSERS)), $data['bcd']['version'], count($paths), $findings === [] ? 'CLEAN' : count($findings) . ' findings'));
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

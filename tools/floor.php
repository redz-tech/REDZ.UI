<?php
// floor — the browser floor gate: every CSS and HTML feature of the library against MDN's browser-compat-data at the
// versions of tools/floor/rules.json. Usage: php tools/floor.php check [FILE…] | build | refresh [VERSION]
// check — reports each feature the floor lacks as file:line, exits 1 on any, when floor.json is out of date, and when an
// exception or a repair of rules.json is outgrown; with files (.css, .html), checks just them; either way first proves
// itself on the fuses of FLOOR_FUSES;
// build — writes floor.json, every name the gate knows with its verdict at the floor, for the release;
// refresh — downloads @mdn/browser-compat-data (the version of tools/floor/bcd.tsv, or VERSION), verifies its sha512 and
// writes tools/floor/bcd.tsv.

require __DIR__ . '/lib.php';

const FLOOR_ROOT = __DIR__ . '/..';
const FLOOR_DATA = __DIR__ . '/floor/bcd.tsv';
const FLOOR_RULES = __DIR__ . '/floor/rules.json';
const FLOOR_LIST = __DIR__ . '/../floor.json';
const FLOOR_BROWSERS = ['chrome', 'chrome_android', 'edge', 'firefox', 'firefox_android', 'safari', 'safari_ios'];
const FLOOR_PREFIXES = ['-webkit-', '-moz-'];
const FLOOR_LIST_PROPERTIES = ['transition', 'transition-property', 'will-change'];
const FLOOR_RULE_AT_RULES = ['media', 'supports', 'container', 'layer', 'starting-style', 'scope'];
const FLOOR_SYSTEM_COLORS = ['accentcolor', 'accentcolortext', 'activetext', 'buttonborder', 'buttonface', 'buttontext', 'canvas', 'canvastext', 'field', 'fieldtext', 'graytext', 'highlight', 'highlighttext', 'linktext', 'mark', 'marktext', 'selecteditem', 'selecteditemtext', 'visitedtext'];
const FLOOR_COMBINATORS = ['>' => 'child', '+' => 'next-sibling', '~' => 'subsequent-sibling', '*' => 'universal', '&' => 'nesting', '|' => 'namespace'];
const FLOOR_SELECTOR_ARGUMENTS = ['is', 'where', 'not', 'has', 'host', 'host-context', 'slotted'];
const FLOOR_RANGE = ['<', '>', '='];
const FLOOR_UNIT_TYPES = ['length', 'angle', 'time', 'frequency', 'resolution', 'flex'];
const FLOOR_TYPE_UNITS = ['length' => ['px', 'cm', 'mm', 'in', 'pc', 'pt'], 'time' => ['s', 'ms'], 'frequency' => ['hz', 'khz'], 'flex' => ['fr']];
const FLOOR_FUNCTION_ALIASES = ['rgba' => 'rgb'];
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
	['html', '<dialog closedby="any"></dialog>', 'attribute:dialog:closedby'],
	['html', '<div popover="hint"></div>', 'popover:hint'],
	['html', '<div style="color: red"></div>', 'style='],
	['html', '<button commandfor="d" command="show-modal">Open</button>', ''],
	['html', '<blink>Old</blink>', 'element:blink'],
];
const FLOOR_WORD = '~^-?[a-z][a-z0-9-]*$~';
const FLOOR_VENDOR = '~^(-[a-z]+-)(.+)$~';

/** The rules of tools/floor/rules.json: the floor versions, the files to check and the exceptions with their reasons. */
function FLOOR__Rules(): array
{
	$rules = json_decode((string)file_get_contents(FLOOR_RULES), true, 512, JSON_THROW_ON_ERROR);
	foreach (FLOOR_BROWSERS as $browser) {
		if (!isset($rules['floor'][$browser])) {
			throw new RuntimeException('tools/floor/rules.json has no floor version for ' . $browser);
		}
	}
	foreach ($rules['allow'] as $entry) {
		if (!isset($entry['reason']) || isset($entry['key']) === isset($entry['name'])) {
			throw new RuntimeException('tools/floor/rules.json: an exception needs a key or a name, and a reason: ' . json_encode($entry));
		}
	}
	foreach ($rules['repairs'] ?? [] as $repair) {
		if (!isset($repair['file'], $repair['reason']) || ($repair['until'] ?? []) === [] || array_diff(array_keys($repair['until']), FLOOR_BROWSERS) !== []) {
			throw new RuntimeException('tools/floor/rules.json: a repair needs a file, the first fixed version per browser and a reason: ' . json_encode($repair));
		}
	}
	return $rules;
}

/** The findings of the repairs of rules.json: a file that is gone, or a repair whose every browser is fixed at the floor. */
function FLOOR__RepairFindings(array $rules): array
{
	$findings = [];
	foreach ($rules['repairs'] ?? [] as $repair) {
		$fixed = array_filter($repair['until'], fn(string $until, string $browser): bool => version_compare($rules['floor'][$browser], $until, '>='), ARRAY_FILTER_USE_BOTH);
		if (!is_file(FLOOR_ROOT . '/' . $repair['file'])) {
			$findings[] = 'tools/floor/rules.json  the repair names ' . $repair['file'] . ', which is not there';
		} elseif (count($fixed) === count($repair['until'])) {
			$findings[] = 'tools/floor/rules.json  the repair in ' . $repair['file'] . ' repairs nothing at the floor any more — remove it and its record';
		}
	}
	return $findings;
}

/** The derived rows of tools/floor/bcd.tsv: the BCD version and integrity, rows by key, keys by name. */
function FLOOR__Data(): array
{
	$lines = file(FLOOR_DATA, FILE_IGNORE_NEW_LINES) ?: [];
	if (preg_match('~^# @mdn/browser-compat-data (\S+) (sha512-\S+)~', $lines[0] ?? '', $m) !== 1) {
		throw new RuntimeException('tools/floor/bcd.tsv has no header — run php tools/floor.php refresh');
	}
	$data = ['version' => $m[1], 'integrity' => $m[2], 'rows' => [], 'names' => [], 'lines' => []];
	foreach ($lines as $line) {
		if ($line === '' || $line[0] === '#') {
			continue;
		}
		$cells = explode("\t", $line);
		$support = [];
		foreach (FLOOR_BROWSERS as $i => $browser) {
			$support[$browser] = FLOOR__Ranges($cells[3 + $i]);
		}
		$data['rows'][$cells[0]] = ['feature' => $cells[2], 'support' => $support];
		$data['lines'][$cells[0]] = $line;
		foreach (explode(' ', $cells[1]) as $name) {
			$data['names'][$name][] = $cells[0];
		}
	}
	return $data;
}

/** The ranges of one cell of bcd.tsv: `added[..removed][*][^prefix]`, `;` between them, `-` for none. */
function FLOOR__Ranges(string $cell): array
{
	$ranges = [];
	foreach ($cell === '-' ? [] : explode(';', $cell) as $item) {
		if (preg_match('~^(\d+(?:\.\d+)*)(?:\.\.(\d+(?:\.\d+)*))?(\*)?(?:\^(\S+))?$~', $item, $m) !== 1) {
			throw new RuntimeException('tools/floor/bcd.tsv: a range it cannot read: ' . $item);
		}
		$ranges[] = ['added' => $m[1], 'removed' => $m[2] ?? '', 'partial' => ($m[3] ?? '') === '*', 'prefix' => $m[4] ?? ''];
	}
	return $ranges;
}

/** The support of $ranges at version $floor: 'full', 'partial' or 'none'; with $prefix, only the ranges of that prefix. */
function FLOOR__Verdict(array $ranges, string $floor, string $prefix = ''): string
{
	$verdict = 'none';
	foreach ($ranges as $range) {
		if ($range['prefix'] !== $prefix || version_compare($range['added'], $floor, '>')) {
			continue;
		}
		if ($range['removed'] !== '' && version_compare($floor, $range['removed'], '>=')) {
			continue;
		}
		if (!$range['partial']) {
			return 'full';
		}
		$verdict = 'partial';
	}
	return $verdict;
}

/** The first version of full unprefixed support in $ranges that is still supported, or ''. */
function FLOOR__Since(array $ranges): string
{
	$since = '';
	foreach ($ranges as $range) {
		if ($range['prefix'] === '' && !$range['partial'] && $range['removed'] === '' && ($since === '' || version_compare($range['added'], $since, '<'))) {
			$since = $range['added'];
		}
	}
	return $since;
}

/** The best verdict of the keys of $name in $browser at the floor: 'full', 'partial', 'none' or 'unknown'. */
function FLOOR__NameVerdict(array $data, array $rules, string $name, string $browser, string $prefix = ''): string
{
	$verdict = isset($data['names'][$name]) ? 'none' : 'unknown';
	foreach ($data['names'][$name] ?? [] as $key) {
		$one = FLOOR__Verdict($data['rows'][$key]['support'][$browser], $rules['floor'][$browser], $prefix);
		if ($one === 'full') {
			return 'full';
		}
		if ($one === 'partial') {
			$verdict = 'partial';
		}
	}
	return $verdict;
}

/** The browsers of $live in which every one of $names has full support (with $prefix for the first one). */
function FLOOR__SupportedIn(array $data, array $rules, array $live, array $names, string $prefix = ''): array
{
	return array_values(array_filter($live, function (string $browser) use ($data, $rules, $names, $prefix): bool {
		foreach ($names as $k => $name) {
			if (FLOOR__NameVerdict($data, $rules, $name, $browser, $k === 0 ? $prefix : '') !== 'full') {
				return false;
			}
		}
		return true;
	}));
}

/** The names a BCD path answers to by the grammar of floor.json; none for a behavior that no markup shows. */
function FLOOR__Names(array $path, array $compat): array
{
	$depth = count($path);
	$last = $path[$depth - 1];
	$desc = html_entity_decode((string)($compat['description'] ?? ''), ENT_QUOTES | ENT_HTML5);
	$function = preg_match('~^<code>([a-z][a-z0-9-]*)\(\)</code>~', $desc, $m) === 1 ? $m[1] : '';
	if ($path[0] === 'html') {
		return FLOOR__HtmlNames($path, $desc);
	}
	switch ($path[1]) {
		case 'properties':
			if ($depth === 3) {
				return [$path[2] === 'custom-property' ? 'property:--*' : 'property:' . $path[2]];
			}
			if ($depth === 4 && $function !== '') {
				return ['function:' . $path[2] . ':' . $function];
			}
			return $depth === 4 && preg_match(FLOOR_WORD, $last) === 1 ? ['value:' . $path[2] . ':' . $last] : [];
		case 'selectors':
			return match ($depth) {
				3 => ['selector:' . $path[2]],
				4 => ['selector:' . $path[2] . '.' . $path[3]],
				default => [],
			};
		case 'at-rules':
			if ($depth === 3) {
				return ['at-rule:' . $path[2]];
			}
			if ($depth !== 4) {
				return [];
			}
			return match ($path[2]) {
				'media', 'container', 'supports', 'import' => [$path[2] . ':' . $last],
				default => ['descriptor:' . $path[2] . ':' . $last],
			};
		case 'types':
			return FLOOR__TypeNames($path, $desc, $function);
	}
	return [];
}

/** The names of a css.types path: a function, a unit or a group of units, a keyword or the hex notation; the absolute
 *  units have no key of their own and answer to their type. */
function FLOOR__TypeNames(array $path, string $desc, string $function): array
{
	$depth = count($path);
	if ($function !== '' && $depth <= 4) {
		return ['function:' . $function];
	}
	if ($depth === 3) {
		return array_map(fn(string $unit): string => 'unit:' . $unit, FLOOR_TYPE_UNITS[$path[2]] ?? []);
	}
	if ($depth === 4 && in_array($path[2], FLOOR_UNIT_TYPES, true)) {
		if (preg_match('~\bunits?\b~', $desc) === 1) {
			preg_match_all('~<code>([a-zA-Z]+)</code>~', $desc, $m);
			return array_map(fn(string $unit): string => 'unit:' . strtolower($unit), $m[1]);
		}
		return preg_match('~^[A-Za-z]+$~', $path[3]) === 1 ? ['unit:' . strtolower($path[3])] : [];
	}
	if ($depth === 4 && $path[2] === 'global_keywords') {
		return ['keyword:' . $path[3]];
	}
	if ($depth === 4 && $path[3] === 'rgb_hexadecimal_notation') {
		return ['hash:rgb'];
	}
	if ($depth === 5 && $path[4] === 'alpha_hexadecimal_notation') {
		return ['hash:alpha'];
	}
	if ($depth === 4 && $path[3] === 'system-color') {
		return ['keyword:system-color'];
	}
	if ($depth === 5 && $path[3] === 'system-color') {
		return array_map(fn(string $word): string => 'keyword:' . $word, array_values(array_intersect(explode('_', $path[4]), FLOOR_SYSTEM_COLORS)));
	}
	if ($depth === 4 && preg_match('~^<code>([a-z-]+)</code> keyword$~', $desc, $m) === 1) {
		return ['keyword:' . $m[1]];
	}
	return [];
}

/** The names of an html path: an element, an attribute of one element or of all, an attribute's value. */
function FLOOR__HtmlNames(array $path, string $desc): array
{
	$depth = count($path);
	$last = $path[$depth - 1];
	if ($path[1] === 'elements') {
		if ($depth === 3) {
			return ['element:' . $path[2]];
		}
		if (preg_match('~^<code>([a-z][a-z0-9-]*)="([^"]*)"</code>~', $desc, $m) === 1) {
			return ['attr-value:' . $path[2] . ':' . $m[1] . ':' . $m[2]];
		}
		if (preg_match(FLOOR_WORD, $last) !== 1) {
			return [];
		}
		return match ($depth) {
			4 => ['attribute:' . $path[2] . ':' . $last],
			5 => ['attr-value:' . $path[2] . ':' . $path[3] . ':' . $last],
			default => [],
		};
	}
	if ($path[1] === 'global_attributes' && preg_match(FLOOR_WORD, $last) === 1) {
		return match ($depth) {
			3 => ['attribute:*:' . $last],
			4 => ['attr-value:*:' . $path[2] . ':' . $last],
			default => [],
		};
	}
	return [];
}

/** One cell of bcd.tsv from a browser's support statements: released and unflagged, of the name itself or of the
 *  alternative name $alt. */
function FLOOR__Cell(?array $statements, string $alt = ''): string
{
	$items = [];
	foreach ($statements === null ? [] : (array_is_list($statements) ? $statements : [$statements]) as $s) {
		$added = $s['version_added'];
		if ($added === false || $added === 'preview' || isset($s['flags']) || ($s['alternative_name'] ?? '') !== $alt) {
			continue;
		}
		if (!is_string($added)) {
			throw new RuntimeException('BCD: a version_added it cannot read: ' . json_encode($added));
		}
		$item = ltrim($added, '≤');
		$removed = $s['version_removed'] ?? false;
		if (is_string($removed) && $removed !== 'preview') {
			$item .= '..' . ltrim($removed, '≤');
		}
		if (!empty($s['partial_implementation'])) {
			$item .= '*';
		}
		if (isset($s['prefix'])) {
			$item .= '^' . $s['prefix'];
		}
		$items[] = $item;
	}
	return $items === [] ? '-' : implode(';', $items);
}

/** The rows of bcd.tsv for the css and html trees of BCD, one per key with names; a property's alternative name (such
 *  as word-wrap) gets a row of its own, keyed `<key>~<name>`. */
function FLOOR__Derive(array $bcd): array
{
	$rows = [];
	$walk = function (array $node, array $path) use (&$walk, &$rows): void {
		foreach ($node as $part => $child) {
			if ($part === '__compat' || !is_array($child)) {
				continue;
			}
			$here = [...$path, (string)$part];
			$names = isset($child['__compat']) ? FLOOR__Names($here, $child['__compat']) : [];
			if ($names !== []) {
				$feature = '-';
				$alts = [];
				foreach ($child['__compat']['tags'] ?? [] as $tag) {
					if (str_starts_with($tag, 'web-features:')) {
						$feature = substr($tag, 13);
					}
				}
				foreach ($child['__compat']['support'] as $statements) {
					foreach (array_is_list($statements) ? $statements : [$statements] as $s) {
						if (isset($s['alternative_name']) && count($here) === 3 && $here[1] === 'properties') {
							$alts[$s['alternative_name']] = true;
						}
					}
				}
				$cells = array_map(fn(string $browser): string => FLOOR__Cell($child['__compat']['support'][$browser] ?? null), FLOOR_BROWSERS);
				$rows[] = implode("\t", [implode('.', $here), implode(' ', array_unique($names)), $feature, ...$cells]);
				foreach (array_keys($alts) as $alt) {
					$cells = array_map(fn(string $browser): string => FLOOR__Cell($child['__compat']['support'][$browser] ?? null, $alt), FLOOR_BROWSERS);
					$rows[] = implode("\t", [implode('.', $here) . '~' . $alt, 'property:' . $alt, $feature, ...$cells]);
				}
			}
			$walk($child, $here);
		}
	};
	$walk(['css' => $bcd['css'], 'html' => $bcd['html']], []);
	return $rows;
}

/** refresh: downloads BCD $version, checks the registry's sha512, writes bcd.tsv and names exceptions to review again. */
function FLOOR__Refresh(string $version): int
{
	$package = TOOL__NpmFile('@mdn/browser-compat-data', $version, 'package/data.json');
	$rows = FLOOR__Derive(json_decode($package['body'], true, 512, JSON_THROW_ON_ERROR));
	$old = is_file(FLOOR_DATA) ? FLOOR__Data()['lines'] : [];
	$head = '# @mdn/browser-compat-data ' . $package['version'] . ' ' . $package['integrity'] . ' — derived by php tools/floor.php refresh, do not edit';
	file_put_contents(FLOOR_DATA, implode("\n", [$head, "# key\tnames\tfeature\t" . implode("\t", FLOOR_BROWSERS), ...$rows]) . "\n");
	$new = FLOOR__Data()['lines'];
	$changed = array_keys(array_diff_assoc($new, $old) + array_diff_key($old, $new));
	echo 'BCD ', $package['version'], ': ', count($rows), ' keys, ', count($changed), " changed\n";
	foreach (FLOOR__Rules()['allow'] as $entry) {
		if (isset($entry['key']) && in_array($entry['key'], $changed, true)) {
			echo 'review the exception again, its data changed: ', $entry['key'], "\n";
		}
	}
	return 0;
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
		if (ctype_space($c)) {
			$start = $i;
			while ($i < $n && ctype_space($css[$i])) {
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
		return $next === '-' || ($next !== '' && (ctype_alpha($next) || $next === '_' || ord($next) >= 0x80 || $next === '\\'));
	}
	return $c !== '' && (ctype_alpha($c) || $c === '_' || ord($c) >= 0x80 || $c === '\\');
}

/** Whether the byte at $i continues a CSS name. */
function FLOOR__CssNameChar(string $css, int $i): bool
{
	$c = $css[$i] ?? '';
	return $c !== '' && (ctype_alnum($c) || $c === '-' || $c === '_' || ord($c) >= 0x80 || $c === '\\');
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
			$name .= mb_chr((int)hexdec($m[1]));
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
function FLOOR__CssFacts(string $css, array $data, array $rules): array
{
	$tokens = FLOOR__CssTokens($css);
	$facts = [];
	$i = 0;
	FLOOR__CssBlock($tokens, $i, FLOOR_BROWSERS, 'rules', '', $data, $rules, $facts);
	return $facts;
}

/** Reads a block of rules, keyframes, declarations or the descriptors of at-rule $owner into $facts; stops on its `}`. */
function FLOOR__CssBlock(array $tokens, int &$i, array $live, string $kind, string $owner, array $data, array $rules, array &$facts): void
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
			$inner = FLOOR__CssAtRule($token[1], $prelude, $token[2], $live, $data, $rules, $facts);
			if (($tokens[$i][0] ?? '') === '{') {
				$i++;
				$innerKind = match (true) {
					in_array($token[1], FLOOR_RULE_AT_RULES, true) => $kind === 'declarations' ? 'declarations' : 'rules',
					$token[1] === 'keyframes' => 'keyframes',
					default => 'descriptors',
				};
				FLOOR__CssBlock($tokens, $i, $inner, $innerKind, $token[1], $data, $rules, $facts);
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
		FLOOR__CssBlock($tokens, $i, $live, 'declarations', '', $data, $rules, $facts);
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
		$vendor += count(array_filter(FLOOR__SelectorNames($part), fn(string $name): bool => str_starts_with($name, 'selector:-'))) > 0 ? 1 : 0;
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
		} elseif (str_starts_with($pseudo, 'nth-') && in_array('of', array_map(fn($v): string => strtolower((string)$v), array_column($argument, 1)), true)) {
			$names[] = 'selector:' . $pseudo . '.of_syntax';
		}
	}
	return array_values(array_unique($names));
}

/** Reads an at-rule's prelude into $facts; returns the browsers in which its block applies. */
function FLOOR__CssAtRule(string $name, array $prelude, int $line, array $live, array $data, array $rules, array &$facts): array
{
	FLOOR__Fact($facts, 'at-rule:' . $name, $line, $live);
	$supported = FLOOR__SupportedIn($data, $rules, $live, ['at-rule:' . $name]);
	$words = array_map(fn(array $t): string => strtolower((string)$t[1]), $prelude);
	if ($name === 'media') {
		foreach (FLOOR__MediaFeatures($prelude) as $feature) {
			if (!isset($data['names']['media:' . $feature])) {
				FLOOR__Fact($facts, 'media:' . $feature, $line, $live);
			}
			$supported = FLOOR__SupportedIn($data, $rules, $supported, ['media:' . $feature]);
		}
		if (array_intersect(FLOOR_RANGE, $words) !== []) {
			FLOOR__Fact($facts, 'media:range_syntax', $line, $live);
		}
		if (in_array('or', $words, true)) {
			FLOOR__Fact($facts, 'media:or_syntax', $line, $live);
		}
	} elseif ($name === 'container' && in_array('style', array_column(array_filter($prelude, fn(array $t): bool => $t[0] === 'function'), 1), true)) {
		FLOOR__Fact($facts, 'container:style_queries_for_custom_properties', $line, $live);
	} elseif ($name === 'supports') {
		$at = 0;
		$supported = array_values(array_intersect($supported, FLOOR__SupportsTrue($prelude, $at, $data, $rules)));
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
function FLOOR__SupportsTrue(array $tokens, int &$i, array $data, array $rules): array
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
				$set = FLOOR__SupportsDeclaration($inner, $data, $rules);
				$i = $probe;
			} else {
				$set = FLOOR__SupportsTrue($tokens, $i, $data, $rules);
			}
		} elseif ($type === 'function' && $word === 'selector') {
			$i++;
			$set = FLOOR__SupportedIn($data, $rules, FLOOR_BROWSERS, ['supports:selector', ...FLOOR__SelectorNames(FLOOR__CssUntil($tokens, $i, [')']))]);
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
function FLOOR__SupportsDeclaration(array $tokens, array $data, array $rules): array
{
	$facts = [];
	FLOOR__CssDeclarations($facts, [[$tokens, 0]], FLOOR_BROWSERS, '', $data);
	$set = FLOOR_BROWSERS;
	foreach ($facts as $fact) {
		$set = FLOOR__SupportedIn($data, $rules, $set, [$fact['name']], $fact['prefix']);
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
		$property = strtolower(trim(implode('', array_column(array_slice($tokens, 0, $colon), 1))));
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

/** Whether an exception allows $name: by name anywhere, by key in $browser — `key.*` takes the keys under it too;
 *  marks the exception used. */
function FLOOR__Allowed(array $rules, array $data, string $name, string $browser, array &$used): bool
{
	foreach ($rules['allow'] as $k => $entry) {
		$hit = isset($entry['name']) && $entry['name'] === $name;
		if (isset($entry['key']) && $browser !== '' && (!isset($entry['browsers']) || in_array($browser, $entry['browsers'], true))) {
			$tree = str_ends_with($entry['key'], '.*') ? substr($entry['key'], 0, -2) : '';
			foreach ($data['names'][$name] ?? [] as $key) {
				$hit = $hit || $key === $entry['key'] || ($tree !== '' && ($key === $tree || str_starts_with($key, $tree . '.')));
			}
		}
		if ($hit) {
			$used[$k] = true;
			return true;
		}
	}
	return false;
}

/** The findings of $facts in $file: a missing or partial feature, an unknown name, a prefix no engine takes, unchecked code. */
function FLOOR__Findings(array $facts, string $file, array $data, array $rules, array &$used): array
{
	$findings = [];
	foreach ($facts as $fact) {
		$name = $fact['name'];
		$where = $file . ':' . $fact['line'] . '  ';
		if (str_starts_with($name, 'unchecked:')) {
			$findings[] = $where . substr($name, 10) . ' — not checked by the floor gate: keep CSS in stylesheets and behavior in scripts';
			continue;
		}
		if ($name === 'mixed:vendor-list') {
			$findings[] = $where . 'a vendor pseudo-element in a list with other selectors drops the whole rule where it is unknown — give it a rule of its own';
			continue;
		}
		if (!isset($data['names'][$name])) {
			if (!FLOOR__Allowed($rules, $data, $name, '', $used)) {
				$findings[] = $where . $name . ' — not in browser-compat-data ' . $data['version'] . ': a typo, or an exception with its reason in tools/floor/rules.json';
			}
			continue;
		}
		if ($fact['prefix'] !== '' || preg_match('~^(property|selector):-[a-z]~', $name) === 1) {
			if (FLOOR__SupportedIn($data, $rules, $fact['live'], [$name], $fact['prefix']) === [] && !FLOOR__Allowed($rules, $data, $name, '', $used)) {
				$findings[] = $where . ($fact['prefix'] === '' ? $name : $name . ' with ' . $fact['prefix']) . ' — no browser at the floor takes this vendor form';
			}
			continue;
		}
		$lacking = [];
		foreach ($fact['live'] as $browser) {
			$verdict = FLOOR__NameVerdict($data, $rules, $name, $browser);
			if ($verdict === 'full' || FLOOR__Allowed($rules, $data, $name, $browser, $used)) {
				continue;
			}
			foreach ($fact['covered'] as $prefix) {
				if (FLOOR__NameVerdict($data, $rules, $fact['cover'], $browser, $prefix) === 'full') {
					continue 2;
				}
			}
			$since = FLOOR__Since($data['rows'][$data['names'][$name][0]]['support'][$browser]);
			$lacking[] = $browser . ' ' . $rules['floor'][$browser] . ($verdict === 'partial' ? ' partial' : ($since === '' ? ' none' : ' none, from ' . $since));
		}
		if ($lacking !== []) {
			$findings[] = $where . $name . ' (' . $data['names'][$name][0] . ') — ' . implode(', ', $lacking);
		}
	}
	return array_values(array_unique($findings));
}

/** The text of floor.json: the floor, the BCD version, every name with its verdict at the floor, the exceptions. */
function FLOOR__ListText(array $data, array $rules): string
{
	$names = array_keys($data['names']);
	sort($names);
	$lines = [];
	foreach ($names as $name) {
		$verdicts = [];
		foreach (FLOOR_BROWSERS as $browser) {
			$verdict = FLOOR__NameVerdict($data, $rules, $name, $browser);
			if ($verdict === 'full') {
				continue;
			}
			foreach (FLOOR_PREFIXES as $prefix) {
				if ($verdict === 'none' && FLOOR__NameVerdict($data, $rules, $name, $browser, $prefix) === 'full') {
					$verdict = 'prefix ' . $prefix;
				}
			}
			$since = FLOOR__Since($data['rows'][$data['names'][$name][0]]['support'][$browser]);
			$verdicts[$browser] = $verdict . ($verdict === 'none' && $since !== '' ? ', from ' . $since : '');
		}
		$lines[] = "\t\t" . json_encode($name) . ': ' . ($verdicts === [] ? '"ok"' : json_encode($verdicts, JSON_UNESCAPED_SLASHES));
	}
	$allow = array_map(fn(array $entry): string => "\t\t" . json_encode($entry, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), $rules['allow']);
	$bcd = json_encode(['version' => $data['version'], 'integrity' => $data['integrity']], JSON_UNESCAPED_SLASHES);
	return "{\n\t\"floor\": " . json_encode($rules['floor']) . ",\n\t\"bcd\": " . $bcd . ",\n\t\"names\": {\n" . implode(",\n", $lines) . "\n\t},\n\t\"allow\": [\n" . implode(",\n", $allow) . "\n\t]\n}\n";
}

/** The fuses of FLOOR_FUSES that misfire: a broken sample the gate lets through, or a sound one it reports. */
function FLOOR__SelfTest(array $data, array $rules): array
{
	$failures = [];
	foreach (FLOOR_FUSES as [$kind, $sample, $expect]) {
		$used = [];
		$facts = $kind === 'css' ? FLOOR__CssFacts($sample, $data, $rules) : FLOOR__HtmlFacts($sample, $data);
		$findings = implode("\n", FLOOR__Findings($facts, 'fuse', $data, $rules, $used));
		if ($expect === '' ? $findings !== '' : !str_contains($findings, $expect)) {
			$failures[] = 'tools/floor.php  the fuse ' . $sample . ($expect === '' ? ' reports ' . $findings : ' does not report ' . $expect);
		}
	}
	return $failures;
}

/** check: the findings of every stylesheet and page of rules.json, or of the files in $paths (.css or .html) alone;
 *  1 on any, or — for the library itself — when an exception allows nothing or floor.json is out of date. */
function FLOOR__Check(array $paths): int
{
	$rules = FLOOR__Rules();
	$data = FLOOR__Data();
	$root = (string)realpath(FLOOR_ROOT);
	$used = [];
	$findings = FLOOR__SelfTest($data, $rules);
	$fuses = count(FLOOR_FUSES) - count($findings);
	$files = [];
	foreach (['css', 'html'] as $kind) {
		foreach ($rules[$kind] as $pattern) {
			foreach ($paths === [] ? glob($root . '/' . $pattern) ?: [] : [] as $path) {
				$files[$path] = $kind;
			}
		}
	}
	foreach ($paths as $path) {
		$files[$path] = preg_match('~\.html?$~i', $path) === 1 ? 'html' : 'css';
	}
	foreach ($files as $path => $kind) {
		$text = (string)file_get_contents($path);
		$facts = $kind === 'css' ? FLOOR__CssFacts($text, $data, $rules) : FLOOR__HtmlFacts($text, $data);
		$findings = [...$findings, ...FLOOR__Findings($facts, str_starts_with($path, $root . '/') ? substr($path, strlen($root) + 1) : $path, $data, $rules, $used)];
	}
	foreach ($paths === [] ? $rules['allow'] : [] as $k => $entry) {
		if (!isset($used[$k])) {
			$findings[] = 'tools/floor/rules.json  the exception ' . ($entry['key'] ?? $entry['name']) . ' allows nothing any more — remove it';
		}
	}
	if ($paths === []) {
		$findings = [...$findings, ...FLOOR__RepairFindings($rules)];
	}
	if ($paths === [] && (!is_file(FLOOR_LIST) || file_get_contents(FLOOR_LIST) !== FLOOR__ListText($data, $rules))) {
		$findings[] = 'floor.json  out of date — run php tools/floor.php build';
	}
	foreach ($findings as $finding) {
		echo $finding, "\n";
	}
	$floor = implode(' ', array_map(fn(string $browser): string => $browser . ' ' . $rules['floor'][$browser], FLOOR_BROWSERS));
	printf("floor %s · BCD %s · %d files · %d exceptions · %d repairs · selftest %d/%d · %s\n", $floor, $data['version'], count($files), count($rules['allow']), count($rules['repairs'] ?? []), $fuses, count(FLOOR_FUSES), $findings === [] ? 'CLEAN' : count($findings) . ' findings');
	return $findings === [] ? 0 : 1;
}

/** The entry point: check [FILE…], build or refresh [VERSION]. */
function FLOOR__Main(array $argv): int
{
	$command = $argv[1] ?? '';
	if ($command === 'check') {
		return FLOOR__Check(array_slice($argv, 2));
	}
	if ($command === 'build') {
		file_put_contents(FLOOR_LIST, FLOOR__ListText(FLOOR__Data(), FLOOR__Rules()));
		echo "wrote floor.json\n";
		return 0;
	}
	if ($command === 'refresh') {
		return FLOOR__Refresh($argv[2] ?? (is_file(FLOOR_DATA) ? FLOOR__Data()['version'] : 'latest'));
	}
	fwrite(STDERR, "usage: php tools/floor.php check [FILE…] | build | refresh [VERSION]\n");
	return 2;
}

exit(FLOOR__Main($argv));

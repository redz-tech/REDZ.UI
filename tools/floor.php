<?php
// floor - the browser floor gate: every CSS and HTML feature of the library against MDN's browser-compat-data at the
// versions of tools/floor/rules.json. Usage: php tools/floor.php check [FILE…] | build | refresh [VERSION]
// check - reports each feature the floor lacks as file:line, exits 1 on any, when floor.json is out of date, and when an
// exception or a repair of rules.json is outgrown; with files (.css, .html), checks just them; either way first proves
// itself on the fuses of FLOOR_FUSES, and the release's checker tools/dist/floor.php on its command line;
// build - writes floor.json, every name the gate knows with its verdict at the floor, for the release;
// refresh - downloads @mdn/browser-compat-data (the version of tools/floor/bcd.tsv, or VERSION), verifies its sha512 and
// writes tools/floor/bcd.tsv.
// The readers and the verdicts are tools/floor/floor.php's, the checker each release ships: both judge by floor.json.

require __DIR__ . '/lib.php';
require __DIR__ . '/floor/floor.php';

const FLOOR_ROOT = __DIR__ . '/..';
const FLOOR_DATA = __DIR__ . '/floor/bcd.tsv';
const FLOOR_RULES = __DIR__ . '/floor/rules.json';
const FLOOR_LIST = __DIR__ . '/../floor.json';
const FLOOR_SHIPPED = __DIR__ . '/dist/floor.php';
const FLOOR_UNIT_TYPES = ['length', 'angle', 'time', 'frequency', 'resolution', 'flex'];
const FLOOR_TYPE_UNITS = ['length' => ['px', 'cm', 'mm', 'in', 'pc', 'pt'], 'time' => ['s', 'ms'], 'frequency' => ['hz', 'khz'], 'flex' => ['fr']];
const FLOOR_WORD = '~^-?[a-z][a-z0-9-]*$~';

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
		if (!isset($entry['reason']) || isset($entry['key']) === isset($entry['name']) || !in_array($entry['scope'] ?? null, FLOOR_SCOPES, true)) {
			throw new RuntimeException('tools/floor/rules.json: an exception needs a key or a name, a scope of ' . implode(' or ', FLOOR_SCOPES) . ' and a reason: ' . json_encode($entry));
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
			$findings[] = 'tools/floor/rules.json  the repair in ' . $repair['file'] . ' repairs nothing at the floor any more - remove it and its record';
		}
	}
	return $findings;
}

/** The derived rows of tools/floor/bcd.tsv: the BCD version and integrity, rows by key, keys by name. */
function FLOOR__Data(): array
{
	$lines = file(FLOOR_DATA, FILE_IGNORE_NEW_LINES) ?: [];
	if (preg_match('~^# @mdn/browser-compat-data (\S+) (sha512-\S+)~', $lines[0] ?? '', $m) !== 1) {
		throw new RuntimeException('tools/floor/bcd.tsv has no header - run php tools/floor.php refresh');
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

/** By bcd.tsv, the best verdict of the keys of $name in $browser at the floor: 'full', 'partial', 'none' or 'unknown'. */
function FLOOR__BcdVerdict(array $data, array $rules, string $name, string $browser, string $prefix = ''): string
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
	$head = '# @mdn/browser-compat-data ' . $package['version'] . ' ' . $package['integrity'] . ' - derived by php tools/floor.php refresh, do not edit';
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

/** The text of floor.json: the floor, the BCD version, every name with its key and its verdicts where it falls short at
 *  the floor and the browsers that take each of its vendor forms, and the exceptions with the names their keys cover. */
function FLOOR__ListText(array $data, array $rules): string
{
	$names = array_keys($data['names']);
	sort($names);
	$prefixes = [];
	foreach ($data['rows'] as $row) {
		foreach ($row['support'] as $ranges) {
			foreach ($ranges as $range) {
				$prefixes[$range['prefix']] = true;
			}
		}
	}
	unset($prefixes['']);
	$prefixes = array_keys($prefixes);
	sort($prefixes);
	$lines = [];
	foreach ($names as $name) {
		$info = [];
		foreach (FLOOR_BROWSERS as $browser) {
			$verdict = FLOOR__BcdVerdict($data, $rules, $name, $browser);
			if ($verdict === 'full') {
				continue;
			}
			$since = FLOOR__Since($data['rows'][$data['names'][$name][0]]['support'][$browser]);
			$info[$browser] = $verdict . ($verdict === 'none' && $since !== '' ? ', from ' . $since : '');
		}
		if ($info !== []) {
			$info = ['key' => $data['names'][$name][0]] + $info;
		}
		foreach ($prefixes as $prefix) {
			$takes = array_values(array_filter(FLOOR_BROWSERS, fn(string $browser): bool => FLOOR__BcdVerdict($data, $rules, $name, $browser, $prefix) === 'full'));
			if ($takes !== []) {
				$info[$prefix] = $takes;
			}
		}
		$lines[] = "\t\t" . json_encode($name) . ': ' . ($info === [] ? '"ok"' : json_encode($info, JSON_UNESCAPED_SLASHES));
	}
	$allow = array_map(fn(array $entry): string => "\t\t" . json_encode(FLOOR__AllowNames($data, $entry), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), $rules['allow']);
	$bcd = json_encode(['version' => $data['version'], 'integrity' => $data['integrity']], JSON_UNESCAPED_SLASHES);
	return "{\n\t\"floor\": " . json_encode($rules['floor']) . ",\n\t\"bcd\": " . $bcd . ",\n\t\"names\": {\n" . implode(",\n", $lines) . "\n\t},\n\t\"allow\": [\n" . implode(",\n", $allow) . "\n\t]\n}\n";
}

/** An exception of rules.json as floor.json carries it: a key exception with the names whose keys are that key or, for
 *  `key.*`, under it. */
function FLOOR__AllowNames(array $data, array $entry): array
{
	if (!isset($entry['key'])) {
		return $entry;
	}
	$tree = str_ends_with($entry['key'], '.*') ? substr($entry['key'], 0, -2) : '';
	$names = [];
	foreach ($data['names'] as $name => $keys) {
		foreach ($keys as $key) {
			if ($key === $entry['key'] || ($tree !== '' && ($key === $tree || str_starts_with($key, $tree . '.')))) {
				$names[] = (string)$name;
				break;
			}
		}
	}
	sort($names);
	return [...$entry, 'names' => $names];
}

/**
 * The tests of dist/js/floor.min.js that a browser at the floor would fail: each name of tools/floor/tests.json must have full
 * support at the floor in every browser, or dist/js/floor.min.js would mark that browser below it.
 * @return list<string>
 */
function FLOOR__TestFindings(array $data): array
{
	$findings = [];
	foreach (json_decode((string)file_get_contents(__DIR__ . '/floor/tests.json'), true, 512, JSON_THROW_ON_ERROR)['tests'] as $test) {
		foreach (FLOOR_BROWSERS as $browser) {
			$verdict = FLOOR__NameVerdict($data, $test['name'], $browser);
			if ($verdict !== 'full') {
				$findings[] = 'tools/floor/tests.json  ' . $test['name'] . ' is ' . $verdict . ' in ' . $browser . ' ' . $data['floor'][$browser] . ' - dist/js/floor.min.js would mark it below the floor';
			}
		}
	}
	return $findings;
}

/**
 * The release's checker, tools/dist/floor.php, run as a consumer runs it on planted files: its exit codes, its two
 * streams, --allow, --json, and that the library's own exceptions do not reach a consumer's stylesheet.
 * @return list<string>
 */
function FLOOR__CliFindings(): array
{
	if (!is_file(FLOOR_SHIPPED)) {
		return ['tools/dist/floor.php  missing - run php tools/build.php'];
	}
	$dir = sys_get_temp_dir() . '/redz-ui-floor-' . getmypid();
	$planted = [
		'clean.css' => ".a { color: red; }\n",
		'gap.css' => ".a { field-sizing: content; }\n.b { position-area: block-end span-inline-end; }\n",
		'allow.json' => '{"allow": [{"name": "property:field-sizing", "reason": "rows stay fixed below the floor"}, {"name": "value:field-sizing:content", "browsers": ["firefox", "firefox_android", "safari", "safari_ios"], "reason": "the same"}, {"name": "property:color", "reason": "nothing to allow"}]}',
		'bad.json' => '{"allow": [{"name": "property:field-sizing"}]}',
	];
	if (!is_dir($dir)) {
		mkdir($dir);
	}
	foreach ($planted as $file => $text) {
		file_put_contents($dir . '/' . $file, $text);
	}
	$cases = [
		[['check', 'clean.css'], 0, '~\A\z~', '~CLEAN~'],
		[['check', 'gap.css'], 1, '~^gap\.css:1  property:field-sizing \(css\.properties\.field-sizing\) - .*\n(?s:.*)^gap\.css:2  property:position-area \(~m', '~findings~'],
		[['check', '--allow=allow.json', 'gap.css'], 1, '~\A(?!.*gap\.css:1 )(?s:.*)^allow\.json  the exception property:color allows nothing~m', '~findings~'],
		[['check', '--json', 'gap.css'], 1, '~"name": "property:field-sizing",\s+"key": "css\.properties\.field-sizing",\s+"browsers": \{~', '~findings~'],
		[['check', '--allow=bad.json', 'clean.css'], 2, '~\A\z~', '~needs a name, a reason~'],
		[['check'], 2, '~\A\z~', '~usage~'],
		[['check', 'missing.css'], 2, '~\A\z~', '~cannot read missing\.css~'],
		[['lint', 'clean.css'], 2, '~\A\z~', '~usage~'],
	];
	$findings = [];
	foreach ($cases as [$args, $status, $out, $err]) {
		$process = proc_open([PHP_BINARY, realpath(FLOOR_SHIPPED), ...$args], [0 => ['file', '/dev/null', 'r'], 1 => ['file', $dir . '/stdout', 'w'], 2 => ['file', $dir . '/stderr', 'w']], $pipes, $dir);
		$code = proc_close($process);
		$stdout = (string)file_get_contents($dir . '/stdout');
		$stderr = (string)file_get_contents($dir . '/stderr');
		if ($code !== $status || preg_match($out, $stdout) !== 1 || preg_match($err, $stderr) !== 1) {
			$findings[] = 'tools/dist/floor.php  ' . implode(' ', $args) . ' exits ' . $code . ' (not ' . $status . '), stdout ' . json_encode(substr($stdout, 0, 300)) . ', stderr ' . json_encode(substr($stderr, 0, 300));
		}
	}
	array_map('unlink', glob($dir . '/*') ?: []);
	rmdir($dir);
	return $findings;
}

/** check: the findings of every stylesheet and page of rules.json, or of the files in $paths (.css or .html) alone;
 *  1 on any, or - for the library itself - when an exception allows nothing, floor.json is out of date or the
 *  release's checker misbehaves on its command line. */
function FLOOR__Check(array $paths): int
{
	$rules = FLOOR__Rules();
	$text = FLOOR__ListText(FLOOR__Data(), $rules);
	$data = FLOOR__Table($text);
	$root = (string)realpath(FLOOR_ROOT);
	$used = [];
	$findings = array_map(fn(string $failure): string => 'tools/floor/floor.php  ' . $failure, FLOOR__SelfTest($data));
	$fuses = count(FLOOR_FUSES) - count($findings);
	$files = [];
	foreach ([...$rules['css'], ...$rules['html']] as $pattern) {
		foreach ($paths === [] ? glob($root . '/' . $pattern) ?: [] : [] as $path) {
			$files[$path] = substr($path, strlen($root) + 1);
		}
	}
	foreach ($paths as $path) {
		$files[$path] = str_starts_with($path, $root . '/') ? substr($path, strlen($root) + 1) : $path;
	}
	$findings = [...$findings, ...array_map('FLOOR__FindingLine', FLOOR__Judge($data, FLOOR__ReleaseAllow($data, FLOOR_SCOPES), $files, $used))];
	foreach ($paths === [] ? $rules['allow'] : [] as $k => $entry) {
		if (!isset($used['release#' . $k])) {
			$findings[] = 'tools/floor/rules.json  the exception ' . ($entry['key'] ?? $entry['name']) . ' allows nothing any more - remove it';
		}
	}
	if ($paths === []) {
		$findings = [...$findings, ...FLOOR__RepairFindings($rules), ...FLOOR__TestFindings($data), ...FLOOR__CliFindings()];
	}
	if ($paths === [] && (!is_file(FLOOR_LIST) || file_get_contents(FLOOR_LIST) !== $text)) {
		$findings[] = 'floor.json  out of date - run php tools/floor.php build';
	}
	foreach ($findings as $finding) {
		echo $finding, "\n";
	}
	$floor = implode(' ', array_map(fn(string $browser): string => $browser . ' ' . $rules['floor'][$browser], FLOOR_BROWSERS));
	printf("floor %s · BCD %s · %d files · %d exceptions · %d repairs · selftest %d/%d · %s\n", $floor, $data['bcd']['version'], count($files), count($rules['allow']), count($rules['repairs'] ?? []), $fuses, count(FLOOR_FUSES), $findings === [] ? 'CLEAN' : count($findings) . ' findings');
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

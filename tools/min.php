<?php
// min - what the release serves: dist/css/redz-ui.min.css, the stylesheets css/index.css pulls in, squeezed;
// dist/js/redz-ui.min.js, the modules js/index.js pulls in, joined into one ES module, squeezed and given short local
// names; and each package's files the same way, dist/css/redz-ui-NAME.min.css and dist/js/redz-ui-NAME.min.js. The JS scanner - strings, regular expressions and a template's text copied as written, white space kept only
// where two tokens would fuse - and its verdict come from the REDZ ERP's kernel minifier; the CSS pass, the joiner and
// the names are this library's. Every pass proves its result before it is written; the probes run what it writes.

// The at-rules whose block holds rules, and those whose block holds declarations.
const MIN_CSS_RULES = ['media', 'supports', 'container', 'layer', 'starting-style', 'keyframes', 'scope'];
const MIN_CSS_DECLARATIONS = ['font-face', 'property', 'page', 'counter-style', 'view-transition'];

// The words after which a `/` begins a regular expression: none of them can end an expression.
const MIN_JS_BEFORE_REGEXP = ['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'do', 'else', 'case', 'yield', 'await', 'throw'];

// The punctuators of more than one byte, the longest first.
const MIN_JS_PUNCTUATORS = ['>>>=', '...', '===', '!==', '**=', '<<=', '>>=', '>>>', '&&=', '||=', '??=', '=>', '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '**', '<<', '>>'];

// The reserved words of a module, which are never a name.
const MIN_JS_KEYWORDS = ['await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do', 'else', 'enum', 'export', 'extends', 'false', 'finally', 'for', 'function', 'if', 'implements', 'import', 'in', 'instanceof', 'interface', 'let', 'new', 'null', 'package', 'private', 'protected', 'public', 'return', 'static', 'super', 'switch', 'this', 'throw', 'true', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield'];
// Names the pass neither lets a script declare nor gives: their meaning is fixed, or its parse reads them as words.
const MIN_JS_FIXED = ['arguments', 'async', 'eval', 'Infinity', 'NaN', 'of', 'undefined'];
// The words whose `(…)` before a `{` is a statement's head, not a function's parameters.
const MIN_JS_HEADS = ['if', 'for', 'while', 'switch', 'catch', 'with'];
// Names a script may declare but the pass never gives: the words of forms it does not read.
const MIN_JS_CONTEXTUAL = ['as', 'from', 'get', 'set'];

// The byte classes of the C locale, read without the ctype extension.
const MIN_SPACE = " \t\n\r\x0B\x0C";
const MIN_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const MIN_DIGITS = '0123456789';
const MIN_ALNUM = MIN_LETTERS . MIN_DIGITS;

/** Whether $s has bytes and every one is of $set, as the ctype functions read them in the C locale. */
function MIN__Bytes(string $s, string $set): bool
{
	return $s !== '' && strspn($s, $set) === strlen($s);
}

/**
 * A refusal of the text a pass was given: a RuntimeException "REASON at byte N, line L: …the code around it…" whose code
 * is the byte. A fault of the pass's own proof is a LogicException instead.
 */
function MIN__Refuse(string $reason, string $text, int $at): never
{
	$from = max(0, $at - 24);
	$near = substr($text, $from, 48);
	$near = strtr($near, "\r\n\t", '   ');
	$end = min($at, strlen($text));
	$line = substr_count($text, "\n", 0, $end) + 1;
	throw new RuntimeException($reason . ' at byte ' . $at . ', line ' . $line . ': …' . $near . '…', $at);
}

/** Whether $c is a byte of a CSS name. */
function MIN__CssNameByte(string $c): bool
{
	return $c !== '' && (MIN__Bytes($c, MIN_ALNUM) || $c === '-' || $c === '_' || $c === '\\' || ord($c) >= 0x80);
}

/**
 * Whether the white space between $p, the byte written last, and $c, the next, means something - in a declaration
 * block, a selector or an at-rule's prelude. In a selector it is the descendant combinator, also before `:`; an
 * at-rule's prelude keeps it all, as `@supports` keeps its condition's text.
 */
function MIN__CssSpace(string $p, string $c, string $where): bool
{
	if ($p === '' || str_contains('{};,(', $p) || str_contains('{};,)', $c)) {
		return false;
	}
	return match ($where) {
		'declarations' => $p !== ':' && $c !== ':' && $c !== '!',
		'selector' => !str_contains('>+~', $p) && !str_contains('>+~', $c),
		default => true,
	};
}

/** The text of the declaration value after the `:` at $i, up to its `;` or `}` outside strings and brackets. */
function MIN__CssValue(string $css, int $i): string
{
	$n = strlen($css);
	$depth = 0;
	$j = $i + 1;
	while ($j < $n) {
		$c = $css[$j];
		if ($c === '"' || $c === "'") {
			$j++;
			while ($j < $n && $css[$j] !== $c) {
				$j += $css[$j] === '\\' ? 2 : 1;
			}
		} elseif ($c === '(') {
			$depth++;
		} elseif ($c === ')') {
			$depth--;
		} elseif ($depth === 0 && ($c === ';' || $c === '}')) {
			break;
		}
		$j++;
	}
	return substr($css, $i + 1, $j - $i - 1);
}

/**
 * The stylesheet squeezed: comments gone; strings and escapes as written; white space kept only where it means
 * something - and wherever it stood but before a value the engine keeps as written, a custom property's or one with
 * `var()` or `env()`, as Firefox 132 keeps even its trailing space; a declaration block's last `;` dropped. A comment
 * between two names, an unquoted `url(`, a rule nested in declarations and an at-rule not named above stop it.
 */
function MIN__Css(string $css): string
{
	$out = '';
	$n = strlen($css);
	$blocks = ['rules'];
	$opened = [];
	$prelude = 0;
	$declaration = 0;
	$value = -1;
	$verbatim = false;
	$space = false;
	$i = 0;
	while ($i < $n) {
		$c = $css[$i];
		if ($c === '/' && ($css[$i + 1] ?? '') === '*') {
			$end = strpos($css, '*/', $i + 2);
			if ($end === false) {
				MIN__Refuse('an unclosed comment', $css, $i);
			}
			$i = $end + 2;
			if (!$space && MIN__CssNameByte(substr($out, -1)) && MIN__CssNameByte($css[$i] ?? '')) {
				MIN__Refuse('a comment between two names', $css, $i);
			}
			continue;
		}
		if (MIN__Bytes($c, MIN_SPACE)) {
			$space = true;
			$i++;
			continue;
		}
		$block = $blocks[array_key_last($blocks)];
		$where = $block === 'declarations' ? 'declarations' : (($out[$prelude] ?? $c) === '@' ? 'at' : 'selector');
		if ($space && ($verbatim ? strlen($out) > $value || str_contains(';}', $c) : MIN__CssSpace(substr($out, -1), $c, $where))) {
			$out .= ' ';
		}
		$space = false;
		if ($c === '"' || $c === "'") {
			$end = $i + 1;
			while ($end < $n && $css[$end] !== $c) {
				if ($css[$end] === "\n") {
					MIN__Refuse('a string runs past its line', $css, $i);
				}
				$end += $css[$end] === '\\' ? 2 : 1;
			}
			$out .= substr($css, $i, $end + 1 - $i);
			$i = $end + 1;
			continue;
		}
		if ($c === '\\') {
			if (preg_match('~\G\\\\(?:[0-9a-fA-F]{1,6}[ \t\n]?|.)~s', $css, $m, 0, $i) !== 1) {
				MIN__Refuse('a \\ with nothing after it', $css, $i);
			}
			$out .= $m[0];
			$i += strlen($m[0]);
			continue;
		}
		if ($c === '(' && preg_match('~url$~i', $out) === 1 && preg_match('~\G\(\s*["\']~', $css, $m, 0, $i) !== 1) {
			MIN__Refuse('an unquoted url(', $css, $i);
		}
		if ($c === '{') {
			if ($block === 'declarations') {
				MIN__Refuse('a rule nested in declarations', $css, $i);
			}
			$name = preg_match('~^@([\w-]+)~', substr($out, $prelude), $m) === 1 ? strtolower($m[1]) : '';
			$blocks[] = match (true) {
				$name === '', in_array($name, MIN_CSS_DECLARATIONS, true) => 'declarations',
				in_array($name, MIN_CSS_RULES, true) => 'rules',
				default => MIN__Refuse('the at-rule @' . $name . ' is not one this pass knows', $css, $i),
			};
			$out .= '{';
			$opened[] = $i;
			$prelude = $declaration = strlen($out);
			$value = -1;
			$verbatim = false;
			$i++;
			continue;
		}
		if ($c === '}') {
			if (count($blocks) === 1) {
				MIN__Refuse('a } without its {', $css, $i);
			}
			array_pop($opened);
			if (array_pop($blocks) === 'declarations' && str_ends_with($out, ';')) {
				$out = substr($out, 0, -1);
			}
			$out .= '}';
			$prelude = $declaration = strlen($out);
			$value = -1;
			$verbatim = false;
			$i++;
			continue;
		}
		$out .= $c;
		if ($c === ':' && $block === 'declarations' && $value < 0) {
			$value = strlen($out);
			$verbatim = str_starts_with(substr($out, $declaration), '--') || preg_match('~(?<![\w-])(?:var|env)\(~i', MIN__CssValue($css, $i)) === 1;
		} elseif ($c === ';') {
			$prelude = $declaration = strlen($out);
			$value = -1;
			$verbatim = false;
		}
		$i++;
	}
	if (count($blocks) !== 1) {
		MIN__Refuse('a { without its }', $css, (int)end($opened));
	}
	return $out;
}

/** The stylesheet without comments, white space outside strings and a block's last `;` - what squeezing keeps. */
function MIN__CssBare(string $css): string
{
	$bare = (string)preg_replace_callback('~"(?:\\\\.|[^"\\\\\n])*"|\'(?:\\\\.|[^\'\\\\\n])*\'|/\*.*?\*/|\s+~s', fn(array $m): string => $m[0][0] === '"' || $m[0][0] === "'" ? $m[0] : '', $css);
	return str_replace(';}', '}', $bare);
}

/** The squeezed stylesheet, proved: squeezing it again changes nothing, and only comments and white space are gone. */
function MIN__CssSafe(string $css): string
{
	$min = MIN__Css($css);
	if (MIN__Css($min) !== $min) {
		throw new LogicException('the squeezed stylesheet changes when squeezed again');
	}
	if (MIN__CssBare($min) !== MIN__CssBare($css)) {
		throw new LogicException('the squeezed stylesheet differs from its files beyond comments and white space');
	}
	return $min;
}

/** Whether $c is a byte of a JavaScript name. */
function MIN__JsWord(string $c): bool
{
	return $c !== '' && (MIN__Bytes($c, MIN_ALNUM) || $c === '_' || $c === '$' || $c === '\\' || ord($c) >= 0x80);
}

/**
 * Whether $prev and $next written side by side would fuse into a token the source does not have; $lastWord, the run
 * before $prev, tells a number before `.` from a name ending in a digit.
 */
function MIN__JsGlue(string $prev, string $next, string $lastWord): bool
{
	if (MIN__JsWord($prev) && MIN__JsWord($next)) {
		return true;
	}
	if (($prev === '+' || $prev === '-') && $next === $prev) {
		return true;
	}
	if ($prev === '/' && ($next === '/' || $next === '*')) {
		return true;
	}
	if ($prev === '<' && $next === '!') {
		return true;
	}
	return $next === '.' && $lastWord !== '' && MIN__Bytes($lastWord, MIN_DIGITS);
}

/** Whether a `/` after $prev, the last byte written, and the word $lastWord begins a regular expression, not a division. */
function MIN__JsRegexpOk(string $prev, string $lastWord): bool
{
	if ($prev === '' || str_contains('(,=:[!&|?{};+-*/%<>~^', $prev)) {
		return true;
	}
	return MIN__JsWord($prev) && in_array($lastWord, MIN_JS_BEFORE_REGEXP, true);
}

/**
 * One template literal from its backtick at $i: the text as written, each `${…}` scanned as code.
 * @param list<string> $tokens
 * @param list<string> $hazards
 * @return array{string, int} the template and the index past it
 */
function MIN__JsTemplate(string $js, int $i, array &$tokens, array &$hazards): array
{
	$n = strlen($js);
	$opened = $i;
	$out = $js[$i];
	$chunk = $js[$i];
	$i++;
	while ($i < $n) {
		$c = $js[$i];
		if ($c === '\\' && $i + 1 < $n) {
			$out .= $c . $js[$i + 1];
			$chunk .= $c . $js[$i + 1];
			$i += 2;
			continue;
		}
		if ($c === '`') {
			$tokens[] = 'T' . $chunk . $c;
			return [$out . $c, $i + 1];
		}
		if ($c === '$' && ($js[$i + 1] ?? '') === '{') {
			$out .= '${';
			$tokens[] = 'T' . $chunk;
			$tokens[] = 'P${';
			$chunk = '';
			[$code, $inner, $innerHazards, $i] = MIN__JsScan($js, $i + 2, true);
			$out .= $code;
			array_push($tokens, ...$inner);
			array_push($hazards, ...$innerHazards);
			continue;
		}
		$out .= $c;
		$chunk .= $c;
		$i++;
	}
	MIN__Refuse('a template runs to the end of the script', $js, $opened);
}

/**
 * The scanner: the code from $from squeezed onto one line, with the significant tokens it saw and the places where
 * a newline was the only separator that changes the parse when gone. With $inner it stops after the `}` closing the
 * `${` it was called for.
 * @return array{string, list<string>, list<string>, int} [squeezed, tokens, hazards, next index]
 */
function MIN__JsScan(string $js, int $from = 0, bool $inner = false): array
{
	$n = strlen($js);
	$out = '';
	$prev = '';
	$lastWord = '';
	$word = '';
	$tokens = [];
	$hazards = [];
	$depth = 0;
	$gap = false;
	$i = $from;
	$flush = function () use (&$word, &$tokens): void {
		if ($word !== '') {
			$tokens[] = 'W' . $word;
			$word = '';
		}
	};
	while ($i < $n) {
		$c = $js[$i];
		$c2 = $js[$i + 1] ?? '';
		if ($c === '/' && $c2 === '/') {
			$flush();
			$gap = true;
			$i += 2;
			while ($i < $n && $js[$i] !== "\n") {
				$i++;
			}
			continue;
		}
		if ($c === '/' && $c2 === '*') {
			$flush();
			$opened = $i;
			$i += 2;
			while ($i < $n && !($js[$i] === '*' && ($js[$i + 1] ?? '') === '/')) {
				$i++;
			}
			if ($i >= $n) {
				MIN__Refuse('an unclosed comment', $js, $opened);
			}
			$i += 2;
			// A comment can be the only separator: `a/*c*/b` and `a+/*c*/+b` fuse once it is gone.
			if (MIN__JsGlue($prev, $js[$i] ?? '', $lastWord)) {
				$out .= ' ';
			}
			$gap = true;
			continue;
		}
		if ($c === '"' || $c === "'") {
			$flush();
			$literal = $c;
			$opened = $i;
			$closed = false;
			$i++;
			while ($i < $n) {
				$ch = $js[$i];
				if ($ch === '\\' && $i + 1 < $n) {
					$literal .= $ch . $js[$i + 1];
					$i += 2;
					continue;
				}
				if ($ch === "\n") {
					MIN__Refuse('a string runs past its line', $js, $opened);
				}
				$literal .= $ch;
				$i++;
				if ($ch === $c) {
					$closed = true;
					break;
				}
			}
			if (!$closed) {
				MIN__Refuse('a string runs to the end of the script', $js, $opened);
			}
			$out .= $literal;
			$tokens[] = 'S' . $literal;
			$prev = $c;
			$lastWord = '';
			$gap = false;
			continue;
		}
		if ($c === '`') {
			$flush();
			[$literal, $i] = MIN__JsTemplate($js, $i, $tokens, $hazards);
			$out .= $literal;
			$prev = '`';
			$lastWord = '';
			$gap = false;
			continue;
		}
		// After `++` or `--` a `/` divides: a pattern cannot follow them.
		if ($c === '/' && MIN__JsRegexpOk($prev, $lastWord) && !in_array(substr($out, -2), ['++', '--'], true)) {
			$flush();
			$literal = $c;
			$opened = $i;
			$closed = false;
			$i++;
			$class = false;
			while ($i < $n) {
				$ch = $js[$i];
				if ($ch === '\\' && $i + 1 < $n) {
					$literal .= $ch . $js[$i + 1];
					$i += 2;
					continue;
				}
				if ($ch === "\n") {
					MIN__Refuse('a pattern runs past its line', $js, $opened);
				}
				$literal .= $ch;
				$i++;
				if ($ch === '[') {
					$class = true;
				} elseif ($ch === ']') {
					$class = false;
				} elseif ($ch === '/' && !$class) {
					$closed = true;
					break;
				}
			}
			if (!$closed) {
				MIN__Refuse('a pattern runs to the end of the script', $js, $opened);
			}
			while ($i < $n && MIN__Bytes($js[$i], MIN_LETTERS)) {
				$literal .= $js[$i++];
			}
			$out .= $literal;
			$tokens[] = 'R' . $literal;
			$prev = '/';
			$lastWord = '';
			$gap = false;
			continue;
		}
		if ($c === ' ' || $c === "\t" || $c === "\n" || $c === "\r") {
			$flush();
			$j = $i;
			$newline = false;
			while ($j < $n && ($js[$j] === ' ' || $js[$j] === "\t" || $js[$j] === "\n" || $js[$j] === "\r")) {
				$newline = $newline || $js[$j] === "\n";
				$j++;
			}
			$next = $js[$j] ?? '';
			$comment = $next === '/' && (($js[$j + 1] ?? '') === '/' || ($js[$j + 1] ?? '') === '*');
			if (!$comment && MIN__JsGlue($prev, $next, $lastWord)) {
				$out .= ' ';
			}
			// Two expressions a newline alone keeps apart - a literal after a literal or a name - become one once joined.
			if ($newline && ($next === "'" || $next === '"' || $next === '`') && (str_contains(')]}\'"`', $prev) && $prev !== '' || MIN__JsWord($prev))) {
				$hazards[] = [$j, substr($out, -60)];
			}
			$gap = true;
			$i = $j;
			continue;
		}
		if ($c === '}' && $inner && $depth === 0) {
			$flush();
			$tokens[] = 'P}';
			return [$out . $c, $tokens, $hazards, $i + 1];
		}
		if ($c === '{') {
			$depth++;
		} elseif ($c === '}' && $depth > 0) {
			$depth--;
		}
		if (MIN__JsWord($c)) {
			if ($gap || !MIN__JsWord($prev)) {
				$lastWord = '';
			}
			$word .= $c;
			$lastWord .= $c;
		} else {
			$flush();
			$tokens[] = 'P' . $c;
			$lastWord = '';
		}
		$out .= $c;
		$prev = $c;
		$gap = false;
		$i++;
	}
	$flush();
	return [trim($out), $tokens, $hazards, $i];
}

/**
 * The script squeezed onto one line, proved: no newline it removes changes the parse, scanning the result again
 * changes nothing, its tokens are the source's, and it is not empty or longer.
 */
function MIN__JsSafe(string $js): string
{
	[$min, $tokens, $hazards] = MIN__JsScan($js);
	if ($hazards !== []) {
		MIN__Refuse('a newline is the only separator at ' . count($hazards) . ' place(s) - add the operator or `;` it lacks', $js, $hazards[0][0]);
	}
	if (trim($js) !== '' && $min === '') {
		MIN__Refuse('the squeezed script is empty', $js, 0);
	}
	if (strlen($min) > strlen($js)) {
		throw new LogicException('the squeezed script grew');
	}
	[$again, $againTokens] = MIN__JsScan($min);
	if ($again !== $min) {
		throw new LogicException('the squeezed script changes when scanned again');
	}
	if ($againTokens !== $tokens) {
		$at = 0;
		while (($tokens[$at] ?? null) === ($againTokens[$at] ?? null)) {
			$at++;
		}
		throw new LogicException('the squeezed script\'s tokens differ at #' . $at . ' (' . substr($tokens[$at] ?? '<end>', 0, 40) . ' → ' . substr($againTokens[$at] ?? '<end>', 0, 40) . ')');
	}
	return $min;
}

/**
 * The modules $files, paths under $root each after those it imports, as one ES module: a module that exports runs in
 * a function returning its exports, any other in a block, and each starts by reading what it imports. Only `import
 * {a, b} from './x.js'`, `import './x.js'` - or from a folder beside, '../js/x.js' -, `export const` and `import.meta`
 * are taken; any other form, or two modules of one name, stops the build.
 * @param list<string> $files
 */
function MIN__JsJoin(string $root, array $files): string
{
	$holder = fn(string $module): string => 'REDZ_UI_' . preg_replace('~\W~', '_', $module);
	$all = implode("\n", array_map(fn(string $file): string => (string)file_get_contents($root . '/' . $file), $files));
	$named = array_count_values(array_map(fn(string $file): string => basename($file, '.js'), $files));
	if (max($named) > 1) {
		throw new RuntimeException('two modules are named ' . array_search(max($named), $named, true) . '.js, which the joiner tells apart by name alone');
	}
	$exports = [];
	$parts = [];
	foreach ($files as $file) {
		$own = $holder(basename($file, '.js'));
		if (str_contains($all, $own)) {
			throw new RuntimeException('a module uses the name ' . $own . ', which the joiner gives the exports of ' . $file);
		}
		$reads = [];
		$names = [];
		$body = [];
		foreach (explode("\n", (string)file_get_contents($root . '/' . $file)) as $line) {
			if (preg_match('~^import \{([\w, ]+)} from \'(?:\./|\.\./[\w-]+/)([\w-]+)\.js\';$~', $line, $m) === 1) {
				$wanted = array_map('trim', explode(',', $m[1]));
				$missing = array_diff($wanted, $exports[$holder($m[2])] ?? []);
				if ($missing !== []) {
					throw new RuntimeException($file . ' imports ' . implode(', ', $missing) . ' from ./' . $m[2] . '.js, which comes later or does not export it');
				}
				$reads[] = 'const {' . implode(', ', $wanted) . '} = ' . $holder($m[2]) . ';';
				continue;
			}
			if (preg_match('~^import \'(?:\./|\.\./[\w-]+/)[\w-]+\.js\';$~', $line) === 1) {
				continue;
			}
			if (preg_match('~^export const (\w+)~', $line, $m) === 1) {
				$names[] = $m[1];
				$line = substr($line, strlen('export '));
			}
			$body[] = $line;
		}
		$code = implode("\n", $reads) . "\n" . implode("\n", $body);
		$tokens = MIN__JsScan($code)[1];
		foreach ($tokens as $k => $token) {
			if ($token === 'Wexport' || ($token === 'Wimport' && ($tokens[$k + 1] ?? '') !== 'P.')) {
				throw new RuntimeException($file . ' has an import or an export the joiner does not take: only import {…} from \'./x.js\', import \'./x.js\', export const and import.meta');
			}
		}
		$exports[$own] = $names;
		$parts[] = $names === [] ? "{\n" . $code . "\n}" : 'const ' . $own . " = (() => {\n" . $code . "\nreturn {" . implode(', ', $names) . "};\n})();";
	}
	return implode("\n", $parts) . "\n";
}

/**
 * The tokens of a squeezed script, [kind, text]: name, number, string, template - a template's text from its backtick
 * or the `}` ending an interpolation to the next `${` or backtick -, regexp and punctuator. A `/` after `}` stops it:
 * the end of a block and of an object read it differently.
 * @return list<array{string, string}>
 */
function MIN__JsLex(string $js): array
{
	$tokens = [];
	$n = strlen($js);
	$depths = [];
	$i = 0;
	while ($i < $n) {
		$c = $js[$i];
		if (MIN__Bytes($c, MIN_SPACE)) {
			$i++;
			continue;
		}
		// Comments, for a script as written: a squeezed one has none, as the squeezer keeps `/ /` apart.
		if ($c === '/' && ($js[$i + 1] ?? '') === '/') {
			$end = strpos($js, "\n", $i);
			$i = $end === false ? $n : $end;
			continue;
		}
		if ($c === '/' && ($js[$i + 1] ?? '') === '*') {
			$end = strpos($js, '*/', $i + 2);
			if ($end === false) {
				MIN__Refuse('an unclosed comment', $js, $i);
			}
			$i = $end + 2;
			continue;
		}
		[$lastKind, $lastText] = $tokens === [] ? ['', ''] : $tokens[count($tokens) - 1];
		if (preg_match('~\G[A-Za-z_$][\w$]*~', $js, $m, 0, $i) === 1) {
			$tokens[] = ['name', $m[0], $i];
			$i += strlen($m[0]);
			continue;
		}
		// A class's private name: classes stop the names pass, so only the block check reads one.
		if ($c === '#' && preg_match('~\G#[A-Za-z_$][\w$]*~', $js, $m, 0, $i) === 1) {
			$tokens[] = ['private', $m[0], $i];
			$i += strlen($m[0]);
			continue;
		}
		if (MIN__Bytes($c, MIN_DIGITS) || ($c === '.' && MIN__Bytes($js[$i + 1] ?? '', MIN_DIGITS))) {
			preg_match('~\G(?:0[xXoObB][\da-fA-F_]+|(?:\d[\d_]*\.?[\d_]*|\.\d[\d_]*)(?:[eE][+-]?\d[\d_]*)?)n?~', $js, $m, 0, $i);
			$tokens[] = ['number', $m[0], $i];
			$i += strlen($m[0]);
			continue;
		}
		if ($c === '"' || $c === "'") {
			$end = $i + 1;
			while ($end < $n && $js[$end] !== $c) {
				$end += $js[$end] === '\\' ? 2 : 1;
			}
			$tokens[] = ['string', substr($js, $i, $end + 1 - $i), $i];
			$i = $end + 1;
			continue;
		}
		if ($c === '`' || ($c === '}' && $depths !== [] && $depths[count($depths) - 1] === 0)) {
			if ($c === '}') {
				array_pop($depths);
			}
			$end = $i + 1;
			while ($end < $n && $js[$end] !== '`' && !($js[$end] === '$' && ($js[$end + 1] ?? '') === '{')) {
				$end += $js[$end] === '\\' ? 2 : 1;
			}
			if ($end >= $n) {
				MIN__Refuse('a template runs to the end of the script', $js, $i);
			}
			if ($js[$end] === '$') {
				$depths[] = 0;
				$end += 2;
			} else {
				$end++;
			}
			$tokens[] = ['template', substr($js, $i, $end - $i), $i];
			$i = $end;
			continue;
		}
		if ($c === '/' && $lastKind === 'punctuator' && $lastText === '}') {
			MIN__Refuse('a / after }: the end of a block and of an object read it differently', $js, $i);
		}
		$regexp = $lastKind === '' || ($lastKind === 'punctuator' && !in_array($lastText, [')', ']', '++', '--'], true)) || ($lastKind === 'name' && in_array($lastText, MIN_JS_BEFORE_REGEXP, true)) || ($lastKind === 'template' && str_ends_with($lastText, '${'));
		if ($c === '/' && $regexp) {
			$end = $i + 1;
			$class = false;
			while ($end < $n && ($js[$end] !== '/' || $class)) {
				if ($js[$end] === '\\') {
					$end++;
				} elseif ($js[$end] === '[') {
					$class = true;
				} elseif ($js[$end] === ']') {
					$class = false;
				}
				$end++;
			}
			$end++;
			while ($end < $n && MIN__Bytes($js[$end], MIN_LETTERS)) {
				$end++;
			}
			$tokens[] = ['regexp', substr($js, $i, $end - $i), $i];
			$i = $end;
			continue;
		}
		foreach (MIN_JS_PUNCTUATORS as $punctuator) {
			if (substr($js, $i, strlen($punctuator)) === $punctuator && !($punctuator === '?.' && MIN__Bytes($js[$i + 2] ?? '', MIN_DIGITS))) {
				$tokens[] = ['punctuator', $punctuator, $i];
				$i += strlen($punctuator);
				continue 2;
			}
		}
		if (!str_contains('{}()[];,<>+-*/%&|^!~?:=.', $c)) {
			MIN__Refuse('the byte 0x' . bin2hex($c) . ' is not one this reader takes outside strings and comments', $js, $i);
		}
		if ($depths !== [] && ($c === '{' || $c === '}')) {
			$depths[count($depths) - 1] += $c === '{' ? 1 : -1;
		}
		$tokens[] = ['punctuator', $c, $i];
		$i++;
	}
	return $tokens;
}

/**
 * The names of a squeezed script's tokens: which declaration each name token uses - by the scopes of `const`, `let`,
 * `var`, functions and their parameters, classes, `catch`, `for` heads and blocks - and which names are free, the page's
 * globals. A `var` and a function declared at a function's top level bind in its body, a `var` of a parameter's name is
 * the parameter, and the body is a scope of its own when the parameters hold expressions, which never see it. A `var`
 * or a function declared at the script's top level keeps its name, as a script shares it: it reads as a free name. A
 * function or class expression's own name is in a scope between the outside and its parameters or body. A property, an
 * object key, a class member's name, a label or a word of the language is no use; a shorthand `{a}` is one, which the
 * names pass writes out as `{a:x}`; `arguments` in a function that is not an arrow and `yield` in a generator are words.
 * `eval`, `with`, `import`, `export`, a function declared in a block or right in a statement, a `var` within the reach
 * of a `let`, `const`, `class` or `catch` of its name, `arguments` outside any function and `yield` outside a
 * generator, and a `for` or `catch` body without braces stop it.
 * @param list<array{string, string}> $tokens
 * @return array{uses: array<int, int>, shorthand: array<int, true>, counts: list<int>, scopes: list<?int>, names: list<array<string, int>>, free: array<string, true>}
 */
function MIN__JsScopes(array $tokens): array
{
	$count = count($tokens);
	$match = [];
	$open = [];
	foreach ($tokens as $t => [$kind, $text]) {
		$closes = ($kind === 'punctuator' && in_array($text, [')', ']', '}'], true)) || ($kind === 'template' && $text[0] === '}');
		$opens = ($kind === 'punctuator' && in_array($text, ['(', '[', '{'], true)) || ($kind === 'template' && str_ends_with($text, '${'));
		if ($closes) {
			if ($open === []) {
				throw new RuntimeException('a ' . $text[0] . ' without its opening', $t);
			}
			$match[array_pop($open)] = $t;
		}
		if ($opens) {
			$open[] = $t;
		}
	}
	if ($open !== []) {
		throw new RuntimeException('a bracket without its closing', (int)end($open));
	}
	// Each scope's parent, names, kind - program, function, arrow, body, static (a class's static block), name, block -
	// and whether it is a generator's.
	$scopes = [null];
	$names = [[]];
	$kinds = ['program'];
	$gens = [false];
	$counts = [];
	$binds = [];
	$uses = [];
	$shorthand = [];
	$refs = [];
	// The var statements: [name, the scope of the statement, token, the scope it binds in]; the names kept at the top.
	$sites = [];
	$tops = [];
	$stack = [['type' => 'program', 'scope' => 0, 'bind' => 0, 'pos' => '', 'ternary' => 0, 'decl' => null, 'case' => false, 'body' => true, 'bk' => 'lexical', 'site' => 0, 'exprs' => false, 'gen' => false]];
	$fn = null;
	$fnExprs = false;
	$head = null;
	$colon = false;
	$colonAt = -1;
	$labelAt = -1;
	$label = false;
	// The functions declared in a block: [name, the block's scope, token].
	$blocked = [];
	$pending = null;
	$klass = null;
	$static = false;
	$scope = function (int $parent, string $kind = 'block', bool $gen = false) use (&$scopes, &$names, &$kinds, &$gens): int {
		$scopes[] = $parent;
		$names[] = [];
		$kinds[] = $kind;
		$gens[] = $gen;
		return count($scopes) - 1;
	};
	$declare = function (int $in, int $t, string $as = 'lexical') use (&$names, &$counts, &$uses, &$binds, $tokens): void {
		$name = $tokens[$t][1];
		if (in_array($name, MIN_JS_KEYWORDS, true) || in_array($name, MIN_JS_FIXED, true)) {
			throw new RuntimeException('the word ' . $name . ' is declared', $t);
		}
		$id = $names[$in][$name] ?? null;
		if ($id !== null) {
			if (in_array($as, ['var', 'function'], true) && in_array($binds[$id], ['var', 'function', 'param'], true)) {
				$uses[$t] = $id;
				return;
			}
			throw new RuntimeException(in_array($as, ['var', 'function'], true) || in_array($binds[$id], ['var', 'function'], true) ? 'a var or a function and a let, const, class or parameter of the name ' . $name . ' in one scope' : 'the name ' . $name . ' is declared twice in one scope', $t);
		}
		$counts[] = 0;
		$binds[] = $as;
		$names[$in][$name] = count($counts) - 1;
		$uses[$t] = count($counts) - 1;
	};
	// A var or a function declared at a function's top level: in the body, as the parameter of its name, or kept at the top.
	$hoist = function (int $t, int $site, string $as) use (&$names, &$uses, &$binds, &$refs, &$tops, &$sites, &$kinds, &$scopes, $tokens, $declare): void {
		$name = $tokens[$t][1];
		$target = $site;
		while ($kinds[$target] === 'block') {
			$target = $scopes[$target];
		}
		if ($as === 'var') {
			$sites[] = [$name, $site, $t, $target];
		}
		if ($target === 0) {
			$tops[$name] ??= $t;
			$refs[] = [$t, 0];
			return;
		}
		$params = $kinds[$target] === 'body' ? $scopes[$target] : $target;
		$id = $names[$params][$name] ?? null;
		if ($params !== $target && $id !== null && $binds[$id] === 'param') {
			$uses[$t] = $id;
			return;
		}
		$declare($target, $t, $as);
	};
	// Whether a scope is in a function that is not an arrow, or a generator, before a class's static block or the top.
	$within = function (int $from, bool $generator) use (&$kinds, &$scopes, &$gens): bool {
		for ($s = $from; $s !== null; $s = $scopes[$s]) {
			if ($kinds[$s] === 'function') {
				return !$generator || $gens[$s];
			}
			if ($kinds[$s] === 'static' || $kinds[$s] === 'program' || ($generator && $kinds[$s] === 'arrow')) {
				return false;
			}
		}
		return false;
	};
	$push = function (array $context) use (&$stack): void {
		$stack[] = $context + ['pos' => '', 'ternary' => 0, 'decl' => null, 'case' => false, 'body' => false, 'bk' => 'lexical', 'site' => $context['scope'], 'exprs' => false, 'gen' => false];
	};
	// Ends the arrows a `,` or a `;` closes; the index of the bracket on top then.
	$arrows = function () use (&$stack): int {
		while ($stack[count($stack) - 1]['type'] === 'arrow') {
			array_pop($stack);
		}
		return count($stack) - 1;
	};
	// Marks the parameters a default or a computed key stands in: their function's body is a scope of its own.
	$exprs = function (int $k) use (&$stack): void {
		while ($k > 0 && in_array($stack[$k]['type'], ['arrpat', 'objpat'], true)) {
			$k--;
		}
		if ($stack[$k]['type'] === 'params') {
			$stack[$k]['exprs'] = true;
		}
	};
	for ($t = 0; $t < $count; $t++) {
		[$kind, $text] = $tokens[$t];
		$prev = $tokens[$t - 1][1] ?? '';
		$next = $tokens[$t + 1][1] ?? '';
		$nextKind = $tokens[$t + 1][0] ?? '';
		$k = count($stack) - 1;
		$top = $stack[$k];
		$type = $top['type'];
		$pos = $top['pos'];
		$declPos = $top['decl']['pos'] ?? '';
		$caseColon = $colon;
		$colon = false;
		if ($fn !== null && $text !== '=>' && $text !== '{') {
			throw new RuntimeException('parameters without their => or body', $t);
		}
		if ($pending !== null && $text !== '(') {
			throw new RuntimeException('a function without its parameters', $t);
		}
		if ($kind === 'name' || $kind === 'private') {
			if ($prev === '.' || $prev === '?.') {
				continue;
			}
			if ($type === 'class' && $pos === 'key') {
				$member = in_array($nextKind, ['name', 'string', 'number', 'private'], true) || $next === '[' || $next === '*';
				if ($kind === 'name' && (($text === 'static' && ($member || $next === '{')) || (in_array($text, ['get', 'set', 'async'], true) && $member))) {
					$static = $text === 'static' && $next === '{';
					continue;
				}
				$stack[$k]['pos'] = $next === '(' ? 'method' : 'field';
				continue;
			}
			if ($kind === 'private') {
				continue;
			}
			if (($type === 'object' || $type === 'objpat') && $pos === 'key') {
				if ($type === 'object' && in_array($text, ['get', 'set', 'async'], true) && (in_array($nextKind, ['name', 'string', 'number'], true) || $next === '[' || $next === '*')) {
					continue;
				}
				if ($next === ':') {
					$stack[$k]['pos'] = 'colon';
				} elseif ($next === '(' && $type === 'object') {
					$stack[$k]['pos'] = 'method';
				} elseif ($next === ',' || $next === '}' || $next === '=') {
					$shorthand[$t] = true;
					if ($type === 'objpat') {
						$top['bk'] === 'var' ? $hoist($t, $top['site'], 'var') : $declare($top['bind'], $t, $top['bk']);
					} else {
						$refs[] = [$t, $top['scope']];
					}
					$stack[$k]['pos'] = 'after';
				} else {
					throw new RuntimeException('the key ' . $text . ' before ' . $next . ' is not read here', $t);
				}
				continue;
			}
			if (in_array($text, MIN_JS_KEYWORDS, true)) {
				// import.meta declares and reads no name: the module's own address.
				if ($text === 'import' && $next === '.' && ($tokens[$t + 2][1] ?? '') === 'meta') {
					continue;
				}
				if (in_array($text, ['with', 'import', 'export', 'enum'], true)) {
					throw new RuntimeException($text . ' is not read by the names pass', $t);
				}
				if ($text === 'yield') {
					if (!$within($top['scope'], true)) {
						throw new RuntimeException('yield outside a generator', $t);
					}
					continue;
				}
				if (($text === 'break' || $text === 'continue') && $nextKind === 'name') {
					$t++;
					continue;
				}
				if ($text === 'function' || $text === 'class') {
					$at = $prev === 'async' && $text === 'function' ? $t - 2 : $t - 1;
					$before = $tokens[$at][1] ?? '';
					$statement = in_array($type, ['program', 'block'], true) && ($at < 0 || in_array($before, ['', ';', '{', '}', ')', 'else', 'do'], true) || $at === $colonAt || $at === $labelAt);
					$gen = $text === 'function' && $next === '*';
					$last = $gen ? $t + 1 : $t;
					$named = ($tokens[$last + 1][0] ?? '') === 'name' && ($tokens[$last + 1][1] ?? '') !== 'extends';
					if ($statement && $text === 'function' && (in_array($before, [')', 'else', 'do'], true) || ($at >= 0 && $at === $labelAt))) {
						throw new RuntimeException('a function declared right in a statement or under a label', $t);
					}
					if ($statement && !$named) {
						throw new RuntimeException('a ' . $text . ' declared without its name', $t);
					}
					$inner = $top['scope'];
					if ($statement && $text === 'function' && $top['body']) {
						$hoist($last + 1, $top['scope'], 'function');
					} elseif ($statement && $text === 'function') {
						$declare($top['scope'], $last + 1, 'block');
						$blocked[] = [$tokens[$last + 1][1], $top['scope'], $last + 1];
					} elseif ($statement) {
						$declare($top['scope'], $last + 1);
					} elseif ($named) {
						$inner = $scope($top['scope'], 'name');
						$declare($inner, $last + 1, 'name');
					}
					if ($text === 'function') {
						$pending = ['parent' => $inner, 'gen' => $gen];
					} else {
						$klass = ['scope' => $inner, 'depth' => count($stack)];
					}
					$t = $named ? $last + 1 : $last;
					continue;
				}
				if ($text === 'const' || $text === 'let' || $text === 'var') {
					if (!in_array($type, ['program', 'block', 'forhead'], true)) {
						throw new RuntimeException($text . ' outside a block', $t);
					}
					$stack[$k]['decl'] = ['scope' => $top['scope'], 'pos' => 'binding', 'var' => $text === 'var'];
				} elseif ($text === 'case' || ($text === 'default' && $next === ':')) {
					$stack[$k]['case'] = true;
				} elseif ($text === 'in' && $type === 'forhead' && $declPos === 'after') {
					$stack[$k]['decl'] = null;
				}
				continue;
			}
			if ($text === 'of' && $type === 'forhead' && $declPos === 'after') {
				$stack[$k]['decl'] = null;
				continue;
			}
			if ($text === 'async' && ($next === '(' || $next === 'function' || ($nextKind === 'name' && ($tokens[$t + 2][1] ?? '') === '=>'))) {
				continue;
			}
			if ($text === 'eval') {
				throw new RuntimeException('eval is not read by the names pass', $t);
			}
			if ($text === 'arguments') {
				if (!$within($top['scope'], false)) {
					throw new RuntimeException('arguments outside a function that is not an arrow', $t);
				}
				continue;
			}
			if ($next === ':' && in_array($type, ['program', 'block'], true) && $top['ternary'] === 0 && !$top['case'] && $declPos === '') {
				$label = true;
				continue;
			}
			if ($next === '=>') {
				$fn = $scope($top['scope'], 'arrow');
				$fnExprs = false;
				$declare($fn, $t, 'param');
				continue;
			}
			if (in_array($type, ['params', 'arrpat', 'objpat', 'catch'], true) && $pos === 'binding') {
				$top['bk'] === 'var' ? $hoist($t, $top['site'], 'var') : $declare($top['bind'], $t, $top['bk']);
				$stack[$k]['pos'] = 'after';
				continue;
			}
			if ($declPos === 'binding') {
				$top['decl']['var'] ? $hoist($t, $top['decl']['scope'], 'var') : $declare($top['decl']['scope'], $t);
				$stack[$k]['decl']['pos'] = 'after';
				continue;
			}
			$refs[] = [$t, $top['scope']];
			continue;
		}
		if ($kind === 'string' || $kind === 'number') {
			if ($type === 'class' && $pos === 'key') {
				$stack[$k]['pos'] = $next === '(' ? 'method' : 'field';
			} elseif (($type === 'object' || $type === 'objpat') && $pos === 'key') {
				$stack[$k]['pos'] = $next === '(' ? 'method' : 'colon';
			}
			continue;
		}
		if ($kind === 'template') {
			if ($text[0] === '}') {
				$arrows();
				if (array_pop($stack)['type'] !== 'tpl') {
					throw new RuntimeException('a template\'s } out of place', $t);
				}
			}
			if (str_ends_with($text, '${')) {
				$k = count($stack) - 1;
				$push(['type' => 'tpl', 'scope' => $stack[$k]['scope'], 'bind' => $stack[$k]['bind']]);
			}
			continue;
		}
		if ($kind !== 'punctuator') {
			continue;
		}
		$binding = (in_array($type, ['params', 'arrpat', 'objpat', 'catch'], true) && $pos === 'binding') || $declPos === 'binding';
		// A pattern opened here binds as its declaration or the pattern around it does.
		$pattern = $declPos === 'binding' ? ['bind' => $top['decl']['scope'], 'bk' => $top['decl']['var'] ? 'var' : 'lexical', 'site' => $top['decl']['scope']] : ['bind' => $top['bind'], 'bk' => $top['bk'], 'site' => $top['site']];
		switch ($text) {
			case '{':
				if ($fn !== null) {
					$body = $fnExprs ? $scope($fn, 'body') : $fn;
					$push(['type' => 'block', 'scope' => $body, 'bind' => $body, 'body' => true]);
					$fn = null;
				} elseif ($static && $type === 'class') {
					$static = false;
					$inner = $scope($top['scope'], 'static');
					$push(['type' => 'block', 'scope' => $inner, 'bind' => $inner, 'body' => true]);
				} elseif ($klass !== null && count($stack) === $klass['depth']) {
					$push(['type' => 'class', 'scope' => $klass['scope'], 'bind' => $klass['scope'], 'pos' => 'key']);
					$klass = null;
				} elseif ($binding) {
					$push(['type' => 'objpat', 'scope' => $top['scope'], 'pos' => 'key'] + $pattern);
					if ($declPos === 'binding') {
						$stack[$k]['decl']['pos'] = 'after';
					} else {
						$stack[$k]['pos'] = 'after';
					}
				} elseif ($prev === ')' || in_array($prev, ['else', 'try', 'catch', 'finally', 'do'], true) || $caseColon || (($type === 'program' || $type === 'block') && in_array($prev, ['', ';', '{', '}'], true))) {
					$block = $scope($head ?? $top['scope']);
					$head = null;
					$push(['type' => 'block', 'scope' => $block, 'bind' => $block]);
				} else {
					$push(['type' => 'object', 'scope' => $top['scope'], 'bind' => $top['bind'], 'pos' => 'key']);
				}
				break;
			case '[':
				if ($binding) {
					$push(['type' => 'arrpat', 'scope' => $top['scope'], 'pos' => 'binding'] + $pattern);
					if ($declPos === 'binding') {
						$stack[$k]['decl']['pos'] = 'after';
					} else {
						$stack[$k]['pos'] = 'after';
					}
				} else {
					if (in_array($type, ['object', 'objpat', 'class'], true) && $pos === 'key') {
						$stack[$k]['pos'] = $type === 'class' ? 'computed' : 'colon';
						if ($type === 'objpat') {
							$exprs($k);
						}
					}
					$push(['type' => 'array', 'scope' => $top['scope'], 'bind' => $top['bind']]);
				}
				break;
			case '(':
				if ($pending !== null) {
					$inner = $scope($pending['parent'], 'function', $pending['gen']);
					$push(['type' => 'params', 'scope' => $inner, 'bind' => $inner, 'pos' => 'binding', 'bk' => 'param']);
					$pending = null;
				} elseif (($prev === 'for' || $prev === 'catch' || ($prev === 'await' && ($tokens[$t - 2][1] ?? '') === 'for')) && !in_array($tokens[$t - ($prev === 'await' ? 3 : 2)][1] ?? '', ['.', '?.'], true)) {
					$inner = $scope($top['scope']);
					$push(['type' => $prev === 'catch' ? 'catch' : 'forhead', 'scope' => $inner, 'bind' => $inner, 'pos' => $prev === 'catch' ? 'binding' : '']);
				} elseif (($tokens[$match[$t] + 1][1] ?? '') === '=>' || ($type === 'object' && ($pos === 'method' || ($pos === 'colon' && $prev === ']'))) || ($type === 'class' && in_array($pos, ['method', 'computed'], true))) {
					$arrow = ($tokens[$match[$t] + 1][1] ?? '') === '=>';
					if ($type === 'object' && !$arrow) {
						$stack[$k]['pos'] = 'after';
					} elseif ($type === 'class' && !$arrow) {
						$stack[$k]['pos'] = 'key';
					}
					$inner = $scope($top['scope'], $arrow ? 'arrow' : 'function', !$arrow && $top['gen']);
					$stack[$k]['gen'] = false;
					$push(['type' => 'params', 'scope' => $inner, 'bind' => $inner, 'pos' => 'binding', 'bk' => 'param']);
				} elseif ($type === 'object' && $pos === 'colon') {
					throw new RuntimeException('a ( after a key and before its :', $t);
				} else {
					$push(['type' => 'paren', 'scope' => $top['scope'], 'bind' => $top['bind']]);
				}
				break;
			case '}':
			case ']':
			case ')':
				$arrows();
				$closed = array_pop($stack);
				if ($stack === [] || $closed['type'] === 'tpl') {
					throw new RuntimeException('a ' . $text . ' out of place', $t);
				}
				if ($closed['type'] === 'params') {
					$fn = $closed['scope'];
					$fnExprs = $closed['exprs'];
				} elseif ($closed['type'] === 'forhead' || $closed['type'] === 'catch') {
					if ($next !== '{') {
						throw new RuntimeException('a for or catch body without braces', $t);
					}
					$head = $closed['scope'];
				}
				break;
			case ',':
				$k = $arrows();
				if (in_array($stack[$k]['type'], ['params', 'arrpat'], true)) {
					$stack[$k]['pos'] = 'binding';
				} elseif (in_array($stack[$k]['type'], ['object', 'objpat'], true)) {
					$stack[$k]['pos'] = 'key';
				}
				if ($stack[$k]['decl'] !== null) {
					$stack[$k]['decl']['pos'] = 'binding';
				}
				break;
			case ';':
				$k = $arrows();
				$stack[$k]['decl'] = null;
				$stack[$k]['ternary'] = 0;
				if ($stack[$k]['type'] === 'class') {
					$stack[$k]['pos'] = 'key';
				}
				break;
			case '=':
				if (in_array($type, ['params', 'arrpat', 'objpat', 'catch'], true) && $pos === 'after') {
					$stack[$k]['pos'] = 'expr';
					$exprs($k);
				} elseif ($type === 'object' && $pos === 'after') {
					$stack[$k]['pos'] = 'value';
				} elseif ($type === 'class' && in_array($pos, ['field', 'computed'], true)) {
					$stack[$k]['pos'] = 'value';
				}
				if ($declPos === 'after') {
					$stack[$k]['decl']['pos'] = 'expr';
				}
				break;
			case '=>':
				if ($fn === null) {
					throw new RuntimeException('=> without parameters', $t);
				}
				if ($next !== '{') {
					$push(['type' => 'arrow', 'scope' => $fn, 'bind' => $fn]);
					$fn = null;
				}
				break;
			case '*':
				if (in_array($type, ['object', 'class'], true) && $pos === 'key') {
					$stack[$k]['gen'] = true;
				}
				break;
			case '?':
				$stack[$k]['ternary']++;
				break;
			case ':':
				while ($stack[count($stack) - 1]['type'] === 'arrow' && $stack[count($stack) - 1]['ternary'] === 0) {
					array_pop($stack);
				}
				$k = count($stack) - 1;
				if ($label) {
					$label = false;
					$colon = true;
					$labelAt = $t;
				} elseif ($stack[$k]['ternary'] > 0) {
					$stack[$k]['ternary']--;
				} elseif ($stack[$k]['type'] === 'object' && $stack[$k]['pos'] === 'colon') {
					$stack[$k]['pos'] = 'value';
				} elseif ($stack[$k]['type'] === 'objpat' && $stack[$k]['pos'] === 'colon') {
					$stack[$k]['pos'] = 'binding';
				} elseif ($stack[$k]['case']) {
					$stack[$k]['case'] = false;
					$colon = true;
					$colonAt = $t;
				} else {
					throw new RuntimeException('a stray :', $t);
				}
				break;
			case '...':
				if (in_array($type, ['params', 'arrpat', 'objpat'], true) && ($pos === 'binding' || $pos === 'key')) {
					$stack[$k]['pos'] = 'binding';
				} elseif ($type === 'object' && $pos === 'key') {
					$stack[$k]['pos'] = 'value';
				}
				break;
		}
	}
	if (count($stack) !== 1 || $fn !== null || $pending !== null || $klass !== null) {
		throw new RuntimeException('the script ends inside a bracket, a function or a class', max(0, $count - 1));
	}
	foreach ($tops as $name => $t) {
		if (isset($names[0][$name])) {
			throw new RuntimeException('a var or a function and a let, const or class of the name ' . $name . ' at the top', $t);
		}
	}
	foreach ($sites as [$name, $site, $t, $target]) {
		for ($s = $site; $s !== $target; $s = $scopes[$s]) {
			if (isset($names[$s][$name])) {
				throw new RuntimeException('a var in the reach of a let, const, class or catch of the name ' . $name, $t);
			}
		}
	}
	$free = [];
	// The scopes each reference passed before it found its declaration, the one it found included.
	$passed = [];
	foreach ($refs as [$t, $from]) {
		$name = $tokens[$t][1];
		$uses[$t] = -1;
		$passed[$t] = [];
		for ($s = $from; $s !== null; $s = $scopes[$s]) {
			$passed[$t][$s] = true;
			if (isset($names[$s][$name])) {
				$uses[$t] = $names[$s][$name];
				break;
			}
		}
		if ($uses[$t] === -1) {
			$free[$name] = true;
		}
	}
	// A script also binds a function declared in a block in the function around it, where a module does not: a name read
	// there, outside the block, would read another thing in each.
	foreach ($blocked as [$name, $block, $at]) {
		$target = $block;
		while ($kinds[$target] === 'block') {
			$target = $scopes[$target];
		}
		foreach ($refs as [$t]) {
			if ($tokens[$t][1] === $name && isset($passed[$t][$target])) {
				throw new RuntimeException('the function ' . $name . ' declared in a block is read outside it, where a script reads it and a module does not', $t);
			}
		}
	}
	foreach ($uses as $use) {
		if ($use >= 0) {
			$counts[$use]++;
		}
	}
	ksort($uses);
	return ['uses' => $uses, 'shorthand' => $shorthand, 'counts' => $counts, 'scopes' => $scopes, 'names' => $names, 'free' => $free];
}

/** The $i-th short name: a byte of $first, then bytes of $rest. */
function MIN__JsName(int $i, array $first, array $rest): string
{
	$name = $first[$i % count($first)];
	$i = intdiv($i, count($first));
	while ($i > 0) {
		$i--;
		$name .= $rest[$i % count($rest)];
		$i = intdiv($i, count($rest));
	}
	return $name;
}

/**
 * The squeezed script with short local names. As esbuild does, a scope's declarations take slots after its parent's,
 * so a name never hides one from outside it, sibling scopes share slots, and the most used slot gets the shortest
 * name; names are spelled with the bytes the rest of the script uses most, and none is a free name or a reserved
 * word. Properties, keys and free names stay; a shorthand is written out.
 */
function MIN__JsNames(string $min): string
{
	$tokens = MIN__JsLex($min);
	try {
		$a = MIN__JsScopes($tokens);
	} catch (RuntimeException $e) {
		MIN__Refuse($e->getMessage(), $min, $tokens[$e->getCode()][2] ?? strlen($min));
	}
	$base = [];
	$slot = [];
	foreach ($a['scopes'] as $s => $parent) {
		$base[$s] = $parent === null ? 0 : $base[$parent] + count($a['names'][$parent]);
		$ids = array_values($a['names'][$s]);
		usort($ids, fn(int $x, int $y): int => [$a['counts'][$y], $x] <=> [$a['counts'][$x], $y]);
		foreach ($ids as $j => $id) {
			$slot[$id] = $base[$s] + $j;
		}
	}
	$weight = [];
	foreach ($slot as $id => $s) {
		$weight[$s] = ($weight[$s] ?? 0) + $a['counts'][$id];
	}
	$order = array_keys($weight);
	usort($order, fn(int $x, int $y): int => [$weight[$y], $x] <=> [$weight[$x], $y]);
	$bytes = [];
	foreach ($tokens as $t => [, $text]) {
		if (($a['uses'][$t] ?? -1) < 0) {
			foreach (count_chars($text, 1) as $byte => $times) {
				$bytes[$byte] = ($bytes[$byte] ?? 0) + $times;
			}
		}
	}
	$rank = function (string $set) use ($bytes): array {
		$list = str_split($set);
		usort($list, fn(string $x, string $y): int => [$bytes[ord($y)] ?? 0, $x] <=> [$bytes[ord($x)] ?? 0, $y]);
		return $list;
	};
	$first = $rank('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_$');
	$rest = $rank('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_$0123456789');
	$taken = array_flip([...MIN_JS_KEYWORDS, ...MIN_JS_FIXED, ...MIN_JS_CONTEXTUAL, ...array_keys($a['free'])]);
	$given = [];
	$i = 0;
	foreach ($order as $s) {
		do {
			$name = MIN__JsName($i++, $first, $rest);
		} while (isset($taken[$name]));
		$given[$s] = $name;
	}
	$out = '';
	$lastKind = '';
	$lastText = '';
	foreach ($tokens as $t => [$kind, $text]) {
		if (($a['uses'][$t] ?? -1) >= 0) {
			$name = $given[$slot[$a['uses'][$t]]];
			$text = isset($a['shorthand'][$t]) && $name !== $text ? $text . ':' . $name : $name;
		}
		if ($out !== '' && MIN__JsGlue(substr($out, -1), $text[0], $lastKind === 'number' ? $lastText : '')) {
			$out .= ' ';
		}
		$out .= $text;
		$lastKind = $kind;
		$lastText = $text;
	}
	return $out;
}

/**
 * The script with short names, proved: its tokens are the squeezed script's but for the names and the written-out
 * shorthands; each name uses the declaration its original used, one new name for each, free names unchanged; and
 * scanning it again changes nothing.
 */
function MIN__JsNamesSafe(string $min): string
{
	$named = MIN__JsNames($min);
	$before = MIN__JsLex($min);
	$a = MIN__JsScopes($before);
	try {
		$after = MIN__JsLex($named);
		$b = MIN__JsScopes($after);
	} catch (RuntimeException $e) {
		throw new LogicException('the named script cannot be read again: ' . $e->getMessage(), 0, $e);
	}
	$map = [];
	$o = 0;
	foreach ($before as $t => [$kind, $text]) {
		$use = $a['uses'][$t] ?? null;
		if (isset($a['shorthand'][$t]) && ($after[$o][1] ?? '') === $text && ($after[$o + 1][1] ?? '') === ':') {
			$o += 2;
		}
		[$kindAfter, $textAfter] = $after[$o] ?? ['', ''];
		$useAfter = $b['uses'][$o] ?? null;
		$same = $kindAfter === $kind && ($use === null) === ($useAfter === null) && ($use === -1) === ($useAfter === -1);
		if (!$same || (($use ?? -1) < 0 && $textAfter !== $text)) {
			throw new LogicException('the names pass changed token #' . $t . ': ' . $text . ' → ' . $textAfter);
		}
		if ($use !== null && $use >= 0) {
			if (isset($map[$use]) && $map[$use] !== $useAfter) {
				throw new LogicException('the name ' . $text . ' at token #' . $t . ' now uses another declaration');
			}
			$map[$use] = $useAfter;
		}
		$o++;
	}
	if ($o !== count($after)) {
		throw new LogicException('the named script has ' . (count($after) - $o) . ' more tokens');
	}
	if (count(array_unique($map)) !== count($map)) {
		throw new LogicException('two declarations share a name in the named script');
	}
	if (MIN__JsScan($named)[0] !== $named) {
		throw new LogicException('the named script changes when scanned again');
	}
	return $named;
}

/**
 * Refuses, in a classic script that is to run in a block of an ES module, what reads otherwise there: a static import or
 * export; a `var` or a function declaration outside any function - global in a script, the block's own in a module;
 * `this` outside any function but an arrow - the window in a script, undefined in a module; `with`, an HTML-like comment,
 * a legacy octal number or escape - errors in a module's strict code; and a bracket left open or closed twice, which
 * breaks the block.
 */
function MIN__JsBlockCheck(string $js): void
{
	$tokens = MIN__JsLex($js);
	$stack = [];
	$class = -1;
	$before = -1;
	$depth = function (int $flag) use (&$stack): int {
		return count(array_filter($stack, fn(array $open): bool => $open[$flag]));
	};
	foreach ($tokens as $t => [$kind, $text, $at]) {
		$prev = $tokens[$t - 1] ?? ['', '', -1];
		$next = $tokens[$t + 1] ?? ['', '', -1];
		$word = $kind === 'name' && $prev[1] !== '.' && $prev[1] !== '?.' && $next[1] !== ':';
		$start = in_array($prev[1], ['', ';', '{', '}', ')', 'else'], true) || ($prev[1] === 'async' && in_array(($tokens[$t - 2] ?? ['', ''])[1], ['', ';', '{', '}', ')'], true));
		match (true) {
			$word && $text === 'var' && $depth(1) === 0 => MIN__Refuse('a var outside any function is the block\'s own in a module, not global - write const or let, or window.NAME = … where other code reads it', $js, $at),
			$word && $text === 'function' && $start && $depth(1) === 0 => MIN__Refuse('a function declared outside any function is the block\'s own in a module, not global - write window.NAME = function … where other code calls it', $js, $at),
			$word && $text === 'this' && $depth(2) === 0 => MIN__Refuse('this outside any function is undefined in a module, not the window', $js, $at),
			$word && $text === 'with' => MIN__Refuse('with is an error in a module\'s strict code', $js, $at),
			$word && $text === 'import' && $next[1] !== '(' && $next[1] !== '.', $word && $text === 'export' => MIN__Refuse('a static ' . $text . ' does not run in a block', $js, $at),
			$kind === 'punctuator' && $text === '<' && $next[1] === '!' && $next[2] === $at + 1 && ($tokens[$t + 2] ?? ['', '', -1])[1] === '--' && ($tokens[$t + 2] ?? ['', '', -1])[2] === $at + 2 => MIN__Refuse('<!-- begins a comment in a script, not in a module', $js, $at),
			$kind === 'punctuator' && $text === '--' && $next[1] === '>' && $next[2] === $at + 2 && trim(substr($js, ($line = strrpos(substr($js, 0, $at), "\n")) === false ? 0 : $line + 1, $at - ($line === false ? 0 : $line + 1))) === '' => MIN__Refuse('--> at a line\'s start begins a comment in a script, not in a module', $js, $at),
			$kind === 'number' && preg_match('~^0[0-9]~', $text) === 1 => MIN__Refuse('a number with a leading 0 is an error in a module\'s strict code', $js, $at),
			$kind === 'string' && preg_match_all('~\\\\(.)(.?)~s', $text, $escapes, PREG_SET_ORDER) > 0 && array_filter($escapes, fn(array $e): bool => str_contains('123456789', $e[1]) || ($e[1] === '0' && MIN__Bytes($e[2], MIN_DIGITS))) !== [] => MIN__Refuse('an octal escape is an error in a module\'s strict code', $js, $at),
			default => null,
		};
		if ($kind === 'name' && $text === 'class' && $prev[1] !== '.') {
			$class = count($stack);
		}
		$closes = $kind === 'punctuator' && in_array($text, [')', ']', '}'], true) || ($kind === 'template' && $text[0] === '}');
		if ($closes) {
			$open = array_pop($stack);
			if ($open === null || $open[0] !== ($text[0] === ')' ? '(' : ($text[0] === ']' ? '[' : '{'))) {
				MIN__Refuse('a ' . $text[0] . ' without its opening', $js, $at);
			}
			$before = $text === ')' ? $open[3] : -1;
		}
		if ($kind === 'punctuator' && ($text === '(' || $text === '[')) {
			$stack[] = [$text, false, false, $t - 1, $at];
		} elseif ($kind === 'template' && str_ends_with($text, '${')) {
			$stack[] = ['{', false, false, -1, $at];
		} elseif ($kind === 'punctuator' && $text === '{') {
			$head = $prev[1] === ')' && $before >= 0 ? $tokens[$before] : ['', '', -1];
			$stack[] = match (true) {
				$class === count($stack) => ['{', false, true, -1, $at, 'class'],
				$prev[1] === '=>' => ['{', true, false, -1, $at],
				$prev[1] === 'static' && (end($stack)[5] ?? '') === 'class' => ['{', true, true, -1, $at],
				$prev[1] === ')' => in_array($head[1], MIN_JS_HEADS, true) && $head[0] === 'name' ? ['{', false, false, -1, $at] : ['{', true, true, -1, $at],
				default => ['{', false, false, -1, $at],
			};
			if ($class === count($stack) - 1) {
				$class = -1;
			}
		}
	}
	if ($stack !== []) {
		MIN__Refuse('a ' . $stack[count($stack) - 1][0] . ' without its closing', $js, $stack[count($stack) - 1][4]);
	}
}

/**
 * What a script for MIN__JsBlocks declares at its top level - by const, let and class, outside every function, block and
 * bracket, destructured ones too - and the names it reads that it does not declare, each at the byte of its first read.
 * Exact where MIN__JsScopes reads the script, which also refuses a function declared in a block and read outside it. Where
 * it does not, a lexical stand-in: a read is a name used as a reference - not after . or ?., not an object key - that
 * the script declares nowhere, so a script that declares a name anywhere never reads it from another.
 * @return array{top: array<string, true>, reads: array<string, int>}
 */
function MIN__JsBlockNames(string $js): array
{
	$tokens = MIN__JsLex($js);
	try {
		$a = MIN__JsScopes($tokens);
	} catch (RuntimeException $e) {
		if (str_contains($e->getMessage(), 'declared in a block is read outside it')) {
			MIN__Refuse($e->getMessage(), $js, $tokens[$e->getCode()][2] ?? strlen($js));
		}
		$a = null;
	}
	$reads = [];
	if ($a !== null) {
		foreach ($a['uses'] as $t => $use) {
			if ($use === -1) {
				$reads[$tokens[$t][1]] ??= $tokens[$t][2];
			}
		}
		return ['top' => array_fill_keys(array_keys($a['names'][0]), true), 'reads' => $reads];
	}
	$count = count($tokens);
	$match = [];
	$open = [];
	foreach ($tokens as $t => [$kind, $text]) {
		if (($kind === 'punctuator' && in_array($text, [')', ']', '}'], true)) || ($kind === 'template' && $text[0] === '}')) {
			if ($open !== []) {
				$match[array_pop($open)] = $t;
			}
		}
		if (($kind === 'punctuator' && in_array($text, ['(', '[', '{'], true)) || ($kind === 'template' && str_ends_with($text, '${'))) {
			$open[] = $t;
		}
	}
	// The token after an expression that starts at $j: the next `,` or `;` outside its brackets, or $end.
	$skip = function (int $j, int $end) use ($tokens, $match): int {
		while ($j < $end && !in_array($tokens[$j][1], [',', ';'], true)) {
			$j = isset($match[$j]) ? $match[$j] + 1 : $j + 1;
		}
		return $j;
	};
	// The names a binding at $i declares - a name, an object or array pattern, a list of parameters - and the token after it.
	$bind = function (int $i) use (&$bind, $tokens, $match, $skip): array {
		[$kind, $text] = $tokens[$i] ?? ['', ''];
		if ($kind === 'name') {
			return [[$text], $i + 1];
		}
		if (!in_array($text, ['{', '[', '('], true) || !isset($match[$i])) {
			return [[], $i + 1];
		}
		$names = [];
		$end = $match[$i];
		for ($j = $i + 1; $j < $end;) {
			if ($tokens[$j][1] === ',') {
				$j++;
				continue;
			}
			if ($tokens[$j][1] === '...') {
				$j++;
			}
			if ($text === '{' && ($tokens[$j + 1][1] ?? '') === ':') {
				$j += 2;
			} elseif ($text === '{' && $tokens[$j][1] === '[' && isset($match[$j]) && ($tokens[$match[$j] + 1][1] ?? '') === ':') {
				$j = $match[$j] + 2;
			}
			[$more, $after] = $bind($j);
			array_push($names, ...$more);
			$j = ($tokens[$after][1] ?? '') === '=' ? $skip($after + 1, $end) : max($after, $j + 1);
		}
		return [$names, $end + 1];
	};
	// The names a const, let or var declares, from the token after the word.
	$declares = function (int $i) use ($bind, $skip, $tokens, $count): array {
		$names = [];
		while ($i < $count) {
			[$more, $i] = $bind($i);
			array_push($names, ...$more);
			if (($tokens[$i][1] ?? '') === '=') {
				$i = $skip($i + 1, $count);
			}
			if (($tokens[$i][1] ?? '') !== ',') {
				break;
			}
			$i++;
		}
		return $names;
	};
	$top = [];
	$declared = [];
	$depth = 0;
	foreach ($tokens as $t => [$kind, $text, $at]) {
		$prev = $tokens[$t - 1] ?? ['', '', 0];
		$property = $prev[1] === '.' || $prev[1] === '?.';
		$fresh = $t === 0 || in_array($prev[1], [';', '}'], true) || str_contains(substr($js, $prev[2], $at - $prev[2]), "\n");
		$names = [];
		if ($kind === 'name' && !$property && in_array($text, ['const', 'let', 'var'], true)) {
			$names = $declares($t + 1);
		} elseif ($kind === 'name' && !$property && ($text === 'function' || $text === 'class')) {
			$n = ($tokens[$t + 1][1] ?? '') === '*' ? $t + 2 : $t + 1;
			$names = ($tokens[$n][0] ?? '') === 'name' && $tokens[$n][1] !== 'extends' ? [$tokens[$n][1]] : [];
		} elseif ($kind === 'name' && ($tokens[$t + 1][1] ?? '') === '=>') {
			$names = [$text];
		} elseif ($text === '(' && isset($match[$t]) && (($tokens[$match[$t] + 1][1] ?? '') === '=>' || (($tokens[$match[$t] + 1][1] ?? '') === '{' && (($prev[0] === 'name' && (!in_array($prev[1], MIN_JS_HEADS, true) || $prev[1] === 'catch')) || $prev[1] === ']')))) {
			$names = $bind($t)[0];
		}
		array_push($declared, ...$names);
		if ($depth === 0 && $fresh && in_array($text, ['const', 'let', 'class'], true) && $kind === 'name' && !$property) {
			array_push($top, ...$names);
		}
		if (($kind === 'punctuator' && in_array($text, ['(', '[', '{'], true)) || ($kind === 'template' && str_ends_with($text, '${'))) {
			$depth++;
		}
		if (($kind === 'punctuator' && in_array($text, [')', ']', '}'], true)) || ($kind === 'template' && $text[0] === '}')) {
			$depth--;
		}
	}
	$declared = array_flip($declared);
	foreach ($tokens as $t => [$kind, $text, $at]) {
		$prev = $tokens[$t - 1][1] ?? '';
		$key = ($tokens[$t + 1][1] ?? '') === ':' && in_array($prev, ['{', ','], true);
		if ($kind === 'name' && !isset($declared[$text]) && !$key && !in_array($prev, ['.', '?.', 'break', 'continue'], true) && !in_array($text, MIN_JS_KEYWORDS, true) && !in_array($text, MIN_JS_FIXED, true)) {
			$reads[$text] ??= $at;
		}
	}
	return ['top' => array_fill_keys($top, true), 'reads' => $reads];
}

/**
 * Classic scripts joined, each in a block of its own and in their order, for one ES module - the file a page links with
 * type="module". A script that reads otherwise in a block of a module is refused: "LABEL: REASON at byte N, line L", the
 * byte of that script as the code. So is a script that reads a name another script declares at its top level - in
 * classic scripts the page's, in a module its block's own - whatever their order, and a function declared in a block and
 * read outside it, which a script also binds in the function around the block and a module does not. The same name at
 * the top of two scripts is each block's own. The joined text goes through MIN__JsSafe and then, where it can,
 * MIN__JsNamesSafe.
 * @param array<string, string> $scripts the text of each script by the label a refusal names it with
 */
function MIN__JsBlocks(array $scripts): string
{
	$blocks = [];
	$facts = [];
	foreach ($scripts as $label => $js) {
		try {
			MIN__JsBlockCheck($js);
			$facts[$label] = MIN__JsBlockNames($js);
		} catch (RuntimeException $e) {
			throw new RuntimeException($label . ': ' . $e->getMessage(), $e->getCode(), $e);
		}
		$blocks[] = "{\n" . $js . "\n}";
	}
	foreach ($facts as $reader => $fact) {
		asort($fact['reads']);
		foreach ($fact['reads'] as $name => $at) {
			foreach ($facts as $owner => $other) {
				if ((string)$owner === (string)$reader || !isset($other['top'][$name])) {
					continue;
				}
				try {
					MIN__Refuse($name . ' is declared at the top of ' . $owner . ', and a block does not share it - share it through a name both read, such as window.NAME.' . $name, $scripts[$reader], $at);
				} catch (RuntimeException $e) {
					throw new RuntimeException($reader . ': ' . $e->getMessage(), $e->getCode(), $e);
				}
			}
		}
	}
	return implode("\n", $blocks) . "\n";
}

// The samples the passes prove themselves on: [pass, text - for blocks, a text or the scripts by label -, 'gives' and the
// output, or 'refuses' and a part of the refusal].
const MIN_FUSES = [
	['css', ".a { color: red; }\n/* c */ .b  .c { margin: 0 auto; }", 'gives', '.a{color:red}.b .c{margin:0 auto}'],
	['css', '.a{color:url(x)}', 'refuses', 'an unquoted url( at byte 12, line 1'],
	['css', ".a{}\n.b{", 'refuses', 'a { without its } at byte 7, line 2'],
	['css', '.a{b:c}}', 'refuses', 'a } without its { at byte 7, line 1'],
	['css', '@foo{}', 'refuses', 'the at-rule @foo is not one this pass knows at byte 4'],
	['css', '.a{b:c}\\', 'refuses', 'a \\ with nothing after it at byte 7, line 1'],
	['js', "const a = 1;\n// x\nconst b = a + 1;", 'gives', 'const a=1;const b=a+1;'],
	['js', "a\n'b'", 'refuses', 'a newline is the only separator at 1 place(s) - add the operator or `;` it lacks at byte 2, line 2'],
	['js', "const a = 'open", 'refuses', 'a string runs to the end of the script at byte 10'],
	['js', "const a = 'one\ntwo';", 'refuses', 'a string runs past its line at byte 10'],
	['js', 'const a = 1; /* open', 'refuses', 'an unclosed comment at byte 13'],
	['js', 'const a = `open ${b}', 'refuses', 'a template runs to the end of the script at byte 10'],
	['js', 'const a = /open', 'refuses', 'a pattern runs to the end of the script at byte 10'],
	['js', "var Ω = 1;\nwindow.a = Ω;\n", 'gives', 'var Ω=1;window.a=Ω;'],
	['js', 'function ж() { return typeof é in Ω; }', 'gives', 'function ж(){return typeof é in Ω;}'],
	['js', 'var \\u0041 = 1; a in \\u{41};', 'gives', 'var \\u0041=1;a in \\u{41};'],
	['js', "Ω\n'b'", 'refuses', 'a newline is the only separator at 1 place(s) - add the operator or `;` it lacks at byte 3, line 2'],
	['names', 'const longName=1;console.log(longName);', 'gives', 'const o=1;console.log(o);'],
	['names', 'var longName=1;function helper(){return longName;}', 'gives', 'var longName=1;function helper(){return longName;}'],
	['names', 'const f=()=>{return twice(1);function twice(value){return value*2;}};', 'gives', 'const t=()=>{return n(1);function n(r){return r*2;}};'],
	['names', 'const f=function self(count){return count?self(count-1):0;};', 'gives', 'const c=function t(n){return n?t(n-1):0;};'],
	['names', 'const f=function(first,{second,third=1}={},...rest){var first;var other=first;return other+second+third+rest.length;};', 'gives', 'const e=function(n,{second:r,third:t=1}={},...a){var n;var c=n;return c+r+t+a.length;};'],
	['names', 'const f=function(){return arguments.length;};', 'gives', 'const n=function(){return arguments.length;};'],
	['names', 'const f=(given=outer)=>{const outer=1;return given+outer;};', 'gives', 'const o=(t=outer)=>{const n=1;return t+n;};'],
	['names', 'class Box{#size=1;static count=0;static{Box.count=1;}constructor(value){this.value=value;}get size(){return this.#size;}set size(next){this.#size=next;}[Symbol.iterator](){return [].values();}*items(){yield this.value;}}', 'gives', 'class s{#size=1;static count=0;static{s.count=1;}constructor(t){this.value=t;}get size(){return this.#size;}set size(t){this.#size=t;}[Symbol.iterator](){return[].values();}*items(){yield this.value;}}'],
	['names', 'const A=class Named extends Base{static make(){return new Named();}};', 'gives', 'const s=class e extends Base{static make(){return new e();}};'],
	['names', 'const o={get size(){return 1;},set size(next){},[key](value){return value;},*items(){yield 1;},async load(url){return url;}};', 'gives', 'const t={get size(){return 1;},set size(e){},[key](e){return e;},*items(){yield 1;},async load(e){return e;}};'],
	['names', 'const g=function*(){yield 1;};const h=async function*(){yield 2;};', 'gives', 'const n=function*(){yield 1;};const c=async function*(){yield 2;};'],
	['names', 'const f=()=>{outer:for(const row of rows){for(const cell of row){if(cell){break outer;}}}};', 'gives', 'const f=()=>{outer:for(const o of rows){for(const r of o){if(r){break outer;}}}};'],
	['names', 'const f=(flag)=>{if(flag){function inner(){return 1;}return inner();}};', 'gives', 'const t=(n)=>{if(n){function r(){return 1;}return r();}};'],
	['names', 'const f=(flag)=>{if(flag){function inner(){}}return inner;};', 'refuses', 'the function inner declared in a block is read outside it, where a script reads it and a module does not at byte 52, line 1'],
	['names', 'const f=()=>{if(a)function g(){}};', 'refuses', 'a function declared right in a statement or under a label at byte 18'],
	['names', 'const f=()=>{let shared;{var shared;}};', 'refuses', 'a var or a function and a let, const, class or parameter of the name shared in one scope at byte 29'],
	['names', 'const f=()=>{try{}catch(error){var error;}};', 'refuses', 'a var in the reach of a let, const, class or catch of the name error at byte 35'],
	['names', 'const f=()=>arguments;', 'refuses', 'arguments outside a function that is not an arrow at byte 12'],
	['names', 'const f=()=>{yield;};', 'refuses', 'yield outside a generator at byte 13'],
	['names', 'const f=()=>eval(code);', 'refuses', 'eval is not read by the names pass at byte 12'],
	['names', 'const f=async()=>{for await(const value of stream){use(value);}};', 'gives', 'const a=async()=>{for await(const s of stream){use(s);}};'],
	['names', 'const f=()=>{let x=1;let x=2;};', 'refuses', 'the name x is declared twice in one scope at byte 25, line 1'],
	['blocks', '(function () { var x = 1; })();', 'gives', "{\n(function () { var x = 1; })();\n}\n"],
	['blocks', 'const w = function () { for (var i = 0; i < 2; i++) {} };', 'gives', "{\nconst w = function () { for (var i = 0; i < 2; i++) {} };\n}\n"],
	['blocks', 'class A { #n = 1; x = this; static { var y = 1; } m() { return this.#n; } }', 'gives', "{\nclass A { #n = 1; x = this; static { var y = 1; } m() { return this.#n; } }\n}\n"],
	['blocks', "const o = { m() { return this; } }; obj.var = 1; import('./x.js'); const u = import.meta.url; x-->y; const s = '\\0' + '\\\\1';", 'gives', "{\nconst o = { m() { return this; } }; obj.var = 1; import('./x.js'); const u = import.meta.url; x-->y; const s = '\\0' + '\\\\1';\n}\n"],
	['blocks', 'var x = 1;', 'refuses', 'a.js: a var outside any function'],
	['blocks', 'if (a) { var x = 1; }', 'refuses', 'a.js: a var outside any function is the block\'s own in a module, not global - write const or let, or window.NAME = … where other code reads it at byte 9'],
	['blocks', 'function f() {}', 'refuses', 'a.js: a function declared outside any function'],
	['blocks', 'const f = () => this;', 'refuses', 'a.js: this outside any function is undefined in a module, not the window at byte 16'],
	['blocks', 'const f = () => { return this; };', 'refuses', 'a.js: this outside any function is undefined in a module, not the window at byte 25'],
	['blocks', 'with (o) {}', 'refuses', 'a.js: with is an error'],
	['blocks', "import x from './x.js';", 'refuses', 'a.js: a static import does not run in a block'],
	['blocks', 'export const a = 1;', 'refuses', 'a.js: a static export does not run in a block'],
	['blocks', 'a<!--b', 'refuses', 'a.js: <!-- begins a comment in a script, not in a module at byte 1'],
	['blocks', "x = 1;\n  --> note", 'refuses', 'a.js: --> at a line\'s start begins a comment in a script, not in a module at byte 9, line 2'],
	['blocks', 'const a = 010;', 'refuses', 'a.js: a number with a leading 0 is an error'],
	['blocks', "const s = '\\1';", 'refuses', 'a.js: an octal escape is an error'],
	['blocks', 'if (a) {', 'refuses', 'a.js: a { without its closing at byte 7'],
	['blocks', '}', 'refuses', 'a.js: a } without its opening at byte 0'],
	['blocks', ['a.js' => 'const total = 1;', 'b.js' => 'console.log(total);'], 'refuses', 'b.js: total is declared at the top of a.js, and a block does not share it - share it through a name both read, such as window.NAME.total at byte 12, line 1'],
	['blocks', ['a.js' => 'const f = () => total;', 'b.js' => 'const total = 1;'], 'refuses', 'a.js: total is declared at the top of b.js, and a block does not share it - share it through a name both read, such as window.NAME.total at byte 16'],
	['blocks', ['a.js' => 'const {total, more: [x]} = o; class Box {}', 'b.js' => 'f(x);'], 'refuses', 'b.js: x is declared at the top of a.js'],
	['blocks', ['a.js' => 'const total = 1;', 'b.js' => 'const total = 2; console.log(total);'], 'gives', "{\nconst total = 1;\n}\n{\nconst total = 2; console.log(total);\n}\n"],
	['blocks', ['a.js' => 'eval(""); const {total} = o; class Box {}', 'b.js' => 'new Box();'], 'refuses', 'b.js: Box is declared at the top of a.js, and a block does not share it - share it through a name both read, such as window.NAME.Box at byte 4'],
	['blocks', ['a.js' => 'const total = 1;', 'b.js' => 'eval("x"); f(total);'], 'refuses', 'b.js: total is declared at the top of a.js, and a block does not share it - share it through a name both read, such as window.NAME.total at byte 13'],
	['blocks', ['a.js' => 'const total = 1;', 'b.js' => 'eval("x"); (function () { var total = 2; f(total); })();'], 'gives', "{\nconst total = 1;\n}\n{\neval(\"x\"); (function () { var total = 2; f(total); })();\n}\n"],
	['blocks', '(function () { if (a) { function g() {} } g(); })();', 'refuses', 'a.js: the function g declared in a block is read outside it, where a script reads it and a module does not at byte 42'],
	['blocks', '(function () { if (a) { function g() {} g(); } })();', 'gives', "{\n(function () { if (a) { function g() {} g(); } })();\n}\n"],
];

/** The fuses of MIN_FUSES that misfire: a sample that gives another output, or a refusal that is not the one expected. */
function MIN__SelfTest(): array
{
	$failures = [];
	foreach (MIN_FUSES as [$pass, $text, $expect, $what]) {
		try {
			$got = match ($pass) {
				'css' => MIN__CssSafe($text),
				'js' => MIN__JsSafe($text),
				'names' => MIN__JsNamesSafe($text),
				'blocks' => MIN__JsBlocks(is_array($text) ? $text : ['a.js' => $text]),
			};
			$wrong = $expect !== 'gives' || $got !== $what ? 'gives ' . json_encode($got, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) : '';
		} catch (RuntimeException $e) {
			$wrong = $expect !== 'refuses' || !str_contains($e->getMessage(), $what) || !str_contains($e->getMessage(), ' at byte ' . $e->getCode() . ',') ? 'refuses ' . $e->getMessage() : '';
		}
		if ($wrong !== '') {
			$failures[] = 'the ' . $pass . ' fuse ' . json_encode($text, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . ' ' . $wrong;
		}
	}
	return $failures;
}

/**
 * The release's stylesheet from the files of $entry under $root, and its script from the modules of $entry, under the
 * $banner comment: [text, the sizes in bytes as written, joined and squeezed].
 * @param list<string> $files
 * @return array{string, array<string, int>}
 */
function MIN__Bundle(string $root, array $files, string $banner): array
{
	$joined = str_ends_with($files[0], '.css') ? implode("\n", array_map(fn(string $file): string => (string)file_get_contents($root . '/' . $file), $files)) : MIN__JsJoin($root, $files);
	$sizes = ['files' => array_sum(array_map(fn(string $file): int => (int)filesize($root . '/' . $file), $files)), 'joined' => strlen($joined)];
	if (str_ends_with($files[0], '.css')) {
		$min = MIN__CssSafe($joined);
	} else {
		$squeezed = MIN__JsSafe($joined);
		$sizes['squeezed'] = strlen($squeezed);
		$min = MIN__JsNamesSafe($squeezed);
	}
	$sizes['min'] = strlen($min);
	return [$banner . "\n" . $min . "\n", $sizes];
}

# scan.awk - the reading behind scan.sh: the map and the class list first, then the project's files line by line.
BEGIN {
	FS = "\t"
	owned = split(own, prefixes, " ")
}

FILENAME == ARGV[1] {
	if (FNR > 1) {
		kind[$1] = $3
		target[$1] = $2 != "" ? $2 : $6
	}
	next
}

FILENAME == ARGV[2] {
	known[$0] = 1
	next
}

FNR == 1 {
	open = ""
}

function report(token, what, form) {
	printf "%s:%d:%s:%s:%s\n", FILENAME, at, token, what, form
	found++
}

# Whether the text ends inside a class value whose quote is still open: a value written over several lines.
function unclosed(text) {
	return text ~ /class(Name)?[ \t]*=[ \t]*"[^"]*$/ || text ~ /class(Name)?[ \t]*=[ \t]*'[^']*$/
}

function check(token,    i) {
	# Code inside a class value - an operator, a quote, a number, a call - is no class.
	if (token == "" || token ~ /[<>{}$()'"]/ || token !~ /[A-Za-z]/) {
		return
	}
	if (token in kind) {
		if (kind[token] != "same") {
			report(token, kind[token], target[token])
		}
		return
	}
	if (token in known) {
		return
	}
	for (i = 1; i <= owned; i++) {
		if (index(token, prefixes[i]) == 1) {
			return
		}
	}
	report(token, "unknown", token ~ /^bi-/ ? "no such icon in the library's icons/" : "")
}

function classes(value,    n, i, tokens) {
	n = split(value, tokens, /[ \t]+/)
	for (i = 1; i <= n; i++) {
		check(tokens[i])
	}
}

# The words of a class value that holds template code (PHP, Twig, Jinja, JS templates, ERB): the text around the code
# and the quoted strings inside it; the code itself - variables, operators, calls - names no class, and a part glued to
# the code is one half of a class built in code, which the scan reports apart.
function templated(value,    pairs, i, at, best, which, end, code, words) {
	split("<?|?>|{{|}}|{%|%}|${|}|<%|%>", pairs, "|")
	words = ""
	while (1) {
		best = 0
		for (i = 1; i <= 9; i += 2) {
			at = index(value, pairs[i])
			if (at > 0 && (best == 0 || at < best)) {
				best = at
				which = i
			}
		}
		if (best == 0) {
			return glued(words, value, 0)
		}
		words = glued(words, substr(value, 1, best - 1), 1)
		value = substr(value, best + length(pairs[which]))
		end = index(value, pairs[which + 1])
		code = end > 0 ? substr(value, 1, end - 1) : value
		value = end > 0 ? substr(value, end + length(pairs[which + 1])) : ""
		while (match(code, /'[^']*'|"[^"]*"/)) {
			# A string compared, a key or an index names a value, not a class: $tone === 'x', ['danger' => …], $row['id'].
			if (substr(code, 1, RSTART - 1) !~ /(==|!=|<|>|\[)[ \t]*$/ && substr(code, RSTART + RLENGTH) !~ /^[ \t]*(==|!=|=>|\])/) {
				words = words " " substr(code, RSTART + 1, RLENGTH - 2)
			}
			code = substr(code, RSTART + RLENGTH)
		}
		if (value !~ /^[ \t]/) {
			sub(/^[^ \t]+/, "", value)
		}
	}
}

# The words before $text joined with its own, the last one dropped when code follows it with no space between.
function glued(words, text, before) {
	if (before && text !~ /[ \t]$/) {
		sub(/[^ \t]+$/, "", text)
	}
	return words " " text
}

{
	# A class value over several lines is read as one line, told at the line it starts on; a stray quote joins 20 at most.
	if (open != "") {
		open = open " " $0
		if (unclosed(open) && ++joined < 20) {
			next
		}
		line = open
		open = ""
	} else if (unclosed($0)) {
		open = $0
		at = FNR
		joined = 0
		next
	} else {
		line = $0
		at = FNR
	}
	rest = line
	while (match(rest, /class(Name)?[ \t]*=[ \t]*("[^"]*"|'[^']*')/)) {
		value = substr(rest, RSTART, RLENGTH)
		rest = substr(rest, RSTART + RLENGTH)
		sub(/^class(Name)?[ \t]*=[ \t]*./, "", value)
		sub(/.$/, "", value)
		if (value ~ /<\?|\{\{|\{%|\$\{|<%/) {
			report("class", "review", "a class built in code: write every class name out whole")
			value = templated(value)
		}
		# A class value joined in a script's string ('<span class="badge ' + tone + '">') names its variables no class.
		if (value ~ /['"][ \t]*\+|\+[ \t]*['"]/) {
			report("class", "review", "a class built in code: write every class name out whole")
			gsub(/['"][ \t]*\+[^'"]*(\+[ \t]*['"]|$)/, " ", value)
		}
		classes(value)
	}
	rest = line
	while (match(rest, /classList\.(add|remove|toggle|contains)\([^)]*\)/)) {
		value = substr(rest, RSTART, RLENGTH)
		rest = substr(rest, RSTART + RLENGTH)
		# Only the quoted names: toggle('active', on) names one class, its second argument is a condition.
		while (match(value, /'[^']*'|"[^"]*"/)) {
			classes(substr(value, RSTART + 1, RLENGTH - 2))
			value = substr(value, RSTART + RLENGTH)
		}
	}
	rest = line
	while (match(rest, /(querySelector(All)?|closest|matches)\(['"][^'"]*['"]/)) {
		value = substr(rest, RSTART, RLENGTH)
		rest = substr(rest, RSTART + RLENGTH)
		while (match(value, /\.[a-zA-Z][a-zA-Z0-9_-]*/)) {
			check(substr(value, RSTART + 1, RLENGTH - 1))
			value = substr(value, RSTART + RLENGTH)
		}
	}
	rest = line
	while (match(rest, /data-bs-[a-z-]+(="[^"]*")?/)) {
		value = substr(rest, RSTART, RLENGTH)
		rest = substr(rest, RSTART + RLENGTH)
		name = value
		sub(/=.*/, "", name)
		if (value in kind) {
			report(value, kind[value], target[value])
		} else if (name in kind) {
			report(name, kind[name], target[name])
		} else {
			report(name, "review", "no REDZ.UI form: see the skill's references/states-and-triggers.md")
		}
	}
	rest = line
	while (match(rest, /bootstrap\.[A-Z][A-Za-z]+/)) {
		value = substr(rest, RSTART, RLENGTH)
		rest = substr(rest, RSTART + RLENGTH)
		report(value, value in kind ? kind[value] : "review", value in kind ? target[value] : "")
	}
	# Bootstrap's custom properties, read by var() or set, in stylesheets, style attributes and scripts alike.
	rest = line
	while (match(rest, /--bs-[a-z0-9-]*[a-z0-9]/)) {
		value = substr(rest, RSTART, RLENGTH)
		rest = substr(rest, RSTART + RLENGTH)
		report(value, value in kind ? kind[value] : "review", value in kind ? target[value] : "a custom property Bootstrap 5.3 does not define: the project's own, named like Bootstrap's")
	}
	if (line ~ /['"](btn|alert|badge|text|bg|border|col|table|d|m[tbsexy]?|p[tbsexy]?)-['"][ \t]*\./) {
		report("class", "review", "a class built in code: write every class name out whole")
	}
}

END {
	if (open != "") {
		report("class", "review", "a class value whose quote never closes")
	}
	exit found > 0 ? 1 : 0
}

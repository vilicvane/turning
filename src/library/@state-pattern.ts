import escapeStringRegexp from 'escape-string-regexp';
import _ from 'lodash';

const PATTERN_PARSE_REGEX = /(\*{1,2})|\{((?:\\[^]|[^\\}])*)\}|(?:\\[^]|[^\\*{])+/g;
const BRACE_PATTERN_PARSE_REGEX = /(\*{1,2})|(?:\\[^]|[^\\*])+/g;
const BRACE_PATTERN_PARTIAL_PARSE_REGEX = /,|(?:\\[^]|[^\\,])*/g;

const patternToRegexMap = new Map<string, RegExp>();

export function buildStateFilter(
  patterns: string | string[],
): <TState extends string>(state: TState) => boolean {
  if (typeof patterns === 'string') {
    patterns = [patterns];
  }

  let regexes = patterns.map(pattern => {
    let regex = patternToRegexMap.get(pattern);

    if (regex) {
      return regex;
    }

    regex = new RegExp(`^${buildRegexSource(pattern)}$`);

    patternToRegexMap.set(pattern, regex);

    return regex;
  });

  return state => regexes.some(regex => regex.test(state));

  function buildRegexSource(pattern: string, inBraces = false): string {
    if (!pattern) {
      return '';
    }

    let regexSourcePartials: string[] = [];

    let groups: RegExpExecArray | null;
    let ended = false;

    let parseRegex = inBraces ? BRACE_PATTERN_PARSE_REGEX : PATTERN_PARSE_REGEX;

    // eslint-disable-next-line no-cond-assign
    while ((groups = parseRegex.exec(pattern))) {
      if (parseRegex.lastIndex === pattern.length) {
        ended = true;
      }

      let [text, glob, bracePattern] = groups;

      if (glob) {
        regexSourcePartials.push(glob === '*' ? '[^:/]+' : '.*');
      } else if (bracePattern) {
        let bracePartials: string[] = [];

        let bracePatternSegments =
          bracePattern.match(BRACE_PATTERN_PARTIAL_PARSE_REGEX) ?? [];

        while (bracePatternSegments.length) {
          let peek = bracePatternSegments[0];

          if (peek === ',') {
            bracePartials.push('');
            bracePatternSegments.shift();
          } else {
            bracePartials.push(peek);
            bracePatternSegments.shift();

            if (bracePatternSegments[0] !== ',') {
              break;
            }

            bracePatternSegments.shift();
          }
        }

        let bracePatternRegexSource = bracePartials
          .map(bracePartial => {
            let source = buildRegexSource(bracePartial, true);
            return source.includes('|') ? `(?:${source})` : source;
          })
          .join('|');

        regexSourcePartials.push(
          bracePartials.length > 1
            ? `(?:${bracePatternRegexSource})`
            : bracePatternRegexSource,
        );
      } else {
        regexSourcePartials.push(escapeStringRegexp(unescape(text)));
      }
    }

    if (!ended) {
      throw new SyntaxError(`Invalid state pattern ${JSON.stringify(pattern)}`);
    }

    return regexSourcePartials.join('');
  }

  function unescape(pattern: string): string {
    return pattern.replace(/\\([^])/g, '$1');
  }
}

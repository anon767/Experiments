import ansiStyles from 'ansi-styles';
import isFullwidthCodePoint from 'is-fullwidth-code-point';

const ESCAPE_CODE_POINT = 27;
const C1_DCS_CODE_POINT = 144;
const C1_SOS_CODE_POINT = 152;
const C1_CSI_CODE_POINT = 155;
const C1_ST_CODE_POINT = 156;
const C1_OSC_CODE_POINT = 157;
const C1_PM_CODE_POINT = 158;
const C1_APC_CODE_POINT = 159;
const ESCAPES = new Set([
	ESCAPE_CODE_POINT,
	C1_DCS_CODE_POINT,
	C1_SOS_CODE_POINT,
	C1_CSI_CODE_POINT,
	C1_ST_CODE_POINT,
	C1_OSC_CODE_POINT,
	C1_PM_CODE_POINT,
	C1_APC_CODE_POINT,
]);

const ESCAPE = '\u001B';
const ANSI_BELL = '\u0007';
const ANSI_CSI = '[';
const ANSI_OSC = ']';
const ANSI_DCS = 'P';
const ANSI_SOS = 'X';
const ANSI_PM = '^';
const ANSI_APC = '_';
const ANSI_SGR_TERMINATOR = 'm';
const ANSI_OSC_TERMINATOR = '\\';
const ANSI_STRING_TERMINATOR = `${ESCAPE}${ANSI_OSC_TERMINATOR}`;
const C1_OSC = '\u009D';
const C1_STRING_TERMINATOR = '\u009C';
const ANSI_HYPERLINK_ESC_PREFIX = `${ESCAPE}${ANSI_OSC}8;`;
const ANSI_HYPERLINK_C1_PREFIX = `${C1_OSC}8;`;
const ANSI_HYPERLINK_ESC_CLOSE = `${ANSI_HYPERLINK_ESC_PREFIX};`;
const ANSI_HYPERLINK_C1_CLOSE = `${ANSI_HYPERLINK_C1_PREFIX};`;

const CODE_POINT_0 = '0'.codePointAt(0);
const CODE_POINT_9 = '9'.codePointAt(0);
const CODE_POINT_SEMICOLON = ';'.codePointAt(0);
const CODE_POINT_COLON = ':'.codePointAt(0);
const CODE_POINT_CSI_PARAMETER_START = '0'.codePointAt(0);
const CODE_POINT_CSI_PARAMETER_END = '?'.codePointAt(0);
const CODE_POINT_CSI_INTERMEDIATE_START = ' '.codePointAt(0);
const CODE_POINT_CSI_INTERMEDIATE_END = '/'.codePointAt(0);
const CODE_POINT_CSI_FINAL_START = '@'.codePointAt(0);
const CODE_POINT_CSI_FINAL_END = '~'.codePointAt(0);
const REGIONAL_INDICATOR_SYMBOL_LETTER_A = 127_462;
const REGIONAL_INDICATOR_SYMBOL_LETTER_Z = 127_487;

const endCodeNumbers = new Set();
for (const [, end] of ansiStyles.codes) {
	endCodeNumbers.add(end);
}

function isSgrParameterCharacter(codePoint) {
	return (
		(codePoint >= CODE_POINT_0 && codePoint <= CODE_POINT_9)
		|| codePoint === CODE_POINT_SEMICOLON
		|| codePoint === CODE_POINT_COLON
	);
}

function isCsiParameterCharacter(codePoint) {
	return codePoint >= CODE_POINT_CSI_PARAMETER_START && codePoint <= CODE_POINT_CSI_PARAMETER_END;
}

function isCsiIntermediateCharacter(codePoint) {
	return codePoint >= CODE_POINT_CSI_INTERMEDIATE_START && codePoint <= CODE_POINT_CSI_INTERMEDIATE_END;
}

function isCsiFinalCharacter(codePoint) {
	return codePoint >= CODE_POINT_CSI_FINAL_START && codePoint <= CODE_POINT_CSI_FINAL_END;
}

function isRegionalIndicatorCodePoint(codePoint) {
	return codePoint >= REGIONAL_INDICATOR_SYMBOL_LETTER_A && codePoint <= REGIONAL_INDICATOR_SYMBOL_LETTER_Z;
}

function createControlParseResult(code, endIndex) {
	return {
		token: {
			type: 'control',
			code,
		},
		endIndex,
	};
}

function getSgrPrefix(code) {
	if (code.startsWith('\u009B')) {
		return '\u009B';
	}

	return `${ESCAPE}${ANSI_CSI}`;
}

function createSgrCode(prefix, values) {
	return `${prefix}${values.join(';')}${ANSI_SGR_TERMINATOR}`;
}

function getSgrFragments(code) {
	const fragments = [];
	const sgrPrefix = getSgrPrefix(code);
	let parameterString;

	if (code.startsWith(`${ESCAPE}${ANSI_CSI}`)) {
		parameterString = code.slice(2, -1);
	} else if (code.startsWith('\u009B')) {
		parameterString = code.slice(1, -1);
	} else {
		return fragments;
	}

	const rawCodes = parameterString.length === 0 ? ['0'] : parameterString.split(';');
	let index = 0;
	while (index < rawCodes.length) {
		const codeNumber = Number.parseInt(rawCodes[index], 10);
		if (Number.isNaN(codeNumber)) {
			index++;
			continue;
		}

		if (codeNumber === 0) {
			fragments.push({type: 'reset'});
			index++;
			continue;
		}

		if (codeNumber === 38 || codeNumber === 48) {
			const colorType = Number.parseInt(rawCodes[index + 1], 10);
			if (colorType === 5 && index + 2 < rawCodes.length) {
				const openCode = createSgrCode(sgrPrefix, rawCodes.slice(index, index + 3));
				fragments.push({
					type: 'start',
					code: openCode,
					endCode: ansiStyles.color.ansi(codeNumber === 38 ? 39 : 49),
				});
				index += 3;
				continue;
			}

			if (colorType === 2 && index + 4 < rawCodes.length) {
				const openCode = createSgrCode(sgrPrefix, rawCodes.slice(index, index + 5));
				fragments.push({
					type: 'start',
					code: openCode,
					endCode: ansiStyles.color.ansi(codeNumber === 38 ? 39 : 49),
				});
				index += 5;
				continue;
			}

			const openCode = createSgrCode(sgrPrefix, [rawCodes[index]]);
			fragments.push({
				type: 'start',
				code: openCode,
				endCode: ansiStyles.color.ansi(codeNumber === 38 ? 39 : 49),
			});
			index++;
			continue;
		}

		if (endCodeNumbers.has(codeNumber)) {
			fragments.push({
				type: 'end',
				endCode: ansiStyles.color.ansi(codeNumber),
			});
			index++;
			continue;
		}

		const mappedEndCode = ansiStyles.codes.get(codeNumber);
		if (mappedEndCode !== undefined) {
			const openCode = createSgrCode(sgrPrefix, [rawCodes[index]]);
			fragments.push({
				type: 'start',
				code: openCode,
				endCode: ansiStyles.color.ansi(mappedEndCode),
			});
			index++;
			continue;
		}

		const openCode = createSgrCode(sgrPrefix, [rawCodes[index]]);
		fragments.push({
			type: 'start',
			code: openCode,
			endCode: ansiStyles.reset.open,
		});
		index++;
	}

	if (fragments.length === 0) {
		fragments.push({type: 'reset'});
	}

	return fragments;
}

function parseCsiCode(string, index) {
	const escapeCodePoint = string.codePointAt(index);
	let sequenceStartIndex;

	if (escapeCodePoint === ESCAPE_CODE_POINT) {
		if (string[index + 1] !== ANSI_CSI) {
			return;
		}

		sequenceStartIndex = index + 2;
	} else if (escapeCodePoint === C1_CSI_CODE_POINT) {
		sequenceStartIndex = index + 1;
	} else {
		return;
	}

	let hasCanonicalSgrParameters = true;
	for (let sequenceIndex = sequenceStartIndex; sequenceIndex < string.length; sequenceIndex++) {
		const codePoint = string.codePointAt(sequenceIndex);

		if (isCsiFinalCharacter(codePoint)) {
			const code = string.slice(index, sequenceIndex + 1);
			if (string[sequenceIndex] !== ANSI_SGR_TERMINATOR || !hasCanonicalSgrParameters) {
				return createControlParseResult(code, sequenceIndex + 1);
			}

			return {
				token: {
					type: 'sgr',
					code,
					fragments: getSgrFragments(code),
				},
				endIndex: sequenceIndex + 1,
			};
		}

		if (isCsiParameterCharacter(codePoint)) {
			if (!isSgrParameterCharacter(codePoint)) {
				hasCanonicalSgrParameters = false;
			}

			continue;
		}

		if (isCsiIntermediateCharacter(codePoint)) {
			hasCanonicalSgrParameters = false;
			continue;
		}

		const endIndex = sequenceIndex;
		return createControlParseResult(string.slice(index, endIndex), endIndex);
	}

	return createControlParseResult(string.slice(index), string.length);
}

function parseHyperlinkCode(string, index) {
	let hyperlinkPrefix;
	let hyperlinkClose;
	const codePoint = string.codePointAt(index);

	if (
		codePoint === ESCAPE_CODE_POINT
		&& string.startsWith(ANSI_HYPERLINK_ESC_PREFIX, index)
	) {
		hyperlinkPrefix = ANSI_HYPERLINK_ESC_PREFIX;
		hyperlinkClose = ANSI_HYPERLINK_ESC_CLOSE;
	} else if (
		codePoint === C1_OSC_CODE_POINT
		&& string.startsWith(ANSI_HYPERLINK_C1_PREFIX, index)
	) {
		hyperlinkPrefix = ANSI_HYPERLINK_C1_PREFIX;
		hyperlinkClose = ANSI_HYPERLINK_C1_CLOSE;
	} else {
		return;
	}

	const uriStart = string.indexOf(';', index + hyperlinkPrefix.length);
	if (uriStart === -1) {
		return createControlParseResult(string.slice(index), string.length);
	}

	for (let sequenceIndex = uriStart + 1; sequenceIndex < string.length; sequenceIndex++) {
		const character = string[sequenceIndex];

		if (character === ANSI_BELL) {
			const code = string.slice(index, sequenceIndex + 1);
			const action = sequenceIndex === uriStart + 1 ? 'close' : 'open';
			return {
				token: {
					type: 'hyperlink',
					code,
					action,
					closePrefix: hyperlinkClose,
					terminator: ANSI_BELL,
				},
				endIndex: sequenceIndex + 1,
			};
		}

		if (
			character === ESCAPE
			&& string[sequenceIndex + 1] === ANSI_OSC_TERMINATOR
		) {
			const code = string.slice(index, sequenceIndex + 2);
			const action = sequenceIndex === uriStart + 1 ? 'close' : 'open';
			return {
				token: {
					type: 'hyperlink',
					code,
					action,
					closePrefix: hyperlinkClose,
					terminator: ANSI_STRING_TERMINATOR,
				},
				endIndex: sequenceIndex + 2,
			};
		}

		if (character === C1_STRING_TERMINATOR) {
			const code = string.slice(index, sequenceIndex + 1);
			const action = sequenceIndex === uriStart + 1 ? 'close' : 'open';
			return {
				token: {
					type: 'hyperlink',
					code,
					action,
					closePrefix: hyperlinkClose,
					terminator: C1_STRING_TERMINATOR,
				},
				endIndex: sequenceIndex + 1,
			};
		}
	}

	return createControlParseResult(string.slice(index), string.length);
}

function parseControlStringCode(string, index) {
	const codePoint = string.codePointAt(index);
	let sequenceStartIndex;
	let supportsBellTerminator = false;

	switch (codePoint) {
		case ESCAPE_CODE_POINT: {
			const command = string[index + 1];
			switch (command) {
				case ANSI_OSC: {
					sequenceStartIndex = index + 2;
					supportsBellTerminator = true;
					break;
				}

				case ANSI_DCS:
				case ANSI_SOS:
				case ANSI_PM:
				case ANSI_APC: {
					sequenceStartIndex = index + 2;
					break;
				}

				case ANSI_OSC_TERMINATOR: {
					return createControlParseResult(ANSI_STRING_TERMINATOR, index + 2);
				}

				default: {
					return;
				}
			}

			break;
		}

		case C1_OSC_CODE_POINT: {
			sequenceStartIndex = index + 1;
			supportsBellTerminator = true;
			break;
		}

		case C1_DCS_CODE_POINT:
		case C1_SOS_CODE_POINT:
		case C1_PM_CODE_POINT:
		case C1_APC_CODE_POINT: {
			sequenceStartIndex = index + 1;
			break;
		}

		case C1_ST_CODE_POINT: {
			return createControlParseResult(C1_STRING_TERMINATOR, index + 1);
		}

		default: {
			return;
		}
	}

	for (let sequenceIndex = sequenceStartIndex; sequenceIndex < string.length; sequenceIndex++) {
		if (supportsBellTerminator && string[sequenceIndex] === ANSI_BELL) {
			return createControlParseResult(string.slice(index, sequenceIndex + 1), sequenceIndex + 1);
		}

		if (
			string[sequenceIndex] === ESCAPE
			&& string[sequenceIndex + 1] === ANSI_OSC_TERMINATOR
		) {
			return createControlParseResult(string.slice(index, sequenceIndex + 2), sequenceIndex + 2);
		}

		if (string[sequenceIndex] === C1_STRING_TERMINATOR) {
			return createControlParseResult(string.slice(index, sequenceIndex + 1), sequenceIndex + 1);
		}
	}

	return createControlParseResult(string.slice(index), string.length);
}

function parseAnsiCode(string, index) {
	const codePoint = string.codePointAt(index);
	if (codePoint === ESCAPE_CODE_POINT || codePoint === C1_OSC_CODE_POINT) {
		const hyperlinkCode = parseHyperlinkCode(string, index);
		if (hyperlinkCode) {
			return hyperlinkCode;
		}
	}

	const controlStringCode = parseControlStringCode(string, index);
	if (controlStringCode) {
		return controlStringCode;
	}

	return parseCsiCode(string, index);
}

function appendTrailingAnsiTokens(string, index, tokens) {
	while (index < string.length) {
		const nextCodePoint = string.codePointAt(index);
		if (!ESCAPES.has(nextCodePoint)) {
			break;
		}

		const escapeCode = parseAnsiCode(string, index);
		if (!escapeCode) {
			break;
		}

		tokens.push(escapeCode.token);
		index = escapeCode.endIndex;
	}

	return index;
}

function parseCharacterToken(string, index) {
	const codePoint = string.codePointAt(index);
	let value = String.fromCodePoint(codePoint);
	let endIndex = index + value.length;
	let isFullWidth = isFullwidthCodePoint(codePoint);

	if (
		isRegionalIndicatorCodePoint(codePoint)
		&& endIndex < string.length
	) {
		const nextCodePoint = string.codePointAt(endIndex);
		if (isRegionalIndicatorCodePoint(nextCodePoint)) {
			const nextValue = String.fromCodePoint(nextCodePoint);
			value += nextValue;
			endIndex += nextValue.length;
			isFullWidth = true;
		}
	}

	return {
		token: {
			type: 'character',
			value,
			isFullWidth,
		},
		endIndex,
	};
}

export default function tokenizeAnsi(string, {endCharacter = Number.POSITIVE_INFINITY} = {}) {
	const tokens = [];

	let index = 0;
	let visibleCount = 0;
	while (index < string.length) {
		const codePoint = string.codePointAt(index);

		if (ESCAPES.has(codePoint)) {
			const code = parseAnsiCode(string, index);
			if (code) {
				tokens.push(code.token);
				index = code.endIndex;
				continue;
			}
		}

		const characterToken = parseCharacterToken(string, index);
		tokens.push(characterToken.token);
		index = characterToken.endIndex;
		visibleCount += characterToken.token.isFullWidth ? 2 : characterToken.token.value.length;

		if (visibleCount >= endCharacter) {
			index = appendTrailingAnsiTokens(string, index, tokens);
			break;
		}
	}

	return tokens;
}

const promptOutput = document.getElementById("prompt");
const rerollLink = document.getElementById("reroll");
const copyLink = document.getElementById("copy");
const footer = document.getElementsByTagName("footer")[0];
const mainWrapper = document.getElementsByTagName("main")[0];
const historySidebar = document.getElementById("history");

/**
 * @typedef {{ name?: string, options: string[] }} List
 * @typedef {{ prompts: string[], lists: Record<string, List> }} Data
 * @type {Data}
 */
let data;
/**
 * @type {InterpolatedText[]}
 */
let prompts;

(async function () {
	data = await fetch("data.json").then(response => response.json());
	prompts = data.prompts.map(prompt => new InterpolatedText(prompt));

	generate();
	document.body.addEventListener("click", generate);
	rerollLink?.addEventListener("click", generate);
	copyLink?.addEventListener("click", copy);
	for (const toggleLink of elements("[data-toggle]"))
		toggleLink.addEventListener("click", toggleAside);
})();

/**
 * @param {MouseEvent} target 
 */
function toggleAside (target) {
	const toggleLink = element(target);

	const sidebarId = toggleLink?.dataset.toggle || "";
	const sidebarElement = document.getElementById(sidebarId);
	if (!sidebarElement || !toggleLink) {
		console.warn("Sidebar element not found:", sidebarId);
		return;
	}

	mainWrapper.classList.toggle("viewing-aside", toggleLink.classList.toggle("open", sidebarElement.classList.toggle("open")));
	for (const otherSidebarOrToggleLinkElement of elements("aside, [data-toggle]"))
		if (otherSidebarOrToggleLinkElement !== sidebarElement && otherSidebarOrToggleLinkElement !== toggleLink)
			otherSidebarOrToggleLinkElement.classList.remove("open");
}

/**
 * @param {MouseEvent} event 
 */
async function copy (event) {
	await navigator.clipboard.writeText(element(event)?.textContent || "");

	const notif = document.createElement("h4");
	notif.classList.add("notification");
	notif.textContent = "Copied!";
	footer.appendChild(notif);
	await sleep(2000);
	notif.classList.add("hide");
	await sleep(1000);
	notif.remove();
}

/**
 * @type {InterpolatedText[]}
 */
const promptHistory = [];

/**
 * @param {MouseEvent} [event]
 */
function generate (event) {
	if (!promptOutput || element(event)?.closest("a"))
		return;

	const prompt = choice(prompts).cloneRandom();
	promptOutput.innerHTML = ""; // TODO perf
	renderInterpolatedContent(promptOutput, prompt);

	const historyItem = document.createElement("a");
	historyItem.href = "#";
	historyItem.addEventListener("click", focusHistoryItem);
	historyItem.textContent = sentence(prompt.compile());

	historySidebar?.insertBefore(historyItem, historySidebar.firstChild);
	randomiseHue();
}

/**
 * @param {HTMLElement} wrapperElement
 * @param {Segment | string | (Segment | string)[]} segment 
 */
function renderInterpolatedContent (wrapperElement, segment) {
	let segmentElement = document.createElement("span");
	if (typeof segment === "string") {
		segmentElement.textContent = segment;

	} else if (Array.isArray(segment)) {
		for (const subSegment of segment)
			renderInterpolatedContent(wrapperElement, subSegment);

	} else {
		renderInterpolatedContent(segmentElement, segment.value);
		if (segment instanceof Randomiser && segment.options.length > 1) {
			const editLink = document.createElement("a");
			editLink.classList.add("edit");
			editLink.href = "#";
			editLink.innerHTML = "✏&#xFE0F;";
			editLink.setAttribute("aria-label", `edit ${segment.name ?? `"${segmentElement.textContent}"`}`);
			editLink.addEventListener("click", editRandomisedSegment);

			const wrapperSegmentElement = document.createElement("span");
			wrapperSegmentElement.classList.add("editable-wrapper");
			wrapperSegmentElement.append(editLink, segmentElement);
			segmentElement = wrapperSegmentElement;
		}
	}

	if (segmentElement.textContent?.length)
		wrapperElement.appendChild(segmentElement);
}

function focusHistoryItem () {
	throw new Error("Unimplemented");
}

function editRandomisedSegment () {
	throw new Error("Unimplemented");
}

/**
 * @param {string} sentence 
 */
function sentence (sentence) {
	return sentence[0].toUpperCase() + sentence.slice(1);
}

/**
 * @template T
 * @param {T[]} options 
 */
function choice (options) {
	return options[Math.floor(Math.random() * options.length)];
}

/**
 * @param {number} chance 
 */
function chance (chance = 0.5) {
	return Math.random() < chance;
}

function randomiseHue () {
	const angle = Math.floor(Math.random() * 360);
	document.documentElement.style.setProperty("--hue-angle", `${angle}deg`);
	document.documentElement.style.setProperty("--background-color", `#${hueRotate("2c2244", angle)}`);
	document.documentElement.style.setProperty("--text-color", `#${hueRotate("bb83d3", angle)}`);
	document.documentElement.style.setProperty("--hover-color", `#${hueRotate("d9a9ee", angle)}`);
}

/**
 * From https://jsfiddle.net/Camilo/dd6feyh6/
 * @param {string} color 
 * @param {number} angle 
 */
function hueRotate (color, angle) {
	// Get the RGB and angle to work with.
	const r = parseInt(color.substr(0, 2), 16);
	const g = parseInt(color.substr(2, 2), 16);
	const b = parseInt(color.substr(4, 2), 16);
	angle = (angle % 360 + 360) % 360;

	// Hold your breath because what follows isn't flowers.

	const matrix = [ // Just remember this is the identity matrix for
		1, 0, 0,   // Reds
		0, 1, 0,   // Greens
		0, 0, 1    // Blues
	];

	// Luminance coefficients.
	const lumR = 0.2126;
	const lumG = 0.7152;
	const lumB = 0.0722;

	// Hue rotate coefficients.
	const hueRotateR = 0.143;
	const hueRotateG = 0.140;
	const hueRotateB = 0.283;

	const cos = Math.cos(angle * Math.PI / 180);
	const sin = Math.sin(angle * Math.PI / 180);

	matrix[0] = lumR + (1 - lumR) * cos - lumR * sin;
	matrix[1] = lumG - lumG * cos - lumG * sin;
	matrix[2] = lumB - lumB * cos + (1 - lumB) * sin;

	matrix[3] = lumR - lumR * cos + hueRotateR * sin;
	matrix[4] = lumG + (1 - lumG) * cos + hueRotateG * sin;
	matrix[5] = lumB - lumB * cos - hueRotateB * sin;

	matrix[6] = lumR - lumR * cos - (1 - lumR) * sin;
	matrix[7] = lumG - lumG * cos + lumG * sin;
	matrix[8] = lumB + (1 - lumB) * cos + lumB * sin;

	const oR = clamp(matrix[0] * r + matrix[1] * g + matrix[2] * b);
	const oG = clamp(matrix[3] * r + matrix[4] * g + matrix[5] * b);
	const oB = clamp(matrix[6] * r + matrix[7] * g + matrix[8] * b);
	return `${oR.toString(16).padStart(2, "0")}${oG.toString(16).padStart(2, "0")}${oB.toString(16).padStart(2, "0")}`;
}

/**
 * @param {number} num 
 */
function clamp (num) {
	return Math.round(Math.max(0, Math.min(255, num)));
}

/**
 * @param {Event | string} [eventOrSelector]
 */
function element (eventOrSelector) {
	const result = typeof eventOrSelector === "string" ? document.querySelector(eventOrSelector) : eventOrSelector?.target;
	return /** @type {HTMLElement | undefined} */ (result);
}

/**
 * @param {string} selector 
 */
function elements (selector) {
	return /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(selector));
}

/**
 * @param {number} ms
 */
async function sleep (ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * @typedef {{ readonly value: Segment | string | (Segment | string)[], cloneRandom(): Segment }} Segment
 * @implements {Segment} 
 */
class InterpolatedText {
	/**
	 * @param {string} str 
	 */
	constructor (str, i = 0) {
		/**
		 * @type {number}
		 */
		this.length;
		/**
		 * @private
		 * @type {(Segment | string)[]}
		 */
		this._value;

		/**
		 * @type {(Segment | string)[]}
		 */
		const result = [];

		for (; i < str.length; i++) {
			if (str[i] === "}") {
				break;
			}

			if (str[i] === "{") {
				i++;
				if (str[i] === "?") {
					const optionalResult = new InterpolatedText(str, ++i);
					result.push(new Randomiser(["", optionalResult]));
					i = optionalResult.length;
					continue;

				} else {
					const optionsResult = parseOptions(str, i);
					i = optionsResult.i;

					result.push(new Randomiser(optionsResult.options.map(option => {
						if (option[0] !== "#")
							return option

						const endIndex = option.indexOf("}");
						if (endIndex > -1)
							i += endIndex;

						const listId = option.slice(1, endIndex === -1 ? undefined : endIndex);
						const list = data.lists[listId];
						if (!list)
							return `{NOT FOUND ${listId}}`;

						else
							return new Randomiser(list.options.map(option => new InterpolatedText(option)), list.name);
					})));
				}

				continue;
			}

			if (typeof result[result.length - 1] !== "string")
				result.push("");

			result[result.length - 1] += str[i];
		}

		this._value = result;
		this.length = i;
	}

	/**
	 * @returns {(Segment | string)[]}
	 */
	get value () {
		return this._value;
	}

	cloneRandom () {
		const result = new InterpolatedText("");
		result._value = cloneSegments(this.value);
		result.length = this.length;
		return result;
	}

	compile () {
		return compileSegments(this._value);
	}
}

/**
 * @param {(Segment | string)[]} segments 
 * @returns {string}
 */
function compileSegments (segments) {
	return segments.map(compileSegment).join("");
}

/**
 * @param {Segment | string | (Segment | string)[]} segment
 * @returns {string}
 */
function compileSegment (segment) {
	if (typeof segment === "string")
		return segment;

	if (Array.isArray(segment))
		return compileSegments(segment);

	return compileSegment(segment.value);
}

/**
 * @param {(Segment | string)[]} segments
 * @returns {(Segment | string)[]}
 */
function cloneSegments (segments) {
	return segments.map(cloneSegment);
}

/**
 * @template {string | Segment | (Segment | string)[]} T
 * @param {T} segment 
 */
function cloneSegment (segment) {
	return /** @type {T} */ (typeof segment === "string" ? segment
		: Array.isArray(segment) ? cloneSegments(/** @type {(Segment | string)[]} */(segment))
			: (/** @type {Segment} */ (segment)).cloneRandom());
}

/**
 * @implements {Segment}
 */
class Randomiser {
	/**
	 * @param {(Segment | string)[]} options 
	 * @param {string} [name]
	 */
	constructor (options, name) {
		/**
		 * @readonly
		 */
		this.options = options;
		/**
		 * @readonly
		 */
		this.name = name;
		/**
		 * @type {Segment | string}
		 */
		this.value;
		this.randomise();
	}

	randomise () {
		return this.value = choice(this.options);
	}

	cloneRandom () {
		return new Randomiser(this.options.map(cloneSegment), this.name);
	}
}

/**
 * @param {string} str 
 * @param {number} i 
 */
function parseOptions (str, i) {
	let options = [""];
	for (; i < str.length; i++) {
		if (str[i] === "}")
			break;

		if (str[i] === "|") {
			options.push("");
			continue;
		}

		options[options.length - 1] += str[i];
	}

	return { options, i };
}

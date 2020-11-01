const promptOutput = document.getElementById("prompt");
const rerollLink = document.getElementById("reroll");
const copyLink = document.getElementById("copy");
const footer = document.getElementsByTagName("footer")[0];
const mainWrapper = document.getElementsByTagName("main")[0];
const historySidebar = document.getElementById("history");
const optionsDialog = dialog("dialog-options");
/** @type {any} */ (window).dialogPolyfill.registerDialog(optionsDialog);
const optionsDialogList = document.getElementById("dialog-options-list");

/**
 * @typedef {{ name?: string, options: string[] }} List
 * @typedef {{ prompts: string[], lists: Record<string, List> }} Data
 * @type {Data}
 */
let data;
/**
 * @type {Data}
 */
let originalData;
/**
 * @type {InterpolatedText[]}
 */
let prompts;

(async function () {
	originalData = data = await fetch("data.json").then(response => response.json());
	prompts = data.prompts.map(prompt => new InterpolatedText(prompt));

	generateNewPrompt();
	document.body.addEventListener("mousedown", onDocumentMouseDown);
	document.body.addEventListener("click", onDocumentClick);
	rerollLink?.addEventListener("click", generateNewPrompt);
	copyLink?.addEventListener("click", copy);
	for (const toggleLink of elements("[data-toggle]"))
		toggleLink.addEventListener("click", toggleAside);

	initialiseEditor();
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
	const copyTarget = element(event);
	if (copyTarget?.closest(".edit, dialog") || !promptOutput)
		return;

	await navigator.clipboard.writeText(promptOutput.textContent?.replace(/✏️/g, "") || "");

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
 * @type {Element | null}
 */
let lastFocusedElement = null;

function onDocumentMouseDown () {
	lastFocusedElement = document.activeElement;
}

/**
 * @param {MouseEvent} [event]
 */
function onDocumentClick (event) {
	const target = element(event);
	if (!target)
		return;

	if (target.closest("dialog") && !target.closest("form"))
		optionsDialog?.close("");

	else if (!target?.closest("a, dialog, details") && lastFocusedElement === document.body)
		generateNewPrompt();

	lastFocusedElement = null;
}

function generateNewPrompt () {
	const prompt = choice(prompts).clone(true);
	renderPrompt(prompt);
	addPromptToHistory(prompt);
}

/**
 * @param {InterpolatedText} prompt 
 */
function addPromptToHistory (prompt) {
	promptHistory.push(prompt);

	const historyItem = document.createElement("a");
	historyItem.href = "#";
	historyItem.addEventListener("click", onClickHistoryItem);
	historyItem.textContent = sentence(prompt.compile());

	historySidebar?.insertBefore(historyItem, historySidebar.firstChild);
}

/**
 * @param {InterpolatedText} prompt
 */
function renderPrompt (prompt) {
	if (!promptOutput)
		return;

	setHue(prompt.randomNumber);
	promptOutput.innerHTML = ""; // TODO perf
	editableSegments.clear();
	renderInterpolatedContent(promptOutput, prompt, true);
}

/**
 * @type {Map<number | undefined, Randomiser>}
 */
const editableSegments = new Map();

/**
 * @param {HTMLElement} wrapperElement
 * @param {Segment | string | (Segment | string)[]} segment 
 */
function renderInterpolatedContent (wrapperElement, segment, useSentenceCase = false) {
	let segmentElement = document.createElement("span");
	if (typeof segment === "string") {
		segmentElement.textContent = useSentenceCase ? sentence(segment) : segment;

	} else if (Array.isArray(segment)) {
		for (const subSegment of segment) {
			renderInterpolatedContent(wrapperElement, subSegment, useSentenceCase);
			useSentenceCase = false;
		}

	} else {
		renderInterpolatedContent(segmentElement, segment.value, useSentenceCase);
		if (segment instanceof Randomiser && segment.options.length > 1) {
			const id = Math.random();
			editableSegments.set(id, segment);

			const editLink = document.createElement("a");
			editLink.classList.add("edit");
			editLink.href = "#";

			const span = document.createElement("span");
			span.innerHTML = "✏&#xFE0F;";
			span.classList.add("emoji");
			editLink.appendChild(span);

			editLink.setAttribute("aria-label", `edit ${segment.name ?? `"${segmentElement.textContent}"`}`);
			editLink.dataset.segmentId = `${id}`;
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

/**
 * @param {Event} event 
 */
function onClickHistoryItem (event) {
	focusHistoryItem(element(event));
}

/**
 * @param {Element | undefined} historyItemLink 
 */
function focusHistoryItem (historyItemLink) {
	if (!historyItemLink?.parentElement)
		return;

	const index = historyItemLink.parentElement.childElementCount - [...historyItemLink.parentElement.children].indexOf(historyItemLink) - 1;
	const [prompt] = promptHistory.splice(index, 1);
	promptHistory.push(prompt);
	historyItemLink.parentElement.insertBefore(historyItemLink, historyItemLink.parentElement.firstChild);
	renderPrompt(prompt);
}

/**
 * @type {number | undefined}
 */
let editingSegment;

/**
 * @param {MouseEvent} event 
 */
function editRandomisedSegment (event) {
	if (!optionsDialog || !optionsDialogList)
		return;

	optionsDialogList.innerHTML = "";

	/**
	 * @type {HTMLAnchorElement | null | undefined}
	 */
	const editLink = element(event)?.closest("a.edit");

	editingSegment = Number(editLink?.dataset.segmentId);
	const segment = editableSegments.get(editingSegment);

	const options = segment?.options
		.map((option, index) => ({ option, index }))
		.sort(({ option: a }, { option: b }) => compileSegment(a).localeCompare(compileSegment(b)))
		?? [];
	for (const { option, index } of options) {

		const optionButton = document.createElement("button");
		optionButton.type = "submit";
		optionButton.value = `${index}`;
		optionButton.textContent = compileSegment(option);
		if (optionButton.textContent === "") {
			const emptyTextLabel = document.createElement("span");
			emptyTextLabel.classList.add("empty");
			emptyTextLabel.textContent = "(no text)";
			optionButton.appendChild(emptyTextLabel);
		}

		const li = document.createElement("li");
		if (option === segment?.value) {
			li.classList.add("selected");
			optionButton.disabled = true;
		}

		li.appendChild(optionButton);
		optionsDialogList.appendChild(li);
	}

	optionsDialog.addEventListener("close", editRandomisedSegmentCloseDialog, { once: true });
	optionsDialog.showModal();
}

function editRandomisedSegmentCloseDialog () {
	if (!optionsDialog?.returnValue)
		return;

	const segmentId = editingSegment;
	editingSegment = undefined;

	const segment = editableSegments.get(segmentId);
	if (!optionsDialog || !segment)
		return;


	const options = segment.options;
	const selectedId = optionsDialog.returnValue;
	const selectedOption = options[Number(selectedId)];
	if (!selectedOption && typeof selectedOption !== "string") {
		console.warn("Unable to find option for segment", segment.name || `"${compileSegment(segment)}"`, "with id", selectedId);
		return;
	}

	const segmentElementWrapper = element(`[data-segment-id="${segmentId}"]`)?.closest(".editable-wrapper");
	if (!segmentElementWrapper) {
		console.warn("Unable to find editable segment being edited", segment.name || `"${compileSegment(segment)}"`);
		return;
	}

	const currentPrompt = promptHistory[promptHistory.length - 1];
	const historyItemLink = historySidebar?.firstElementChild;
	if (!historyItemLink) {
		console.warn("Unable to find history item link for current prompt:", currentPrompt.compile());
		return;
	}

	// clone the current prompt and add it to the top of the history
	addPromptToHistory(currentPrompt.clone(false));

	// update the old prompt segment
	segment.value = selectedOption;
	focusHistoryItem(historyItemLink);
	historyItemLink.textContent = sentence(currentPrompt.compile());
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

/**
 * @param {number} randomNumber A number between 0 and 1 (exclusive)
 */
function setHue (randomNumber) {
	const angle = Math.floor(randomNumber * 360);
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
 * @param {string} id 
 */
function dialog (id) {
	return /** @type {HTMLDialogElement | undefined} */ (document.getElementById(id));
}

/**
 * @param {number} ms
 */
async function sleep (ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * @typedef {{ readonly value: Segment | string | (Segment | string)[], clone(random: boolean): Segment }} Segment
 * @implements {Segment} 
 */
class InterpolatedText {
	/**
	 * @param {string} str 
	 */
	constructor (str, i = 0) {
		this.randomNumber = Math.random();

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

	/**
	 * @param {boolean} random 
	 */
	clone (random) {
		const result = new InterpolatedText("");
		result._value = cloneSegments(this.value, random);
		result.length = this.length;
		if (!random)
			result.randomNumber = this.randomNumber;

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
 * @param {boolean} random
 * @returns {(Segment | string)[]}
 */
function cloneSegments (segments, random) {
	return segments.map(segment => cloneSegment(segment, random));
}

/**
 * @template {string | Segment | (Segment | string)[]} T
 * @param {T} segment 
 * @param {boolean} random
 */
function cloneSegment (segment, random) {
	return /** @type {T} */ (typeof segment === "string" ? segment
		: Array.isArray(segment) ? cloneSegments(/** @type {(Segment | string)[]} */(segment), random)
			: (/** @type {Segment} */ (segment)).clone(random));
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

	/**
	 * @param {boolean} random 
	 */
	clone (random) {
		const result = new Randomiser(this.options.map(option => cloneSegment(option, random)), this.name);
		if (!random)
			result.value = result.options[this.options.indexOf(this.value)];
		return result;
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


////////////////////////////////////
// Editor
//

const promptsWrapper = document.getElementById("prompts");
const listsWrapper = document.getElementById("lists");
const addPromptLink = document.getElementById("add-prompt");

addPromptLink?.addEventListener("click", () =>
	promptsWrapper?.appendChild(li(createEditableText())));

function initialiseEditor () {
	for (const prompt of data.prompts)
		promptsWrapper?.appendChild(li(createEditableText(prompt)));

	for (const [listId, list] of Object.entries(data.lists)) {
		const detailsElement = document.createElement("details");
		detailsElement.appendChild(summary(list.name || listId));

		const listElement = document.createElement("ul");
		detailsElement.appendChild(listElement);

		for (const option of list.options)
			listElement?.appendChild(li(createEditableText(option)));

		const addOptionLink = document.createElement("a");
		addOptionLink.classList.add("button", "inline-block");
		addOptionLink.href = "#";

		const addOptionLinkEmoji = document.createElement("span");
		addOptionLinkEmoji.classList.add("emoji", "is-greyscale", "is-bright");
		addOptionLinkEmoji.textContent = "➕";

		addOptionLink.append(addOptionLinkEmoji, " New Option");
		detailsElement.appendChild(addOptionLink);

		listsWrapper?.appendChild(detailsElement);
	}
}

/**
 * @param {string} [text]
 */
function createEditableText (text) {
	const editor = document.createElement("div");
	editor.setAttribute("contenteditable", "");
	editor.addEventListener("click", editIncludeInterpolation);
	editor.addEventListener("keydown", editInterpolation);

	if (text)
		insertEditableContent(editor, text);

	return editor;
}

/**
 * @param {KeyboardEvent} event 
 */
function editInterpolation (event) {
	const selection = window.getSelection();
	switch (event.key) {
		case "{": {
			const interpolation = classed(span(), "interpolation");
			interpolation.dataset.type = "oneof";
			interpolation.textContent = "\u200B";
			selection?.getRangeAt(0).insertNode(document.createTextNode("\u200B"));
			selection?.getRangeAt(0).insertNode(interpolation);
			selection?.selectAllChildren(interpolation);
			event.preventDefault();
			return false;
		}
		case "|": {
			const punctuation = classed(span(), "punctuation");
			punctuation.dataset.type = "|";
			punctuation.setAttribute("contenteditable", "false");
			handleSelectionChange = false;
			const textNode = document.createTextNode("\u200B");
			selection?.getRangeAt(0).insertNode(textNode);
			selection?.getRangeAt(0).insertNode(punctuation);
			if (punctuation.nextSibling)
				selection?.getRangeAt(0).selectNode(textNode);
			handleSelectionChange = true;
			event.preventDefault();
			return false;
		}
		// case "ArrowLeft":
		// 	if (selection?.anchorOffset === 1 && closestElement(selection.anchorNode)?.previousElementSibling?.classList.contains("interpolation")) {
		// 		if (!selection.anchorNode || !selection.focusNode)
		// 			return;

		// 		selection.setBaseAndExtent(selection.anchorNode, 0, event.shiftKey ? selection.focusNode : selection.anchorNode, event.shiftKey ? selection.focusOffset : 0);
		// 		event.preventDefault();
		// 		return false;
		// 	}
	}
}

let handleSelectionChange = true;
document.addEventListener("selectionchange", () => {
	if (!handleSelectionChange)
		return;

	for (const focusedInterpolation of document.querySelectorAll(".interpolation.focus"))
		focusedInterpolation.classList.remove("focus");

	const selection = document.getSelection();
	const element = closestElement(selection?.isCollapsed || selection?.focusNode === selection?.anchorNode ? selection?.focusNode : null);
	element?.closest(".interpolation")?.classList.add("focus");

	let cursor = selection?.anchorNode?.parentNode?.lastChild;
	while (cursor = cursor?.previousSibling)
		if (cursor?.textContent?.endsWith("\u200B"))
			if (cursor.nextSibling?.textContent === "\u200B")
				cursor.nextSibling.remove();
			else if (cursor?.textContent?.length > 1)
				cursor.textContent = cursor.textContent.replace(/\u200B+$/, "");

	// if (selection?.isCollapsed) {
	// 	if (closestElement(selection?.anchorNode)?.classList.contains("punctuation") && selection?.anchorNode?.parentElement)
	// 		selection?.setBaseAndExtent(selection.anchorNode.parentElement, 0, selection.anchorNode.parentElement, 0);

	// } else {
	// 	if (closestElement(selection?.anchorNode)?.classList.contains("punctuation") && selection?.anchorNode?.parentElement)
	// 		selection?.getRangeAt(0).setStart(selection.anchorNode.parentElement, 0);

	// 	if (closestElement(selection?.focusNode)?.classList.contains("punctuation") && selection?.focusNode?.parentElement)
	// 		selection?.getRangeAt(0).setStart(selection.focusNode.parentElement, 0);
	// }
});

/**
 * @type {Element | undefined}
 */
let editingInterpolation;
/**
 * @param {MouseEvent} event 
 */
function editIncludeInterpolation (event) {
	if (!optionsDialog || !optionsDialogList)
		return;

	if (event.ctrlKey)
		return;

	const interpolation = element(event)?.closest(".interpolation[data-type='include']");
	if (!interpolation)
		return;

	editingInterpolation = interpolation;

	const currentInclude = interpolation.textContent;

	optionsDialogList.innerHTML = "";

	const options = Object.keys(data.lists);
	for (const option of options) {

		const optionButton = document.createElement("button");
		optionButton.type = "submit";
		optionButton.value = option;
		optionButton.textContent = data.lists[option].name || option;

		const li = document.createElement("li");
		if (option === currentInclude) {
			li.classList.add("selected");
			optionButton.disabled = true;
		}

		li.appendChild(optionButton);
		optionsDialogList.appendChild(li);
	}

	optionsDialog.addEventListener("close", editIncludeInterpolationCloseDialog, { once: true });
	optionsDialog.showModal();
}

function editIncludeInterpolationCloseDialog () {
	if (!optionsDialog?.returnValue)
		return;

	const selectedOption = optionsDialog.returnValue;
	if (!selectedOption || !data.lists[selectedOption] || !editingInterpolation)
		return;

	editingInterpolation.textContent = optionsDialog.returnValue;
	editingInterpolation = undefined;
}

/**
 * @param {Element} element
 * @param {string} text
 * @param {number} i
 */
function insertEditableContent (element, text, i = 0, endChars = "}") {
	/**
	 * @type {Node | undefined}
	 */
	let currentNode;
	for (; i < text.length; i++) {
		if (endChars.includes(text[i]))
			break;

		if (text[i] === "{") {
			/**
			 * @type {HTMLElement}
			 */
			let interpolation;
			({ interpolation, i } = createEditableInterpolation(text, ++i));
			element.appendChild(currentNode = interpolation);
		}

		if (currentNode?.nodeType !== Node.TEXT_NODE)
			element.appendChild(currentNode = document.createTextNode(""));

		if (text[i])
			currentNode.textContent += text[i];
	}

	return i;
}

/**
 * @param {string} text 
 * @param {number} i
 */
function createEditableInterpolation (text, i) {
	const interpolation = document.createElement("span");
	interpolation.classList.add("interpolation");
	// const startPunctuation = attributed(classed(span(), "punctuation"), "data-type", "{");
	// interpolation.appendChild(startPunctuation);

	if (text[i] === "?") {
		// startPunctuation.dataset.type = "{?";
		i++;
		interpolation.dataset.type = "potential";

	} else if (text[i] === "#") {
		// startPunctuation.dataset.type = "{#";
		i++;
		interpolation.dataset.type = "include";
		interpolation.classList.add("clickable");

	} else {
		interpolation.dataset.type = "oneof";
		while (text[i - 1] !== "}" && i < text.length) {
			i = insertEditableContent(interpolation, text, i, "}|");
			if (text[i] === "|")
				interpolation.appendChild(attributed(classed(span(), "punctuation"), "data-type", "|"));
			i++;
		}
	}

	if (interpolation.dataset.type !== "oneof") {
		i = insertEditableContent(interpolation, text, i);
		// if (text[i])
		// 	interpolation.appendChild(attributed(classed(span(), "punctuation"), "data-type", text[i]));
		i++;
	}

	return { interpolation, i };
}

/**
 * 
 * @param  {...string | Element} contents
 */
function li (...contents) {
	const li = document.createElement("li");
	li.append(...contents);
	return li;
}

/**
 * 
 * @param  {...string | Element} contents 
 */
function span (...contents) {
	const span = document.createElement("span");
	span.append(...contents);
	return span;
}

/**
 * 
 * @param  {...string | Element} contents 
 */
function summary (...contents) {
	const summary = document.createElement("summary");
	summary.classList.add("button");
	summary.append(...contents);
	return summary;
}

/**
 * @template {Element} T
 * @param {T} element 
 * @param {...string} classes 
 * @returns {T}
 */
function classed (element, ...classes) {
	element.classList.add(...classes);
	return element;
}

/**
 * @template {Element} T
 * @param {T} element 
 * @param {string} attr
 * @returns {T}
 */
function attributed (element, attr, val = "") {
	element.setAttribute(attr, val);
	return element;
}

/**
 * @param {Node | null | undefined} [node]
 */
function asElement (node) {
	return node?.nodeType === Node.ELEMENT_NODE ? /** @type {HTMLElement} */ (node) : undefined;
}

/**
 * @param {Node | null | undefined} [node]
 */
function closestElement (node) {
	do {
		const element = asElement(node);
		if (element)
			return element;
	} while (node = node?.parentNode);

	return undefined;
}

/**
 * @param {Node} node 
 * @param {Node} parent 
 */
function appendedTo (node, parent) {
	parent.appendChild(node);
	return node;
}

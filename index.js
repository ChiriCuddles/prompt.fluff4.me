

const promptOutput = document.getElementById("prompt");
const rerollLink = document.getElementById("reroll");
const copyLink = document.getElementById("copy");
const footer = document.getElementsByTagName("footer")[0];
const historyLink = document.getElementById("view-history");
const historySidebar = document.getElementById("history");
const mainWrapper = document.getElementsByTagName("main")[0];

/**
 * @typedef {{ name?: string, options: string[] }} List
 * @typedef {{ prompts: string[], lists: Record<string, List> }} Data
 * @type {Data}
 */
let data;

(async function () {
	data = await fetch("data.json").then(response => response.json());
	generate();
	document.body.addEventListener("click", generate);
	rerollLink.addEventListener("click", generate);
	copyLink.addEventListener("click", copy);
	historyLink.addEventListener("click", toggleHistory);
})();

function toggleHistory () {
	mainWrapper.classList.toggle("viewing-history");
}

function randomiseHue () {
	const angle = Math.floor(Math.random() * 360);
	document.documentElement.style.setProperty("--background-color", `#${hueRotate("2c2244", angle)}`);
	document.documentElement.style.setProperty("--text-color", `#${hueRotate("bb83d3", angle)}`);
	document.documentElement.style.setProperty("--hover-color", `#${hueRotate("d9a9ee", angle)}`);
}

/**
 * @param {MouseEvent} event 
 */
async function copy (event) {
	const target = /** @type {HTMLElement} */ (event.target);
	await navigator.clipboard.writeText(target.textContent);

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
 * @param {number} ms
 */
async function sleep (ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * @param {MouseEvent} [event]
 */
function generate (event) {
	const target = /** @type {HTMLElement} */ (event?.target);
	if (target?.closest("a"))
		return;

	const historyItem = document.createElement("a");
	historyItem.href = "#";
	historyItem.addEventListener("click", copy);
	historyItem.textContent = promptOutput.textContent = sentence(interpolate(choice(data.prompts)).result);
	historySidebar.insertBefore(historyItem, historySidebar.firstChild);
	randomiseHue();
}

/**
 * @param {string} sentence 
 */
function sentence (sentence) {
	return sentence[0].toUpperCase() + sentence.slice(1);
}

/**
 * @param {string[]} options 
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
 * @param {string} str 
 */
function interpolate (str, i = 0) {
	let result = "";

	for (; i < str.length; i++) {
		if (str[i] === "}") {
			return { result, i };
		}

		if (str[i] === "{") {
			i++;
			if (str[i] === "?") {
				const optionalResult = interpolate(str, ++i);
				if (chance())
					result += optionalResult.result;
				i = optionalResult.i;

				continue;

			} else {
				const optionsResult = parseOptions(str, i);
				i = optionsResult.i;

				const option = choice(optionsResult.options);
				if (option[0] !== "#") {
					result += option;
					continue;
				}

				const endIndex = option.indexOf("}");
				if (endIndex > -1)
					i += endIndex;

				const listId = option.slice(1, endIndex === -1 ? undefined : endIndex);
				const list = data.lists[listId];
				result += list ? interpolate(choice(list.options)).result
					: `{NOT FOUND ${listId}}`;
			}

			continue;
		}

		result += str[i];
	}

	return { result, i };
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

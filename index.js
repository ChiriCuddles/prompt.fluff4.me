

const promptOutput = document.getElementById("prompt");
const rerollLink = document.getElementById("reroll");
const copyLink = document.getElementById("copy");
const footer = document.getElementsByTagName("footer")[0];

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
})();

function randomiseHue () {
	document.documentElement.style.setProperty("filter", `hue-rotate(${Math.floor(Math.random() * 360)}deg)`);
}

async function copy () {
	await navigator.clipboard.writeText(promptOutput.textContent);

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
	if (target?.closest("#copy"))
		return;

	promptOutput.textContent = sentence(interpolate(choice(data.prompts)).result);
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

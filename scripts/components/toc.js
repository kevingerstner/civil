const observer = new IntersectionObserver((entries) => {
	for (let index = entries.length - 1; index >= 0; index--) {
		const id = entries[index].target.getAttribute("id");
		//if (!entry.isIntersecting) console.log(id + "is not intersecting");
		if (entries[index].isIntersecting) {
			document.querySelectorAll(".toc-active").forEach((activeElement) => {
				activeElement.classList.remove("toc-active");
			});
			document.querySelector(`a[href="#${id}"]`).classList.add("toc-active");
		}
	}
});

document
	.getElementById("content")
	.querySelectorAll("h2")
	.forEach((heading, i) => {
		observer.observe(heading);
		//heading.setAttribute("id", "toc-" + i); // give each h2 a unique id
		let str = heading.innerHTML; // adds section titles to slugs
		str = str
			.replace(/\s+/g, "-")
			.replace(/[°&\/\\#,+()$~%.'":;*?<>{}]/g, "")
			.toLowerCase(); // replaces spaces with hyphens, removes special characters and extra spaces from the headings, and applies lowercase in slugs
		heading.setAttribute("id", str); // gives each heading a unique id

		//Create TOC items
		const item = document.createElement("a"); // creates an anchor element called "item" for each h2
		item.classList.add("toc-class_item"); // gives each item the correct class
		if (i === 0) item.classList.add("toc-active");
		item.setAttribute("href", "#" + str); // gives each item the correct anchor link
		document.querySelector("#toc").appendChild(item); // places each item inside the Table of Contents div

		// Subunit Number
		const itemNum = document.createElement("span");
		itemNum.setAttribute("class", "toc-class_item_num");
		itemNum.innerHTML = heading.previousElementSibling.innerHTML;
		item.appendChild(itemNum);

		// Subunit Name
		const itemName = document.createElement("span");
		itemName.innerHTML = heading.innerHTML; // gives each item the text of the corresponding heading
		item.appendChild(itemName);
	});

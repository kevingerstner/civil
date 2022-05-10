const collapses = document.querySelectorAll(".collapse");
for (var i = 0; i < collapses.length; i++) {
	const shrink = collapses[i].querySelector(".collapse_shrink");
	const expand = collapses[i].querySelector(".collapse_expand");
	const collapse_header = collapses[i].querySelector(".collapse_header");
	const content = collapses[i].querySelector(".collapse_content");

	shrink.content = content;
	shrink.expand = expand;

	expand.content = content;
	expand.shrink = shrink;

	collapse_header.shrink = shrink;
	collapse_header.expand = expand;
	collapse_header.content = content;

	collapse_header.addEventListener("click", toggleCollapse, false);

	//keep first item expanded
	if (i === 0) {
		shrink.style.display = "block";
		expand.style.display = "none";
	} else {
		shrink.style.display = "none";
		expand.style.display = "block";
		content.style.display = "none";
	}
}

function toggleCollapse(event) {
	let collapse_header = event.currentTarget;
	let content = collapse_header.content;
	if (content.style.display === "none") {
		content.style.display = "block";
		collapse_header.shrink.style.display = "block";
		collapse_header.expand.style.display = "none";
	} else {
		content.style.display = "none";
		collapse_header.shrink.style.display = "none";
		collapse_header.expand.style.display = "block";
	}
}

document.querySelectorAll(".collapse_shrink").forEach((shrink) => {
	shrink.style.display = "none";
});
document.querySelectorAll(".collapse").forEach((collapse) => {
	const header = collapse.querySelector(".collapse_header");
	const content = collapse.querySelector(".collapse_content");
	header.content = content;
	content.style.display = "none";
	header.addEventListener("click", (event) => {
		let collapse_header = event.currentTarget;
		const shrink = collapse_header.querySelector(".collapse_shrink");
		const expand = collapse_header.querySelector(".collapse_expand");

		if (collapse_header.content.style.display === "none") {
			collapse_header.content.style.display = "block";
			shrink.style.display = "block";
			expand.style.display = "none";
		} else {
			collapse_header.content.style.display = "none";
			shrink.style.display = "none";
			expand.style.display = "block";
		}
	});
});

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

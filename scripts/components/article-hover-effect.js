/* START Article */
document.querySelectorAll(".article").forEach((article) => {
	const hover = article.querySelector(".article_hover");
	hover.style.display = "block";
	if (hover) {
		article.addEventListener("mouseover", (event) => {
			hover.style.backgroundColor = "rgba(236,236,236,0.2)";
		});
		article.addEventListener("mouseout", (event) => {
			hover.style.backgroundColor = "rgba(0,0,0,0)";
		});
	}
});
/* END Article */

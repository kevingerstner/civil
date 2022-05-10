/* START Date */
var options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
const date = new Date().toLocaleDateString("en-US", options);
document.querySelectorAll(".date").forEach((dateElement) => {
	dateElement.innerHTML = date;
});
/* END Date */

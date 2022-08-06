// Article Paywall
const ARTICLE_SIGNUP_BTN_EL = "#article-signup-btn";
const PAYWALL_EL = document.querySelector(".paywall");
PAYWALL_EL.style.display = "none";

let articleCookie = localStorage.getItem("articles-viewed");
articleCookie = articleCookie ? articleCookie.split(",") : [];

const MAX_ARTICLES = 3;
const articlesLeftEl = document.getElementById("articles-left");

$(document).ready(function () {
	if (localStorage.getItem("uid") === null) {
		// SET THE LINK OF THE PAYWALL BTN
		let articleSignupBtnLink = new URL(window.location.origin + "/signup");
		articleSignupBtnLink.searchParams.set("continueURL", window.location.pathname);
		document.querySelector(ARTICLE_SIGNUP_BTN_EL).href = articleSignupBtnLink;
		// HANDLE THE PAYWALL
		if (articleCookie) {
			console.log("user has viewed " + articleCookie.length + " articles.");
			if (articleCookie.length >= 3 && !articleCookie.includes(window.location.href)) {
				console.log("YEr gettun KICKED oUT Bub!");
				PAYWALL_EL.style.display = "block";
				document.body.style.overflow = "hidden";
			}
			// HANDLE UI
			if (articlesLeftEl) {
				let articlesLeft = MAX_ARTICLES - articleCookie.length;
				articlesLeftEl.innerHTML = `You have <span style="font-weight: bold">${articlesLeft}</span> member-only ${
					articlesLeft == 1 ? "story" : "stories"
				} left.`;
			}
		}
	} else {
		document.getElementById("paywall-notice").style.display = "none";
		PAYWALL_EL.style.display = "none";
		document.getElementsByTagName("body").style.overflow = "auto";
	}
});
$(window).scroll(function () {
	if ($(window).scrollTop() + $(window).height() > $("#main-content").height() - 400) {
		if (!articleCookie.includes(window.location.href)) articleCookie.push(window.location.href);
		localStorage.setItem("articles-viewed", articleCookie.toString());
	}
});

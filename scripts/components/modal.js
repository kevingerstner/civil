import {
	getAuth,
	onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/9.1.1/firebase-auth.js";

const modal = document.querySelector("#role-modal");

const auth = getAuth();
onAuthStateChanged(auth, async (user) => {
	if (user) {
		user.getIdTokenResult().then((idTokenResult) => {
			const teacher = !!idTokenResult.claims.teacher ? true : false;
			const student = !!idTokenResult.claims.student ? true : false;
			if (!teacher && !student) show(modal);
		});
	} else {
		show(unregisteredUI);
		hide(registeredUI);
	}
});

import {
	getAuth,
	updatePassword,
	reauthenticateWithCredential,
	EmailAuthProvider,
	onAuthStateChanged,
	updateEmail,
} from "https://www.gstatic.com/firebasejs/9.1.1/firebase-auth.js";

const FormMessageType = {
	Success: "Success",
	Notify: "Notify",
	Error: "Error",
};

document.querySelectorAll(".w-form").forEach((element) => {
	element.classList.remove("w-form");
});

// PASSWORD & SECURITY TAB
const SECURITY_FORM = document.querySelector("#security-form");
const EMAIL_FIELD = SECURITY_FORM.elements["email"];
const NEW_PASSWORD_FIELD = SECURITY_FORM.elements["new-password"];
const CONFIRM_PASSWORD_FIELD = SECURITY_FORM.elements["confirm-password"];
const SECURITY_SUBMIT = SECURITY_FORM.querySelector('input[type="submit"]');
const EMAIL_MESSAGE = document.querySelector("#email-message");
const PASSWORD_MESSAGE = document.querySelector("#password-validation-message");
const CONFIRM_PASS_MESSAGE = document.querySelector("#change-password-message");

EMAIL_FIELD.setAttribute("readonly", ""); // prevent email from being edited

SECURITY_FORM.addEventListener("submit", updateSecurity);
NEW_PASSWORD_FIELD.addEventListener("keyup", checkIfConfirmPasswordMatches);
NEW_PASSWORD_FIELD.addEventListener("blur", validatePasswordOnBlur);
CONFIRM_PASSWORD_FIELD.addEventListener("keyup", checkIfConfirmPasswordMatches);
SECURITY_FORM.addEventListener("change", detectChanges);

// PROFILE FORM
const PROFILE_FORM = document.querySelector("#profile-form");
const FIRST_NAME_FIELD = PROFILE_FORM.elements["firstName"];
const LAST_NAME_FIELD = PROFILE_FORM.elements["lastName"];
const GRADE_FIELD = PROFILE_FORM.elements["grade"];
const GRAD_YEAR_FIELD = PROFILE_FORM.elements["graduate-year"];
const PROFILE_SUBMIT = PROFILE_FORM.querySelector('input[type="submit"]');
const profileMessage = document.querySelector("#profile-message");

PROFILE_FORM.addEventListener("submit", updateUserProfile);
PROFILE_FORM.addEventListener("change", detectChanges);

// REAUTHENTICATE FORM
const REAUTH_FORM = document.querySelector("#reauthenticate-form");
const REAUTH_MODAL = document.querySelector("#reauth-modal");
const REAUTH_MESSAGE = document.querySelector("#reauthenticate-message");

REAUTH_FORM.addEventListener("submit", reauthenticateUser);

/* +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * Initialization
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+ */

const auth = getAuth();
let token;

let userData = localStorage.getItem("userData");
if (userData) {
	userData = JSON.parse(userData);
	setUserProfile();
}

onAuthStateChanged(auth, async (user) => {
	if (user) {
		EMAIL_FIELD.value = user.email;
		token = await user.getIdToken();
		if (!userData) {
			await refreshUserData();
			setUserProfile();
		}
	}
});

async function refreshUserData() {
	await sendRequest("get", `/user/profile/${auth.currentUser.uid}`, null, null)
		.then((res) => {
			localStorage.setItem("userData", JSON.stringify(res.data));
			userData = res.data;
		})
		.catch((err) => {
			console.error(err);
		});
}

/* +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * Edit Profile Tab
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+ */

function setUserProfile() {
	if (!userData) return console.error("Profile not set.");

	document.querySelector(".profile_name").innerText = userData.firstName + " " + userData.lastName;
	FIRST_NAME_FIELD.value = userData.firstName;
	LAST_NAME_FIELD.value = userData.lastName;
	GRADE_FIELD.value = userData.grade;
	GRAD_YEAR_FIELD.value = userData.graduateYear;
}

async function updateUserProfile(event) {
	event.preventDefault();
	event.stopPropagation();

	loadingSubmit(PROFILE_SUBMIT);
	hideMessage(profileMessage);

	sendRequest(`/user/profile/${auth.currentUser.uid}`, "post", {
		firstName: FIRST_NAME_FIELD.value,
		lastName: LAST_NAME_FIELD.value,
		grade: GRADE_FIELD.value,
		graduateYear: GRAD_YEAR_FIELD.value,
	})
		.then(async () => {
			showMessage(profileMessage, FormMessageType.Success, "Profile updated!");
			disableSubmit(PROFILE_SUBMIT);
			await refreshUserData();
		})
		.catch((err) => {
			showMessage(profileMessage, FormMessageType.Error, getErrorMessage(err.code));
			enableSubmit(PROFILE_SUBMIT);
		});
}

async function detectChanges(event) {
	const form = event.currentTarget;
	let changed = false;

	Array.from(form.elements).forEach((input) => {
		if (input.type !== "submit") {
			if (userData[input.name]) {
				if (input.value !== userData[input.name]) {
					changed = true;
				}
			} else {
				if (input.value !== "") changed = true;
			}
		}
	});
	changed ? enableSubmit(PROFILE_SUBMIT) : disableSubmit(PROFILE_SUBMIT);
}

/* +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * Password & Security Tab
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+ */

let formToSubmit;

/**
 * Change Password, Change Email
 * Attempts to change the currently authenticated user's password to a new password.
 * @param {event} event
 */
export async function updateSecurity(event) {
	event.preventDefault();
	event.stopPropagation();

	loadingSubmit(SECURITY_SUBMIT);

	if (auth.currentUser) {
		// UPDATE PASSWORD
		if (NEW_PASSWORD_FIELD.value) {
			updatePassword(auth.currentUser, NEW_PASSWORD_FIELD.value)
				.then(() => {
					showMessage(PASSWORD_MESSAGE, FormMessageType.Success, "Password updated successfully.");
					NEW_PASSWORD_FIELD.value = "";
					CONFIRM_PASSWORD_FIELD.value = "";
					disableSubmit(SECURITY_SUBMIT);
				})
				.catch((err) => {
					console.error(err);
				});
		}
	}
}

/**
 * Check if Confirm Password Matches
 * Checks if the newPassword field matches the confirmNewPassword
 * and handles UI to show the state.
 */
function checkIfConfirmPasswordMatches() {
	// Form Elements
	let newPass = NEW_PASSWORD_FIELD.value;
	let confirmPass = CONFIRM_PASSWORD_FIELD.value;

	// if both password fields are filled and match, remove errors and enable btn
	if (newPass === confirmPass && confirmPass !== "" && newPass !== "") {
		hideMessage(CONFIRM_PASS_MESSAGE);
		enableSubmit(SECURITY_SUBMIT);
	}
	// if only one field is empty, hide error and disable btn
	else if ((confirmPass !== "" && newPass === "") || (confirmPass === "" && newPass !== "")) {
		hideMessage(CONFIRM_PASS_MESSAGE);
		disableSubmit(SECURITY_SUBMIT);
	}
	// If both fields are empty, hide messages and enable submit
	else if (confirmPass === "" && newPass === "") {
		hideMessage(CONFIRM_PASS_MESSAGE);
		enableSubmit(SECURITY_SUBMIT);
	}
	// if both fields are filled but passwords don't match
	else {
		showMessage(
			CONFIRM_PASS_MESSAGE,
			FormMessageType.Error,
			"Confirm password must match new password."
		);
		disableSubmit(SECURITY_SUBMIT);
	}
}

function validatePasswordOnBlur() {
	if (NEW_PASSWORD_FIELD.value.length > 0 && NEW_PASSWORD_FIELD.value.length < 6) {
		showMessage(
			PASSWORD_MESSAGE,
			FormMessageType.Error,
			"Passwords must be at least 6 characters."
		);
	} else {
		hideMessage(PASSWORD_MESSAGE);
	}
}

/* +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * Reauthenticate Modal
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+ */

async function reauthenticateUser(event) {
	event.preventDefault();
	event.stopPropagation();

	hideMessage(REAUTH_MESSAGE);

	const credential = EmailAuthProvider.credential(
		auth.currentUser.email,
		REAUTH_FORM.elements["password"].value
	);

	await reauthenticateWithCredential(auth.currentUser, credential)
		.then(() => {
			hide(REAUTH_MODAL);
			formToSubmit.dispatchEvent(new Event("submit"));
		})
		.catch((err) => {
			showMessage(REAUTH_MESSAGE, FormMessageType.Error, getErrorMessage(err.code));
		});
}

/* +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * Remember Tab
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+ */
// Remembers which account tab the app was on last and opens it

function activateTab(tab) {
	document.querySelectorAll(".w--current").forEach((tab) => {
		tab.classList.remove("w--current");
	});
	tab.classList.add("w--current");
}

var index = parseInt(localStorage.getItem("tab" || "0"));
activateTab(document.querySelectorAll(".w-tab-link").item(index));

document.querySelectorAll(".w-tab-link").forEach((tab, index) => {
	tab.addEventListener("click", (event) => {
		localStorage.setItem("tab", index);
		activateTab(event.currentTarget);
	});
});

/* +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * Helper Functions
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+ */

/**
 * Returns a verbal description of the given error code
 * @param {string} errorCode
 * @returns {string} Description of the error code
 */
function getErrorMessage(errorCode) {
	switch (errorCode) {
		case "auth/wrong-password":
			return "Password is incorrect. Please try again.";
		case "auth/weak-password":
			return "New password must be at least 6 characters.";
		default:
			return "An error occurred. Please try again.";
	}
}

function showMessage(element, messageType, message) {
	element.classList.remove("success", "error");
	switch (messageType) {
		case FormMessageType.Error:
			element.classList.add("error");
			break;
		case FormMessageType.Success:
			element.classList.add("success");
			break;
	}
	element.innerHTML = message;
	show(element);
}

function hideMessage(element) {
	hide(element);
	element.innerHTML = "";
}

function enableSubmit(btnElement) {
	btnElement.value = "Save Changes";
	btnElement.disabled = false;
	btnElement.classList.remove("btn-disabled");
}

function disableSubmit(btnElement) {
	btnElement.value = "Saved";
	btnElement.disabled = true;
	btnElement.classList.add("btn-disabled");
}

function loadingSubmit(btnElement) {
	btnElement.value = "Saving...";
	btnElement.disabled = true;
	btnElement.classList.add("btn-disabled");
}

async function sendRequest(endpoint, method, data, params) {
	await axios({
		method,
		url: API_URL + endpoint,
		headers: {
			Authorization: `Bearer ${token}`,
		},
		data,
		params,
	})
		.then((res) => {
			return res;
		})
		.catch((err) => {
			console.error(err);
		});
}

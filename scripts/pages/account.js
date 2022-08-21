import {
	getAuth,
	updateProfile,
	updatePassword,
	reauthenticateWithCredential,
	sendEmailVerification,
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
const securityForm = document.querySelector("#security-form");
securityForm.addEventListener("submit", updateSecurity);

const NEW_PASSWORD_FIELD = securityForm.elements["new-password"];
const CONFIRM_PASSWORD_FIELD = securityForm.elements["confirm-password"];
const EMAIL_FIELD = securityForm.elements["email"];

const submitBtn = securityForm.querySelector('input[type="submit"]');

const emailValidationMessage = document.querySelector("#email-message");
const passwordValidationMessage = document.querySelector("#password-validation-message");
const confirmPassMessage = document.querySelector("#change-password-message");

NEW_PASSWORD_FIELD.addEventListener("keyup", checkIfConfirmPasswordMatches);
NEW_PASSWORD_FIELD.addEventListener("blur", validatePasswordOnBlur);
CONFIRM_PASSWORD_FIELD.addEventListener("keyup", checkIfConfirmPasswordMatches);
EMAIL_FIELD.addEventListener("keyup", validateEmailField);

// REAUTHENTICATE FORM
const reauthenticateForm = document.querySelector("#reauthenticate-form");
reauthenticateForm.addEventListener("submit", reauthenticateUser);
const reauthModal = document.querySelector("#reauth-modal");
const reauthenticateMessage = document.querySelector("#reauthenticate-message");

// PROFILE FORM
const profileForm = document.getElementById("profile-form");
profileForm.addEventListener("submit", updateUserProfile);
const submitButton = document.getElementById("submit-btn");
const successMessage = document.getElementById("success");

const FIRST_NAME_FIELD = profileForm.elements["first-name"];
const LAST_NAME_FIELD = profileForm.elements["last-name"];
const JOB_TITLE_FIELD = profileForm.elements["job-title"];
const SCHOOL_NAME_FIELD = profileForm.elements["school-name"];
const LOCATION_FIELD = profileForm.elements["location"];

// UI
hide(confirmPassMessage);
hide(passwordValidationMessage);
hide(emailValidationMessage);
disableSubmit(submitBtn);
successMessage.style.display = "none";

const auth = getAuth();

const userData = JSON.parse(localStorage.getItem("userData"));
window.onload = () => {
	setUserProfile(userData);
	setEmail(userData);
};

onAuthStateChanged(auth, async (user) => {
	if (user) {
		if (!userData) {
			userData = await refreshUserData();
			setUserProfile(userData);
			setEmail(userData);
		}
	}
});

async function refreshUserData() {
	const token = await auth.currentUser.getIdToken();
	sendRequest(event, `/user/profile/${auth.currentUser.uid}`, "get").then((res) => {
		localStorage.setItem("userData", JSON.stringify(res.data));
		userData = res.data;
	});
	return userData;
}

async function revokeUserData() {
	localStorage.removeItem("userData");
}

function setUserProfile(userData) {
	document.querySelector(".profile_name").innerText = userData.firstName + " " + userData.lastName;
	FIRST_NAME_FIELD.value = userData.firstName;
	LAST_NAME_FIELD.value = userData.lastName;
	JOB_TITLE_FIELD.value = userData.jobTitle;
	SCHOOL_NAME_FIELD.value = userData.schoolName;
	LOCATION_FIELD.value = userData.location;
}

async function updateUserProfile(event) {
	event.preventDefault();
	event.stopPropagation();

	// UI
	submitButton.classList.add("disabled");
	submitButton.innerHTML = "Submitting...";
	successMessage.style.display = "none";

	sendRequest(event, `/user/profile/${auth.currentUser.uid}`, "post", {
		firstName: FIRST_NAME_FIELD.value,
		lastName: LAST_NAME_FIELD.value,
		jobTitle: JOB_TITLE_FIELD.value,
		schoolName: SCHOOL_NAME_FIELD.value,
		location: LOCATION_FIELD.value,
	}).then(() => {
		successMessage.style.display = "block";
	});

	// UI
	submitButton.classList.remove("disabled");
	submitButton.innerHTML = "Save Changes";
}

/* _)-_)-_)-_)-_)-_)-_)-_)-_)-_)-_)-_)-_)-_)-
 * SETTINGS
 * _)-_)-_)-_)-_)-_)-_)-_)-_)-_)-_)-_)-_)-_)-*/

function setEmail(userData) {
	console.log("SETTING EMAIL FROM AUTH CURRENT USER");
	EMAIL_FIELD.value = auth.currentUser.email;
}

let formToSubmit = securityForm;

/**
 * Change Password
 * Attempts to change the currently authenticated user's password to a new password.
 * @param {event} event
 */
export async function updateSecurity(event) {
	event.preventDefault();
	event.stopPropagation();

	let updated = false;

	// UI
	loadingSubmit(submitBtn);

	if (auth.currentUser) {
		// Get Form values
		const newPassword = NEW_PASSWORD_FIELD.value;
		const email = EMAIL_FIELD.value;

		if (newPassword) {
			updatePassword(auth.currentUser, newPassword)
				.then(() => {
					// Updated Password
					console.log("UPDATED PASSWORD");
					updated = true;
					showMessage(
						passwordValidationMessage,
						FormMessageType.Success,
						"Password updated successfully."
					);
					NEW_PASSWORD_FIELD.value = "";
					CONFIRM_PASSWORD_FIELD.value = "";
				})
				.catch((err) => {
					console.error(err.code);
					if (err.code === "auth/requires-recent-login") {
						formToSubmit = securityForm;
						show(reauthModal);
						enableSubmit(submitBtn);
					}
				});
		}

		const currentEmail = auth.currentUser.email;
		console.log("EMAIL: " + email);
		console.log("CURRENT EMAIL: " + currentEmail);

		if (email && email !== currentEmail) {
			updateEmail(auth.currentUser, email)
				.then(() => {
					console.log("UPDATED EMAIL");
					showMessage(
						emailValidationMessage,
						FormMessageType.Success,
						"Email updated successfully."
					);
					updated = true;
				})
				.catch((err) => {
					console.error(err);
					if (err.code === "auth/requires-recent-login") {
						formToSubmit = securityForm;
						show(reauthModal);
						enableSubmit(submitBtn);
					}
				});
		}
	}
	if (updated) {
		revokeUserData();
		disableSubmit(submitBtn);
	} else enableSubmit(submitBtn);
	return false;
}

function validateEmailField() {
	enableSubmit(submitBtn);
	const email = EMAIL_FIELD.value;
	if (!email) {
		emailValidationMessage.innerHTML = "This field is required!";
		show(emailValidationMessage);
	} else {
		emailValidationMessage.innerHTML = "";
		hide(emailValidationMessage);
	}
}

/**
 * Function that checks if the newPassword field matches the confirmNewPassword
 * and handles UI to show the state.
 */
function checkIfConfirmPasswordMatches() {
	// Form Elements
	let newPass = NEW_PASSWORD_FIELD.value;
	let confirmPass = CONFIRM_PASSWORD_FIELD.value;

	// if both password fields are filled and match, remove errors and enable btn
	if (newPass === confirmPass && confirmPass !== "" && newPass !== "") {
		hideMessage(confirmPassMessage);
		enableSubmit(submitBtn);
	}
	// if only one field is empty, hide error and disable btn
	else if ((confirmPass !== "" && newPass === "") || (confirmPass === "" && newPass !== "")) {
		hideMessage(confirmPassMessage);
		disableSubmit(submitBtn);
	}
	// If both fields are empty, hide messages and enable submit
	else if (confirmPass === "" && newPass === "") {
		hideMessage(confirmPassMessage);
		enableSubmit(submitBtn);
	}
	// if both fields are filled but passwords don't match
	else {
		showMessage(
			confirmPassMessage,
			FormMessageType.Error,
			"Confirm password must match new password."
		);
		disableSubmit(submitBtn);
	}
}

function validatePasswordOnBlur() {
	if (NEW_PASSWORD_FIELD.value.length > 0 && NEW_PASSWORD_FIELD.value.length < 6) {
		show(passwordValidationMessage);
	} else {
		hide(passwordValidationMessage);
	}
}

async function reauthenticateUser(event) {
	event.preventDefault();
	event.stopPropagation();

	console.log("Reauthenticating...");

	reauthenticateMessage.innerHTML = "";
	hide(reauthenticateMessage);

	const credential = EmailAuthProvider.credential(
		auth.currentUser.email,
		reauthenticateForm.elements["password"].value
	);

	await reauthenticateWithCredential(auth.currentUser, credential)
		.then(() => {
			hide(reauthModal);
			formToSubmit.dispatchEvent(new Event("submit"));
		})
		.catch((err) => {
			console.log(err);
			reauthenticateMessage.innerHTML = getErrorMessage(err.code);
			show(reauthenticateMessage);
		});
}

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
	element.innerHTML = "Password updated successfully.";
	show(passwordValidationMessage);
}

function hideMessage(element) {
	hide(element);
	element.innerHTML = "";
}

function enableSubmit(btnElement) {
	btnElement.value = "Save Changes";
	btnElement.disabled = false;
	btnElement.classList.remove("disabled");
}

function disableSubmit(btnElement) {
	btnElement.value = "Saved";
	btnElement.disabled = true;
	btnElement.classList.add("disabled");
}

function loadingSubmit(btnElement) {
	btnElement.value = "Saving...";
	btnElement.disabled = true;
	btnElement.classList.add("disabled");
}

async function sendRequest(event, endpoint, method, data, params) {
	event.preventDefault();
	event.stopPropagation();

	let token = auth.currentuser && (await auth.currentUser.getIdToken(true));
	axios({
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

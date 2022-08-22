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

const SECURITY_SUBMIT = securityForm.querySelector('input[type="submit"]');

const emailValidationMessage = document.querySelector("#email-message");
const passwordMessage = document.querySelector("#password-validation-message");
const confirmPassMessage = document.querySelector("#change-password-message");

NEW_PASSWORD_FIELD.addEventListener("keyup", checkIfConfirmPasswordMatches);
NEW_PASSWORD_FIELD.addEventListener("blur", validatePasswordOnBlur);
CONFIRM_PASSWORD_FIELD.addEventListener("keyup", checkIfConfirmPasswordMatches);
EMAIL_FIELD.addEventListener("keyup", validateEmailField);
securityForm.addEventListener("change", detectChanges);

hideMessage(confirmPassMessage);
hideMessage(passwordMessage);
hideMessage(emailValidationMessage);
disableSubmit(SECURITY_SUBMIT);

// PROFILE FORM
const profileForm = document.getElementById("profile-form");
profileForm.addEventListener("submit", updateUserProfile);

const PROFILE_SUBMIT = profileForm.querySelector('input[type="submit"]');

const FIRST_NAME_FIELD = profileForm.elements["firstName"];
const LAST_NAME_FIELD = profileForm.elements["lastName"];
const JOB_TITLE_FIELD = profileForm.elements["jobTitle"];
const SCHOOL_NAME_FIELD = profileForm.elements["schoolName"];
const LOCATION_FIELD = profileForm.elements["location"];

const profileMessage = document.querySelector("#profile-message");

profileForm.addEventListener("change", detectChanges);

hideMessage(profileMessage);
disableSubmit(PROFILE_SUBMIT);

// REAUTHENTICATE FORM
const reauthenticateForm = document.querySelector("#reauthenticate-form");
reauthenticateForm.addEventListener("submit", reauthenticateUser);
const reauthModal = document.querySelector("#reauth-modal");
const reauthenticateMessage = document.querySelector("#reauthenticate-message");

hideMessage(reauthenticateMessage);

/* +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * Initialization
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+ */

const auth = getAuth();
let token;

let userData = localStorage.getItem("userData");
if (userData) {
	console.log("user data is already set");
	userData = JSON.parse(userData);
	setUserProfile();
	setEmail();
}

onAuthStateChanged(auth, async (user) => {
	console.log("AUTH STATE CHANGED");
	if (user) {
		token = await user.getIdToken();
		if (!userData) {
			await refreshUserData();
			setUserProfile();
			setEmail();
		}
	}
});

async function refreshUserData() {
	console.log("REFRESHING USER DATA");
	await axios({
		method: "get",
		url: API_URL + `/user/profile/${auth.currentUser.uid}`,
		headers: {
			Authorization: `Bearer ${token}`,
		},
	})
		.then((res) => {
			console.log("USER DATA: " + res);
			localStorage.setItem("userData", JSON.stringify(res.data));
			userData = res.data;
		})
		.catch((err) => {
			console.error(err);
		});
}

async function revokeUserData() {
	localStorage.removeItem("userData");
}

/* +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * Edit Profile Tab
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+ */

function setUserProfile() {
	if (!userData) return console.log("Profile not set.");

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

	loadingSubmit(PROFILE_SUBMIT);
	hideMessage(profileMessage);

	sendRequest(`/user/profile/${auth.currentUser.uid}`, "post", {
		firstName: FIRST_NAME_FIELD.value,
		lastName: LAST_NAME_FIELD.value,
		jobTitle: JOB_TITLE_FIELD.value,
		schoolName: SCHOOL_NAME_FIELD.value,
		location: LOCATION_FIELD.value,
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

	if (changed) {
		enableSubmit(PROFILE_SUBMIT);
	} else {
		disableSubmit(PROFILE_SUBMIT);
	}
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
	console.log("UPDATING SECURITY");
	event.preventDefault();
	event.stopPropagation();

	loadingSubmit(SECURITY_SUBMIT);

	if (auth.currentUser) {
		const newPassword = NEW_PASSWORD_FIELD.value;
		const email = EMAIL_FIELD.value;

		// UPDATE PASSWORD
		try {
		} catch (err) {
			console.error(err);
			showMessage(passwordMessage, FormMessageType.Error, err);
			if (err.code === "auth/requires-recent-login") {
				formToSubmit = securityForm;
				show(reauthModal);
				enableSubmit(SECURITY_SUBMIT);
			}
		}
		if (newPassword) {
			updatePassword(auth.currentUser, newPassword)
				.then(() => {
					showMessage(passwordMessage, FormMessageType.Success, "Password updated successfully.");
					NEW_PASSWORD_FIELD.value = "";
					CONFIRM_PASSWORD_FIELD.value = "";
					disableSubmit(SECURITY_SUBMIT);
				})
				.catch((err) => {});
		}

		if (email && email !== auth.currentUser.email) {
			console.log("UPDATING EMAIL");
			updateEmail(auth.currentUser, email)
				.then(async () => {
					showMessage(
						emailValidationMessage,
						FormMessageType.Success,
						"Email updated successfully."
					);
					disableSubmit(SECURITY_SUBMIT);
					await sendRequest(`/user/profile/${auth.currentUser.uid}`, "post", { email });
					await refreshUserData();
				})
				.catch((err) => {
					console.error(err);
					if (err.code === "auth/requires-recent-login") {
						formToSubmit = securityForm;
						show(reauthModal);
						enableSubmit(SECURITY_SUBMIT);
					}
				});
		}
	}
}

/**
 * Validate Email Field
 * Makes sure the email field is filled
 */
function validateEmailField() {
	if (!EMAIL_FIELD.value) {
		showMessage(emailValidationMessage, FormMessageType.Error, "This field is required!");
		disableSubmit(SECURITY_SUBMIT);
	} else {
		hideMessage(emailValidationMessage);
		enableSubmit(SECURITY_SUBMIT);
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
		hideMessage(confirmPassMessage);
		enableSubmit(SECURITY_SUBMIT);
	}
	// if only one field is empty, hide error and disable btn
	else if ((confirmPass !== "" && newPass === "") || (confirmPass === "" && newPass !== "")) {
		hideMessage(confirmPassMessage);
		disableSubmit(SECURITY_SUBMIT);
	}
	// If both fields are empty, hide messages and enable submit
	else if (confirmPass === "" && newPass === "") {
		hideMessage(confirmPassMessage);
		enableSubmit(SECURITY_SUBMIT);
	}
	// if both fields are filled but passwords don't match
	else {
		showMessage(
			confirmPassMessage,
			FormMessageType.Error,
			"Confirm password must match new password."
		);
		disableSubmit(SECURITY_SUBMIT);
	}
}

function validatePasswordOnBlur() {
	if (NEW_PASSWORD_FIELD.value.length > 0 && NEW_PASSWORD_FIELD.value.length < 6) {
		showMessage(passwordMessage, FormMessageType.Error, "Passwords must be at least 6 characters.");
	} else {
		hideMessage(passwordMessage);
	}
}

function setEmail() {
	EMAIL_FIELD.value = userData.email;
}

/* +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * Reauthenticate Modal
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+ */

async function reauthenticateUser(event) {
	event.preventDefault();
	event.stopPropagation();

	hideMessage(reauthenticateMessage);

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
			showMessage(reauthenticateMessage, FormMessageType.Error, getErrorMessage(err.code));
		});
}

/* +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * Remember Tab
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+ */

function activateTab(tab) {
	document.querySelectorAll(".w--current").forEach((tab) => {
		tab.classList.remove("w--current");
	});
	//switch this tab on
	tab.classList.add("w--current");
}

var index = parseInt(localStorage.getItem("tab" || "0"));
activateTab(document.querySelectorAll(".w-tab-link").item(index));

document.querySelectorAll(".w-tab-link").forEach((tab, index) => {
	tab.addEventListener("click", (event) => {
		localStorage.setItem("tab", index);
		activate(event.currentTarget);
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

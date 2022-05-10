import {
	getAuth,
	createUserWithEmailAndPassword,
	updateProfile,
} from "https://www.gstatic.com/firebasejs/9.1.1/firebase-auth.js";
import {
	getFirestore,
	setDoc,
	doc,
} from "https://www.gstatic.com/firebasejs/9.1.1/firebase-firestore.js";

const db = getFirestore();
const auth = getAuth();

// The URL of the login page
let loginUrl = window.location.origin + "/login";

// Initialize Signup Form Submit Listener
let signupForm = document.getElementById("signup-form");
signupForm.addEventListener("submit", submitSignupRequest, true);

let signupButton = document.getElementById("signup-btn");
signupButton.classList.remove("btn-disabled");

// Initialize Error Message
let errorMessageElement = document.getElementById("signup-error-message");
errorMessageElement.style.display = "none";

// Try to autofill the email
const params = new URLSearchParams(window.location.search);
const transferEmail = params.get("email");
if (typeof transferEmail !== "undefined") {
	signupForm["email"].value = transferEmail;
}

/**
 * Submit a Signup Request. This is a multi-step process:
 * 1. Attempts to create an account in Firebase
 * 2. If successful, an account + profile is created
 * 3. A notification is posted to the Slack channel
 * 4. A verification email is sent to the submitted email
 * 5. The user is redirected to an email verification screen
 */
async function submitSignupRequest(event) {
	event.preventDefault();
	event.stopPropagation();

	// Disable button and show spinner
	signupButton.classList.add("btn-disabled");

	// Clear errors
	errorMessageElement.style.display = "none";
	errorMessageElement.innerHTML = "";

	// Get Form Elements
	const formData = {
		firstName: signupForm["first-name"].value,
		lastName: signupForm["last-name"].value,
		email: signupForm["email"].value,
		jobTitle: signupForm["jobTitle"].value,
		schoolName: signupForm["schoolName"].value,
		location: signupForm["schoolLocation"].value,
		referral: signupForm["referral"].value,
		newsletter: signupForm["newsletter"].checked,
	};

	createUserWithEmailAndPassword(
		auth,
		formData.email,
		signupForm["password"].value
	)
		.then(async (userCredential) => {
			const user = userCredential.user;

			await setDoc(doc(db, "users", user.uid), formData);

			await updateProfile(user, {
				displayName: `${formData.firstName} ${formData.lastName}`,
			}).catch((err) => {
				console.log(`Error Updating this users' profile: ${err}`);
			});

			window.location.href = window.location.origin + `/signup/verify-email`;
		})
		.catch((error) => {
			let errorMessage = "";
			switch (error.code) {
				case "auth/email-already-in-use":
					errorMessage = `${formData.email} is already associated with an account. <a href=${loginUrl}>Login?</a>`;
					break;
				default:
					errorMessage = `An error occurred creating an account for ${formData.email}: ${error.message}`;
			}
			errorMessageElement.style.display = "block";
			errorMessageElement.innerHTML = errorMessage;

			// Enable button and hide spinner
			signupButton.classList.remove("btn-disabled");
		});
}

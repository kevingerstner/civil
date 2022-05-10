// import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-functions.js";

// const functions = getFunctions();
// const mailchimpTest = httpsCallable(functions, 'mailchimptest');
// document.getElementById("mailchimpBtn").addEventListener("click", () => {
//    mailchimpTest();
// });
const mailchimp = require("@mailchimp/mailchimp_transactional")("9cce2f35ccc40f67a21d36e15cc428de-us18");

async function run() {
   const response = await mailchimp.users.ping();
   console.log(response);
}

run();

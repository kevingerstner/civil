const signupBtn = document.getElementById("signup-btn");

signupBtn.addEventListener("click", (event) => {
   event.preventDefault();
   event.stopPropagation();

   const email = document.getElementById("email").value;
   window.location.href = window.location.origin + `/signup/?email=${email}`;
});

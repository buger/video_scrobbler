// Called once when the dialog displays
function onLoad() {
  // Use the arguments passed to us by the caller
  document.getElementById("login").value = window.arguments[0].inn.login;
  document.getElementById("password").value = window.arguments[0].inn.password;
}

// Called once if and only if the user clicks OK
function onOK() {
   // Return the changed arguments.
   // Notice if user clicks cancel, window.arguments[0].out remains null
   // because this function is never called
   window.arguments[0].out = {login:document.getElementById("login").value,
        password:document.getElementById("password").value};
   return true;
}


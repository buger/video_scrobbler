
function openPreferences(){
  // Get the "extensions.myext." branch
  var prefs = Components.classes["@mozilla.org/preferences-service;1"]
		      .getService(Components.interfaces.nsIPrefService);
  prefs = prefs.getBranch("extensions.video_scrobbler.");

  var login = prefs.getCharPref("login")
  var password = prefs.getCharPref("password")

  var params = {inn:{login:login, password:password}, out:null};       

  window.openDialog("chrome://scrobbler/content/preferences.xul", "",
    "chrome, dialog, modal, resizable=false", params).focus();
  if (params.out) {
    prefs.setCharPref("login", params.out.login)
    prefs.setCharPref("password", params.out.password)

    scrobbler.handshake()

    // User clicked ok. Process changed arguments; e.g. write them to disk or whatever
  }
  else {
    // User clicked cancel. Typically, nothing is done here.
  }
}

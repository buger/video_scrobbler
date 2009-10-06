function update_panel(msg){
  document.getElementById('videoscrobbler_panel').label = msg
} 


function VideoPage(){
  this.window = undefined
  this.href = undefined
  this.player = undefined
  this.current_state = undefined
  this.last_state = undefined
  this.is_init = false
  this.scrobbled = false
  this.playing = false
  this.timer = undefined

  this.update_panel = function(msg){
    this.current_message = msg

    update_panel(msg)
  } 

}

function VideoScrobbler(){
    this.logged = false  
 
    this.log = function(msg){
      //if(this.unsafeWin.console)
      //  this.unsafeWin.console.log(msg)
    }
    
    this.initialize = function(){
      var prefs = Components.classes["@mozilla.org/preferences-service;1"]
			  .getService(Components.interfaces.nsIPrefService);      
      this.prefs = prefs.getBranch("extensions.video_scrobbler.");

      this.pages = {}
      
      this.handshake()
    }

    this.init_page = function(wnd){  
      var href = wnd.location.toString().split("#")[0]

      var video_page = this.pages[href]
      
      if (video_page == undefined){
	var video_page = new VideoPage()
	video_page.href = href

	video_page.player = wnd.document.getElementById('movie_player')
	video_page.duration = video_page.player.getDuration()
	video_page.videoid = wnd.document.location.toString().split("v=")[1].split("#")[0].split("&")[0]
	video_page.is_init = true
	video_page.window = wnd
	video_page.scrobbler = this
	
	this.pages[href] = video_page
	this.log("Videoid:"+video_page.videoid)
	
	this.guess_track(video_page)
      }

      return video_page
    }

    this.guess_track = function(video_page){
      video_page.update_panel("Trying to guess track")
      var track = video_page.window.document.title.replace('YouTube - ','')      

      var xhr = new XMLHttpRequest();
      xhr.open("GET",'http://musicvideobuger.appspot.com/api/video_info/youtube/'+video_page.videoid+'?track='+track+'&username='+this.username, true)
      
      var processResponse = function(responseDetails) {
	var s = new Components.utils.Sandbox("about:blank");
        response = Components.utils.evalInSandbox("(" + responseDetails.responseText + ")", s);
	
	if(response.error){
          video_page.update_panel("Error:"+response.error)
	}else{	  	  
          video_page.artist = response.artist
	  video_page.track = response.track
          
	  if(video_page.artist)
            video_page.update_panel(video_page.artist+" - "+video_page.track)
	  else
	    video_page.update_panel("Unknown track")
	  
	  if(video_page.artist) 
	    scrobbler.setNowPlaying(video_page)
        }
      }     

      xhr.onreadystatechange = function(){
	  if (xhr.readyState == 4){
	      processResponse(xhr);
	  }
      };
      
      xhr.send(null)            
    }


    this.handshake = function(){
      this.username = this.prefs.getCharPref("login")
      var password = this.prefs.getCharPref("password")

      var now = new Date()
      var timestamp = parseInt(now.getTime()/1000.0)
      
      var auth_token = MD5(MD5(password)+timestamp)
      
      var xhr = new XMLHttpRequest();
      xhr.open("GET",'http://post.audioscrobbler.com/?hs=true&p=1.2&c=tst&v=1.0&u='+this.username+'&t='+timestamp+'&a='+auth_token, true)
      
      var processResponse = function(responseDetails) {
	try{
	  if (responseDetails.statusText == 'OK') {
	    var res = responseDetails.responseText.split('\n');

	    if (res[0] == 'OK') {
	      scrobbler.sid = res[1]
	      scrobbler.now_playing_url = res[2]
	      scrobbler.submission_url  = res[3]
	      scrobbler.logged = true

	      update_panel("logged as:"+scrobbler.username)	 
	    } else if (res[0] == 'BADUSER') {
	      update_panel('Username was not found.');
	    } else {
	      update_panel('Wrong login/password');
	    }
	  } else {
	    update_panel('handshake error:'+responseDetails.responseText);
	  }
	} catch(e) {
	  update_panel('Failed to login')
	}
      }     

      xhr.onreadystatechange = function(){
	if (xhr.readyState == 4){
	  processResponse(xhr);
	}
      };
      
      xhr.send(null)            
    }

    this.setNowPlaying = function(video_page){

        if(!this.logged || !video_page.artist)
            return false        
        
        var xhr = new XMLHttpRequest();
        xhr.open("POST", scrobbler.now_playing_url, true)
        
        var post_data = 's='+this.sid+'&a='+video_page.artist+'&t='+video_page.track+'&b=&l='+video_page.duration+'&n=&m='

        xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        xhr.setRequestHeader("Content-length", post_data.length);
        xhr.setRequestHeader("Connection", "close");

        var processResponse = function(responseDetails) {
            if (responseDetails.statusText == 'OK') {
            }
            else {
               update_panel('now playing error:'+responseDetails.responseText);
            }
        }     

        xhr.onreadystatechange = function(){
            if (xhr.readyState == 4){
                processResponse(xhr);
            }
        };
        
        xhr.send(post_data)            
    }

    this.checkState = function(wnd){
      var player = wnd.document.getElementById('movie_player')	  

      if(player.getPlayerState){	
	var state = player.getPlayerState()

	if(this.state != state){
	  this.state = state

	  var video_page = this.pages[wnd.location.toString().split('#')[0]]
	  
	  if(video_page == undefined){
	      video_page = this.init_page(wnd)	    
	  }
	      
	  //TODO: Pause scrobbling on buffering, currently it resets
	  video_page.playing = false
	  if(this.timer)
	      clearTimeout(video_page.timer)
	  
	  switch(state){
	    case 0: //stoped
		this.log("Player stopped. Reseting scrobbling")
		video_page.scrobbled = false
		break
	    case 1: //playing
		this.log("Playing")
		
		video_page.playing = true
		
		video_page.timer = setTimeout(function(){		    
		    scrobbler.scrobble(video_page)
		}, (video_page.duration*0.7)*1000)

		break
	    case 2: //paused                
		video_page.scrobbled = false
		this.log("Paused")
		break               
	    case 3: //buffering
		this.log("Buffering")       
		break
	    default:
		this.log("Unknown state:"+state)
	  }
	}
      }	
     
      this.startTimer(wnd) 
    };

    this.startTimer = function(wnd){
      var ev = { notify: function(timer) { scrobbler.checkState(wnd) } }

      var timer = Components.classes["@mozilla.org/timer;1"]
		    .createInstance(Components.interfaces.nsITimer);
     
      timer.initWithCallback(
	ev,
	500,
	Components.interfaces.nsITimer.TYPE_ONE_SHOT);   
    }

    this.scrobble = function(video_page){
        this.log("Trying to scrobble")

        if(video_page.scrobbled || !video_page.artist || !this.logged)
            return false

        var xhr = new XMLHttpRequest();
        xhr.open("POST", this.submission_url, true)
        
        var now = new Date()
        var timestamp = parseInt(now.getTime()/1000.0)

        var post_data = 's='+this.sid+'&a[0]='+video_page.artist+'&t[0]='+video_page.track+'&i[0]='+timestamp+'&o[0]=P&l[0]='+video_page.duration+'&r[0]=&b[0]=&n[0]=&m[0]='

        xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        xhr.setRequestHeader("Content-length", post_data.length);
        xhr.setRequestHeader("Connection", "close");

        var processResponse = function(responseDetails) {
            if (responseDetails.statusText == 'OK') {
                scrobbler.scrobbled = true		  
            }
            else {
                update_panel("Error:"+responseDetails.responseText);
            }
        }     

        xhr.onreadystatechange = function(){
            if (xhr.readyState == 4){
                processResponse(xhr);
            }
        };
        
        xhr.send(post_data)      
    }
}

var scrobbler = new VideoScrobbler();
scrobbler.initialize();
 
    
var VideoScrobblerLoader = {
  onLoad: function(e) {
    var appcontent = window.document.getElementById("appcontent");
    if (appcontent && !appcontent.video_scrobbler_loaded) {
        appcontent.video_scrobbler_loaded=true;
        appcontent.addEventListener("DOMContentLoaded", VideoScrobblerLoader.contentLoad, false);
    }
  },

  onUnLoad: function(e){
    this.initialized = false
    window.removeEventListener('load', VideoScrobblerLoader.onLoad, false);
    window.removeEventListener('unload', VideoScrobblerLoader.onUnLoad, false);
    window.document.getElementById("appcontent")
        .removeEventListener("DOMContentLoaded", VideoScrobblerLoader.contentLoad, false);
  },

  //Currently supports only youtube.com 
  isScrolabble: function(wnd){
    if(wnd.location.toString().match('youtube.com/watch')){
      if(wnd.document.getElementById('watch-video-category').href.match('music')){
	return true
      }
    }    

    return false
  },

  contentLoad: function(e){
    var unsafeWin=e.target.defaultView;
    if (unsafeWin.wrappedJSObject) unsafeWin=unsafeWin.wrappedJSObject;
    
    if (VideoScrobblerLoader.isScrolabble(unsafeWin) && !unsafeWin.document.video_scrobbler_loaded){
      VideoScrobblerLoader.injectScript(unsafeWin)
    }
  },
  

  injectScript: function(unsafeWin){
    update_panel("")

    scrobbler.unsafeWin = unsafeWin

    scrobbler.pages[unsafeWin.location.toString().split('#')[0]] = undefined
    
    if(unsafeWin.document){
      scrobbler.startTimer(unsafeWin)
    }

    unsafeWin.document.video_scrobbler_loaded = true
  }	  
};

window.addEventListener("load", VideoScrobblerLoader.onLoad, false); 
window.addEventListener("unload", VideoScrobblerLoader.onUnLoad, false); 


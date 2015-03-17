// extend.js
// Written by Andrew Dupont, optimized by Addy Osmani
function extend(destination, source) {

	var toString = Object.prototype.toString,
		objTest = toString.call({});

	for (var property in source) {
		if (source[property] && objTest === toString.call(source[property])) {
			destination[property] = destination[property] || {};
			extend(destination[property], source[property]);
		} else {
			destination[property] = source[property];
		}
	}
	return destination;

}

/**
 * voxbone.js
 */
var voxbone = voxbone || {};


/**
 * Pinger Logic & Best POP Selection for WebRTC
 */
extend(voxbone, {
	Pinger: {
		/**
		 * Placeholder for ping result
		 */
		pingResults: [],

		/**
		 * Load an image and compute the time it took to load.
		 * Loading time is then stored into pingResult for further processing.
		 * Each pop will host a small http server to serve the image.
		 *
		 * If a ping fails, a value of -1 will be stored
		 *
		 * @param pop Name of the Pop to ping, mainly used as an identifier for storing ping result.
		 * @param url URL of the Pop to ping
		 */
		ping: function (pop, url) {
			var started = new Date().getTime();
			var _that = this;
			var callback = this.recordPingResult;

			this.img = new Image();
			_that.inUse = true;

			this.img.onload = function () {
				var elapsed = new Date().getTime() - started;
				callback(pop, elapsed);
				_that.inUse = false;
			};

			this.img.onerror = function (e) {
				_that.inUse = false;
				callback(pop, -1);
			};

			this.img.src = url + "?" + new Date().getTime();
			this.timer = setTimeout(function () {
				if (_that.inUse) {
					_that.inUse = false;
					callback(pop, -1);
				}
			}, 1500);
		},

		/**
		 * Record the ping result for a given pop and store it into a placeholder
		 * A duration of -1 will be used in the event a ping has timeout or URL doesn't resolve.
		 *
		 * @param pop Pop identifier
		 * @param duration ping duration
		 */
		recordPingResult: function (pop, duration) {
			//if(duration < 0 ) return;
            console.log("[ping] "+pop+" replied in "+duration);
			var entry = {
				name: pop,
				ping: duration
			};

			voxbone.Pinger.pingResults.push(entry);
		},

		/**
		 * Extract which Pop is best from all the pinged Pop.
		 * It iterate over all stored ping result and returns the best one excluding ping of -1.
		 *
		 * @returns Name of the Pop which has the best ping
		 */
		getBestPop: function () {
			var bestPop = undefined;
            //If no proper ping server found, default to BE
            if(this.pingResults.length == 0){
                bestPop =  {
                    name:'BE',
                    ping: -1
                };
            //Else find the fastest
            }else{
                for (var i = 0; i < this.pingResults.length; i++) {
                    var result = this.pingResults[i];
                    if ((result.ping > 0 ) && (bestPop == undefined || ( (result.ping < bestPop.ping) ))) {
                        bestPop = result;
                    }
                }
            }
			return bestPop;
		}
	}
});

/**
 *
 */
extend(voxbone, {

	WebRTC: {
		/**
		 * id of the <audio/> html tag.
		 * If an audio element with this id already exists in the page, the script will load it and attach audio stream to it.
		 * If not found, the script will create the audio component and attach the audio stream to it.
		 */
		audioComponentName: 'peer-audio',

        /**
         * id of the <video/> html tag.
         * If a video element with this id already exists in the page, the script will load it and attach video stream to it.
         * If not found, the script will create the video component and attach the stream to it.
         */
        videoComponentName: 'peer-video',

        /**
         * Indiciate if video should be used or not.
         * If video is set to true, then the user will be prompted for webcam access.
         *
         */
        allowVideo : false,

		/**
		 * URL of voxbone ephemeral auth server
		 */
		authServerURL: 'https://webrtc.voxbone.com/rest/authentication/createToken',

		/**
		 * Switch between WebSocket & Secure WebSocket
		 */
		useSecureSocket: true,

		/**
		 * The actual WebRTC session
		 */
		rtcSession: {},

		/**
		 * Used to bypass ping mechanism and enforce the POP to be used
		 * If set to 'undefined' ping will be triggered and best pop will be set as preferedPop
		 */
		preferedPop: undefined,

		/**
		 * Configuration object use to hold authentication data as well as the list of Web Socket Servers.
		 * This Configuration object is the native JsSip configuration object.
		 */
		configuration: {
			'authorization_user': undefined,
			'password': undefined,
			'ws_servers': undefined,
			'uri': 'voxrtc@voxbone.com',
			'trace_sip': true,
			'register': false
		},

		customEventHandler: {
			'progress': function (e) {
			},
			'started': function (e) {
			},
			'failed': function (e) {
			},
			'ended': function (e) {
			}
		},

		/**
		 * Actual JsSIP User-Agent
		 */
		phone: undefined,

		/**
		 * Context is a variable which will hold anything you want to be transparently carried to the call
		 */
		context: undefined,

		/**
		 * Authenticate toward voxbone ephemeral server and get jsonp callback onto voxbone.WebRTC.processAuthData
		 * in order to process authentication result data.
		 *
		 * @param credentials credentials to be used against ephemeral auth server
		 */
		init: function (credentials) {
			console.log('auth server: ' + this.authServerURL);
			$.ajax({
				type: "GET",
				url: this.authServerURL,
				headers: {
					Accept: "application/json"
				},
				contentType: "application/json; charset=utf-8",
				crossDomain: true,
				cache: false,
				data: {
					'username': credentials.username,
					'key': credentials.key,
					'expires': credentials.expires,
					'jsonp': 'voxbone.WebRTC.processAuthData'
				},
				jsonp: false,
				dataType: 'jsonp'
			});
		},

		/**
		 * Process the Authentication data from Voxbone ephemeral auth server.
		 * It retrieves the list of ping servers and invoke voxbone.Pinger.ping on each of them.
		 * It also store the URI of websocket server and authorization data.
		 *
		 * @param data the Data from voxbone ephemeral server to process
		 */
		processAuthData: function (data) {
			if (this.useSecureSocket) {
				this.configuration.ws_servers = data.wss;
			} else {
				this.configuration.ws_servers = data.ws;
			}

			this.configuration.authorization_user = data.username;
			this.configuration.password = data.password;
			//Initialize User-Agent early in the process
			this.phone = new JsSIP.UA(this.configuration);
			this.phone.start();
			//If no prefered Pop is defined, ping and determine which one to prefer
			if (this.preferedPop == undefined) {
				console.log("prefered pop undefined, pinging....");
				this.pingServers = data["pingServers"];
				$.each(this.pingServers, function (key, value) {
					voxbone.Pinger.ping(key, value);
				});
			} else {
				console.log("preferred pop already set to " + this.preferedPop);
			}
		},


		/**
		 * Check if the document contains an audio element with the provided id.
		 * If no audio element exists, it creates it. prior to bind audio stream to it.
		 *
		 * @param id id of the audio element
		 * @param audioStream audio stream from the WebSocket
		 * @returns {HTMLElement}
		 */
		initAudioElement: function (id, audioStream) {
			var audio = document.getElementById(id);
			//If Audio element doesn't exist, create it
			if (!audio) {
				audio = document.createElement('audio');
				audio.id = id;
				audio.hidden = false;
				audio.autoplay = true;
                document.body.appendChild(audio);
			}
			//Bind audio stream to audio element
			audio.src = (window.webkitURL ? webkitURL : URL).createObjectURL(audioStream);
			return audio;
		},

        /**
         * Check if the docupent contains a video element  with the provided id.
         * If no video element exists, it created it prior to bind video stream to it
         *
         * @param id id of the video element
         * @param videoStream video stream from the WebSocket
         * @returns {HTMLElement}
         */
        initVideoElement : function(id, videoStream){
            var video = document.getElementById(id);
            if(!video){
                video = document.createElement('video');
                video.id = id;
                video.hidden = false;
                video.autoplay = true;
                document.body.appendChild(video);
            }
            //Bind video stream to video element
            video.src = (window.webkitURL ? webkitURL : URL).createObjectURL(videoStream);
            return video;
        },

		/**
		 * Place a call on a given phone number.
		 * Prior to place the call, it will lookup for best possible POP to use
		 * and set the X-Voxbone-Pop header accordingly
		 *
		 * @param destPhone phone number to dial in E164 format.
		 */
		call: function (destPhone) {
			var uri = new JsSIP.URI('sip', destPhone, 'voxout.voxbone.com');
			if (this.preferedPop == undefined) {
				this.preferedPop = voxbone.Pinger.getBestPop().name;
			}
			console.log("prefered pop: ", this.preferedPop);

			var headers = [];
			headers.push('X-Voxbone-Pop: ' + this.preferedPop);

			if (this.context) {
				headers.push('X-Voxbone-Context: ' + this.context);
			}

			var options = {
				'eventHandlers': {
					'progress': function (e) {
                        voxbone.WebRTC.rtcSession = e.sender;
                        voxbone.WebRTC.customEventHandler.progress(e);
					},
					'failed': function (e) {
						console.error("Call failed, Failure cause is", e.data.cause);
						voxbone.WebRTC.customEventHandler.failed(e);
					},
					'started': function (e) {
						voxbone.WebRTC.rtcSession = e.sender;
						if (voxbone.WebRTC.rtcSession.getRemoteStreams().length > 0) {
                            if(voxbone.WebRTC.allowVideo){
                                voxbone.WebRTC.initVideoElement(voxbone.WebRTC.videoComponentName,voxbone.WebRTC.rtcSession.getRemoteStreams()[0]);
                            }else{
                                voxbone.WebRTC.initAudioElement(voxbone.WebRTC.audioComponentName, voxbone.WebRTC.rtcSession.getRemoteStreams()[0]);
                            }
						}

						voxbone.WebRTC.customEventHandler.started(e);
					},
					'ended': function (e) {
						voxbone.WebRTC.customEventHandler.ended(e);
					}
				},
				'extraHeaders': [],
				'mediaConstraints': {'audio': true, 'video': voxbone.WebRTC.allowVideo}
			};

			options.extraHeaders = headers;
			this.phone.call(uri.toAor(), options)
		},

        sendDTMF : function(tone){
            this.rtcSession.sendDTMF(tone);
        },

		/**
		 * Terminate the WebRTC session
		 */
		hangup: function () {
            if (this.rtcSession != undefined) {
				this.rtcSession.terminate();
			}
		},

		/**
		 * Indicates if the client microphone is muted or not
		 */
		isMuted: false,

		/**
		 * Mute microphone
		 */
		mute: function () {
			var streams = this.rtcSession.getLocalStreams();
			for (var i = 0; i < streams.length; i++) {
				for (var j = 0; j < streams[i].getAudioTracks().length; j++) {
					streams[i].getAudioTracks()[j].enabled = false;
				}
			}
			this.isMuted = true;
		},

		/**
		 * unmute microphone
		 */
		unmute: function () {
			var streams = this.rtcSession.getLocalStreams();
			for (var i = 0; i < streams.length; i++) {
				for (var j = 0; j < streams[i].getAudioTracks().length; j++) {
					streams[i].getAudioTracks()[j].enabled = true;
				}
			}
			this.isMuted = false;
		},

		/**
		 * Checks if the client browser supports WebRTC or not.
		 *
		 * @returns {boolean}
		 */
		isWebRTCSupported: function () {
			if (!window.navigator.webkitGetUserMedia && !window.navigator.mozGetUserMedia) {
				return false;
			}

            var is_opera = !!window.opera || navigator.userAgent.indexOf('OPR/') >= 0;
            var is_firefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
            var is_chrome = !!window.chrome && !is_opera; // Chrome 1+

            //Chrome on MacOS seems to cause a lot of issue, let's just declare it as not supporting webrtc
            if(navigator.appVersion.indexOf("Mac")!=-1 && is_chrome){
                return false;
            }

            if (is_firefox) {
                var patt = new RegExp("firefox/([0-9])+");
                var patt2 = new RegExp("([0-9])+");
                var user_agent = patt.exec(navigator.userAgent.toLowerCase())[0];
                var version = patt2.exec(user_agent)[0];
                if (version < 23) {
                    return false;
                }
			}
            return true;
		}
	}
});

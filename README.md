# webrtc-js

## Introduction
webrtc-js is a Voxbone project which aims at providing an easy way for customers to make their DID numbers reachable from WebRTC-enabled browsers. Below is information on how this library works, more information can be found on our [Developer Portal](https://developers.voxbone.com/docs/webrtc/overview/)

It act as a wrapper around [JsSIP](https://github.com/versatica/JsSIP) and provide some extra functionalities such like:

* Ephemeral authentication support
* Automatic detection of the nearest POP (Point Of Presence)
* Context header which can then be passed onto customer equipment via an invite header ( X-Voxbone-Context )

## Basic usage

```javascript
//Create an authentication token
var voxrtc_config = {"key":"ABwxcFX6ayVxu/uNuZu3eBsjrFeg=","expires":1426067127,"username":"a_username"};
//Initialize Voxbone WebRTC connection
voxbone.WebRTC.init(voxrtc_config);
//Place a call on a given number
var e164 = 'a_number';
voxbone.WebRTC.call(e164);
```


## Authentication token
An authentication token needs to be provided for initializing the voxbone.WebRTC object.
```json
{
    "key":"ABwxcFX6ayVxu/uNuZu3eBsjrFeg=",
    "expires":1426067127,
    "username":"a_username"
}
```

* username: This is your credentials username
* expires: expiration date of the generated key (in seconds, epoch time)
* key: this is a base64 representation of an HMAC SHA1 of expires:username, salted with your password.
 
Various example on how to generate the authentication token can be found on Github such like

* [webrtc-auth-servlet](https://github.com/voxbone/webrtc-auth-servlet) (java)
* [webrtc-auth-perl](https://github.com/voxbone/webrtc-auth-perl) (perl)
* [webrtc-node](https://github.com/voxbone/webrtc-node/) (nodejs)
* [webrtc-auth-flask](https://github.com/jeansch/webrtc-auth-flask) (python)
* [voxbone-webrtc-php](https://github.com/ClintDavis/voxbone-webrtc-php) (php)

## Initialization
During the initialization phase, voxbone.WebRTC will:

* Authenticate toward Voxbone auth server and retrieve a list of WebSocket server as well as a list of ping servers.
* Ping all ping server in order to discover the best POP
* Initialize the connection to the WebSocket server.

Auth server url can be customized using
```javascript
voxbone.WebRTC.authServerURL = "https://webrtc.voxbone.com/rest/authentication/createToken";
```

If for any reason, you want to bypass the ping mechanism and force a POP, this can be achieved using
```javascript
voxbone.WebRTC.preferedPop = 'BE';
```

By default, Voxbone will initiate the connection using a Secure WebSocket (WSS). If for any reason you want to use non secure WebSocket, this can be achieved using
```javascript
voxbone.WebRTC.useSecureSocket = false;
```

## Call Context
Call context can be passed as a SIP INVITE header ( X-Voxbone-Context ).
Context is a free text field, and can be set as following:

```javascript
voxbone.WebRTC.context = "a value you want to pass onto X-Voxbone-Context header";
```

One possible approach is to pass a json structure as context value, so that you can keep things easy and still be able to pass multiple values in one go.
Please note that no other headers are forwarded by Voxbone.

## Calling

####Call establishment####
Once you're fully set up, you can now establish a call to a given number using
```javascript
var e164 = 'a_number';
voxbone.WebRTC.call(e164);
```

display name of the caller can be customized using
```javascript
voxbone.WebRTC.configuration.display_name = "a custom display name";
```
Note that the above has to be performed before call is established.

video and audio html element will automatically gets added to the html document upon call establishment.
If you want to avoid defaults elements to be added the page and feed your own element, you can set the ids of these element.
voxbone.WebRTC will then simply attach the streams to the provided element instead of providing its own.

```javascript
voxbone.WebRTC.audioComponentName = "peer-audio";
voxbone.WebRTC.videoComponentName = "peer-video";
```

####Muting####

Audio stream can be muted/unmuted as shown below
```javascript
//mute the audio stream
voxbone.WebRTC.mute();
//unmute the audio stream
voxbone.WebRTC.unmute();
//check if audio stream is muted (returns true/false)
voxbone.WebRTC.isMuted
```

####Sending DTMF####

DTMF can be sent once the call is established using
```javascript
//Send 1 as DTMF
voxbone.WebRTC.sendDTMF(1);
```

## Testing Web browser support
In order to test if the web browser do support WebRTC, we added a conveniant method which will simply returns true/false depending on the web browser capabilities
```javascript
var supported = voxbone.WebRTC.isWebRTCSupported();
```

define(function (require) {
    'use strict';

    var YouTubePlayerAPI = require('panel/model/youTubePlayerAPI');
    var YouTubePlayerError = require('common/enum/youTubePlayerError');

    //  This is the actual YouTube Player API widget housed within the iframe.
    var youTubePlayerWidget = null;
    
    //  This value is 1 because it is displayed visually.
    //  'Load attempt: 0' does not make sense to non-programmers.
    var _initialLoadAttempt = 1;

    var YouTubePlayer = Backbone.Model.extend({
        defaults: function() {
            return {
                ready: false,
                loading: false,
                api: new YouTubePlayerAPI(),
                iframeId: '',
                //  Match on my specific iframe or else else this logic can leak into outside webpages and corrupt other YouTube embeds.
                //  TODO: Keep this DRY with other area + leave comment for manifest.json.
                youTubeEmbedUrl: '*://*.youtube.com/embed/*?origin=chrome-extension://' + chrome.runtime.id + '*',
                //  Wait 6 seconds before each load attempt so that total time elapsed is one minute
                maxLoadAttempts: 10,
                loadAttemptDelay: 6000,
                currentLoadAttempt: _initialLoadAttempt,
                loadAttemptInterval: null,
                port: null
            };
        },
        
        initialize: function () {
            chrome.runtime.onConnect.addListener(this._onChromeRuntimeConnect.bind(this));

            this.listenTo(this.get('api'), 'change:ready', this._onApiChangeReady);
            //this.listenTo(Streamus.channels.foreground.vent, 'started', this._onForegroundStarted);
            this.on('change:loading', this._onChangeLoading);
            
            //  Connect to background.html's player
            var port = chrome.runtime.connect({
                name: 'youTubePlayerConnectRequest'
            });
            
            this.set('port', port);
            
            port.onMessage.addListener(function (message) {
                switch(message.action) {
                    case 'loadVideoById':
                        this.loadVideoById(message.data);
                        break;
                    case 'cueVideoById':
                        this.cueVideoById(message.data);
                        break;
                    case 'stop':
                        this.stop();
                        break;
                    case 'pause':
                        this.pause();
                        break;
                    case 'play':
                        this.play();
                        break;
                    case 'preload':
                        this.preload();
                        break;
                    case 'seekTo':
                        this.seekTo(message.data);
                        break;
                    case 'setPlaybackQuality':
                        this.setPlaybackQuality(message.data);
                        break;
                    case 'setVolume':
                        this.setVolume(message.data);
                        break;
                    case 'setMuted':
                        this.setMuted(message.data);
                        break;
                        
                }
            }.bind(this));

            port.postMessage({
                event: 'initial',
                data: this
            });

            //  TODO: Refactor, maybe make generic w/ this.on('all)
            this.on('change:ready', function(model, ready) {
                port.postMessage({
                    event: 'change:ready',
                    ready: ready
                });
            });

            this.on('change:state', function(model, state) {
                port.postMessage({
                    event: 'change:state',
                    state: state
                });
            });

            this.on('change:loading', function(model, loading) {
                port.postMessage({
                    event: 'change:loading',
                    loading: loading
                });
            });

            this.on('change:currentLoadAttempt', function(model, currentLoadAttempt) {
                port.postMessage({
                    event: 'change:currentLoadAttempt',
                    currentLoadAttempt: currentLoadAttempt
                });
            });

            this.on('youTubeError', function(model, youTubeError) {
                port.postMessage({
                    event: 'youTubeError',
                    youTubeError: youTubeError
                });
            });
        },
        
        _onChromeRuntimeConnect: function(port) {
            //  TODO: keep string DRY
            console.log('port name:', port.name);
            if (port.name === 'youTubeIFrameConnectRequest') {
                port.onMessage.addListener(this._onYouTubeIFrameMessage.bind(this));
            }
        },
        
        _onYouTubeIFrameMessage: function (message) {
            var port = this.get('port');

            //  It's better to be told when time updates rather than poll YouTube's API for the currentTime.
            if (!_.isUndefined(message.currentTime)) {
                port.postMessage({
                    event: 'change:currentTime',
                    currentTime: message.currentTime
                });
            }

            //  YouTube's API for seeking/buffering doesn't fire events reliably.
            //  Listen directly to the element for more responsive results.
            if (!_.isUndefined(message.seeking)) {
                port.postMessage({
                    event: 'change:seeking',
                    seeking: message.seeking
                });
            }

            if (!_.isUndefined(message.error)) {
                port.postMessage({
                    event: 'iframeError',
                    iframeError: message.error
                });
            }

            if (!_.isUndefined(message.flashLoaded)) {
                port.postMessage({
                    event: 'flashLoaded',
                    flashLoaded: message.flashLoaded
                });
            }
        },
        
        //  Preload is used to indicate that an attempt to load YouTube's API is hopefully going to come soon. However, if the iframe
        //  holding YouTube's API fails to load then load will not be called. If the iframe does load successfully then load will be called.
        preload: function () {
            if (!this.get('loading')) {
                //  Ensure the widget is null for debugging purposes. 
                //  Being able to tell the difference between a widget API method failing and the widget itself not being ready is important.
                youTubePlayerWidget = null;
                //  It is important to set loading after ready because having the player be both 'loading' and 'ready' does not make sense.
                this.set('ready', false);
                this.set('loading', true);
            }
        },
        
        //  Loading a widget requires the widget's API be ready first. Ensure that the API is loaded
        //  otherwise defer loading a widget until the API is ready.
        load: function () {
            var api = this.get('api');
            
            if (api.get('ready')) {
                this._loadWidget();
            } else {
                api.load();
            }
        },

        stop: function () {
            youTubePlayerWidget.stopVideo();
        },

        pause: function () {
            youTubePlayerWidget.pauseVideo();
        },

        play: function () {
            youTubePlayerWidget.playVideo();
        },

        seekTo: function (timeInSeconds) {
            //  Always pass allowSeekAhead: true to the seekTo method.
            //  If this value is not provided and the user seeks to the end of a song while paused 
            //  the player will enter into a bad state of 'ended -> playing.' 
            //  https://developers.google.com/youtube/js_api_reference#seekTo
            youTubePlayerWidget.seekTo(timeInSeconds, true);
        },
        
        setMuted: function (muted) {
            if (muted) {
                youTubePlayerWidget.mute();
            } else {
                youTubePlayerWidget.unMute();
            }
        },

        setVolume: function (volume) {
            youTubePlayerWidget.setVolume(volume);
        },

        //  The variable is called suggestedQuality because the widget may not have be able to fulfill the request.
        //  If it cannot, it will set its quality to the level most near suggested quality.
        setPlaybackQuality: function (suggestedQuality) {
            youTubePlayerWidget.setPlaybackQuality(suggestedQuality);
        },

        loadVideoById: function (videoOptions) {
            youTubePlayerWidget.loadVideoById(videoOptions);
        },

        cueVideoById: function (videoOptions) {
            youTubePlayerWidget.cueVideoById(videoOptions);
        },

        _loadWidget: function () {
            //  YouTube's API creates the window.YT object with which widgets can be created.
            //  https://developers.google.com/youtube/iframe_api_reference#Loading_a_Video_Player
            youTubePlayerWidget = new window.YT.Player(this.get('iframeId'), {
                events: {
                    onReady: this._onYouTubePlayerReady.bind(this),
                    onStateChange: this._onYouTubePlayerStateChange.bind(this),
                    onError: this._onYouTubePlayerError.bind(this)
                }
            });
        },

        _onYouTubePlayerReady: function () {
            //  TODO: It's apparently possible for youTubePlayerWidget.setVolume to be undefined at this point in time. How can I reproduce?
            //  It's important to set ready to true before loading to false otherwise it looks like YouTubePlayer failed to load properly.
            this.set('ready', true);
            this.set('loading', false);
        },

        _onYouTubePlayerStateChange: function (state) {
            //  Pass 'this' as the first parameter to match the event signature of a Backbone.Model change event.
            this.trigger('change:state', this, state.data);
        },

        //  Emit errors so the foreground so can notify the user.
        _onYouTubePlayerError: function (error) {
            //  If the error is really bad then attempt to recover rather than reflecting the error throughout the program.
            if (error.data === YouTubePlayerError.ReallyBad) {
                this.preload();
            } else {
                this.trigger('youTubeError', this, error.data);
            }
        },

        _onApiChangeReady: function (model, ready) {
            if (ready) {
                this._loadWidget();
            }
        },
        
        _onChangeLoading: function (model, loading) {
            this.set('currentLoadAttempt', _initialLoadAttempt);
            var loadAttemptInterval = null;

            //  Consume an attempt every 6 seconds while loading.
            if (loading) {
                loadAttemptInterval = setInterval(this._onLoadAttemptDelayExceeded.bind(this), this.get('loadAttemptDelay'));
            } else {
                clearInterval(this.get('loadAttemptInterval'));
            }
            
            this.set('loadAttemptInterval', loadAttemptInterval);
        },
        
        _onLoadAttemptDelayExceeded: function () {
            var currentLoadAttempt = this.get('currentLoadAttempt');
                    
            if (currentLoadAttempt === this.get('maxLoadAttempts')) {
                this.set('loading', false);
            } else {
                this.set('currentLoadAttempt', currentLoadAttempt + 1);
            }
        },
        
        //  Streamus could have disconnected from the API and failed to recover automatically.
        //  A good time to try recovering again is when the user is interacting the UI.
        _onForegroundStarted: function () {
            if (!this.get('ready')) {
                this.preload();
            }
        }
    });

    return YouTubePlayer;
});
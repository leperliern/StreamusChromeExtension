define(function () {
    'use strict';

    var YouTubePlayerView = Marionette.ItemView.extend({
        tagName: 'iframe',
        id: 'youtube-player',
        template: false,
        //  webRequestCompleted indicates whether loading the src of the iframe was successful
        webRequestCompleted: false,
        //  loaded is set to true when the iframes contentWindow is ready
        loaded: false,
        
        //  TODO: It's a bit confusing that I have to specify playerVars here instead of in YouTube's API hook. However,
        //  I need to do so because I'm building the iframe myself rather than letting YouTube handle the construction.
        attributes: function () {
            return {
                name: 'youtube-player',
                frameborder: 0,
                title: 'YouTube player',
                width: 356,
                height: 200,
                src: 'https://www.youtube.com/embed/P4Uv_4jGgAM?origin=chrome-extension://' + chrome.runtime.id + '&enablejsapi=1&controls=0&cc_load_policy=0&iv_load_policy=3&rel=0&showinfo=0&modestbranding=1'
            };
        },
        
        events: {
            'load': '_onLoad'
        },
        
        initialize: function () {
            this.model.set('iframeId', this.el.id);

            //  IMPORTANT: I need to bind like this and not just use .bind(this) inline because bind returns a new, anonymous function
            //  which will break chrome's .removeListener method which expects a named function in order to work properly.
            this._onChromeWebRequestBeforeSendHeaders = this._onChromeWebRequestBeforeSendHeaders.bind(this);
            this._onChromeWebRequestCompleted = this._onChromeWebRequestCompleted.bind(this);

            var iframeUrlPattern = '*://*.youtube.com/embed/*?origin=chrome-extension://' + chrome.runtime.id + '*';

            chrome.webRequest.onBeforeSendHeaders.addListener(this._onChromeWebRequestBeforeSendHeaders, {
                urls: [iframeUrlPattern]
            }, ['blocking', 'requestHeaders']);
            
            chrome.webRequest.onCompleted.addListener(this._onChromeWebRequestCompleted, {
                urls: [iframeUrlPattern],
                types: ['sub_frame']
            });
        },
        
        onBeforeDestroy: function () {
            chrome.webRequest.onBeforeSendHeaders.removeListener(this._onChromeWebRequestBeforeSendHeaders);
            chrome.webRequest.onCompleted.removeListener(this._onChromeWebRequestCompleted);
        },
        
        //  Add a Referer to requests because Chrome extensions don't implicitly have one.
        //  Without a Referer - YouTube will reject most requests to play music.
        _onChromeWebRequestBeforeSendHeaders: function (info) {
            var refererRequestHeader = this._getHeader(info.requestHeaders, 'Referer');
            var referer = 'https://www.youtube.com/';

            if (_.isUndefined(refererRequestHeader)) {
                info.requestHeaders.push({
                    name: 'Referer',
                    value: referer
                });
            } else {
                refererRequestHeader.value = referer;
            }
            
            //  Opera does not default to using the HTML5 player because of lack of MSE support.
            //  Modify user's preferences being sent to YouTube to imply that the user wants HTML5 only
            //  This will cause preferences to go from looking like PREF=al=en&f1=50000000&f5=30; to PREF=al=en&f1=50000000&f5=30&f2=40000000;
            var isOpera = navigator.userAgent.indexOf(' OPR/') >= 0;
            if (isOpera) {
                var html5PrefValue = 'f2=40000000';
                var cookieRequestHeader = this._getHeader(info.requestHeaders, 'Cookie');
                
                if (_.isUndefined(cookieRequestHeader)) {
                    info.requestHeaders.push({
                        name: 'Cookie',
                        value: 'PREF=' + html5PrefValue
                    });
                } else {
                    //  Try to find PREF:
                    var cookieValue = cookieRequestHeader.value;
                    var prefStartIndex = cookieValue.indexOf('PREF');
                    
                    //  Failed to find any preferences, so provide full pref string
                    if (prefStartIndex === -1) {
                        cookieRequestHeader.value = cookieValue + ' PREF=' + html5PrefValue + ';';
                    } else {
                        var prefEndIndex = cookieValue.indexOf(';', prefStartIndex);
                        
                        //  Don't try to handle malformed preferences, too difficult.
                        if (prefEndIndex !== -1) {
                            //  Inject custom preference value
                            var modifiedPref = cookieValue.slice(0, prefEndIndex) + '&' + html5PrefValue + cookieValue.slice(prefEndIndex);
                            cookieRequestHeader.value = modifiedPref;
                        }
                    }
                }
            }
            
            return { requestHeaders: info.requestHeaders };
        },
        
        //  Only load YouTube's API once the iframe has been built successfully.
        //  If Internet is lagging or disconnected then _onWebRequestCompleted will not fire.
        //  Even if the Internet is working properly, it's possible to try and load the API before CORS is ready to allow postMessages.
        _onChromeWebRequestCompleted: function () {
            chrome.webRequest.onCompleted.removeListener(this._onWebRequestCompleted);
            this.webRequestCompleted = true;
            this._checkLoadModel();
        },
        
        _checkLoadModel: function () {
            if (this.loaded && this.webRequestCompleted) {
                this.model.load();
            }
        },

        _onLoad: function () {
            this.loaded = true;
            this._checkLoadModel();
        },
        
        _getHeader: function(requestHeaders, headerName) {
            var refererRequestHeader = _.find(requestHeaders, function (requestHeader) {
                return requestHeader.name === headerName;
            });

            return refererRequestHeader;
        }
    });

    return YouTubePlayerView;
});
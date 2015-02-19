define(function() {
    'use strict';

    var ChromePanelManager = Backbone.Model.extend({
        initialize: function () {
            
            //  TODO: Does this panel need to be resized for different OSes?
            //  TODO: How can I link width/height to YouTubePlayerView
            chrome.windows.create({
                url: 'chrome-extension://jbnkffmindojffecdhbbmekbmkkfpmjd/panel.html',
                width: 356,
                height: 236,
                type: 'panel'
            }, function (window) {
                chrome.windows.update(window.id, {
                    state: 'minimized'
                }, _.noop);
            });
        }
    });

    return ChromePanelManager;
});
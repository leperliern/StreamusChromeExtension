define(function (require) {
    'use strict';

    var ClipboardRegion = require('background/view/clipboardRegion');
    var BackgroundAreaTemplate = require('text!template/backgroundArea.html');

    var BackgroundAreaView = Marionette.LayoutView.extend({
        id: 'backgroundArea',
        template: _.template(BackgroundAreaTemplate),
        
        regions: function () {
            return {
                clipboardRegion: {
                    el: '#' + this.id + '-clipboardRegion',
                    regionClass: ClipboardRegion
                }              
            };
        },

        onAttach: function () {
            Streamus.channels.backgroundArea.vent.trigger('attached');
        }
    });

    return BackgroundAreaView;
});
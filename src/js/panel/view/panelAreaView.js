define(function (require) {
    'use strict';

    var YouTubePlayerRegion = require('panel/view/youTubePlayerRegion');
    var PanelAreaTemplate = require('text!template/panelArea.html');

    var PanelAreaView = Marionette.LayoutView.extend({
        id: 'panelArea',
        template: _.template(PanelAreaTemplate),
        
        regions: function (options) {
            return {
                youTubePlayerRegion: {
                    el: '#' + this.id + '-youTubePlayerRegion',
                    regionClass: YouTubePlayerRegion,
                    youTubePlayer: options.model.get('youTubePlayer')
                }          
            };
        },

        onAttach: function () {
            Streamus.channels.panelArea.vent.trigger('attached');
        }
    });

    return PanelAreaView;
});
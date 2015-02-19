define(function (require) {
    'use strict';

    var PanelArea = require('panel/model/panelArea');
    var PanelAreaView = require('panel/view/panelAreaView');
    
    var Application = Marionette.Application.extend({
        regions: {
            panelAreaRegion: '#panelAreaRegion'
        },
        
        //  All the channels used for global event communication across the page
        channels: {
            panelArea: Backbone.Wreqr.radio.channel('panelArea')
        },

        initialize: function() {
            this.on('start', this._onStart);
        },
        
        _onStart: function () {
            this._showPanel();
        },

        _showPanel: function () {
            this.panelAreaRegion.show(new PanelAreaView({
                model: new PanelArea()
            }));
        }
    });

    $(function() {
        var streamus = new Application();
        window.Streamus = streamus;
        streamus.start();
    });
});
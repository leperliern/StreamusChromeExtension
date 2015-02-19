define(function (require) {
    'use strict';

    var YouTubePlayer = require('panel/model/youTubePlayer');

    var BackgroundArea = Backbone.Model.extend({
        defaults: {
            youTubePlayer: null
        },

        initialize: function () {
            var youTubePlayer = new YouTubePlayer();
            this.set('youTubePlayer', youTubePlayer);
        }
    });

    return BackgroundArea;
});
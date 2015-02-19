define(function (require) {
    'use strict';
    
    require('backbone.marionette');
    require('backbone.localStorage');
    require('googleAnalytics');
    var Cocktail = require('cocktail');

    Cocktail.patch(Backbone);

    //  Finally, load the application:
    require(['panel/application']);
});
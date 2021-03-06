/**
 * @module integrations/backbone
 */


/* Main Backbone integration for libcoverage.js. Provides means to access WCS
 * services in a MVC-style manner.
 *
 * Limitations:
 *  - as with the current state of the WCS standard, it is currently not easily
 *    possible to alter data hosted on a server via WCS-T functions. So these
 *    classes all provide a read access only.
 */

'use strict';

var utils = require("../utils");
var coreParse = require("../parse");
var coreKVP = require("../kvp");

var Backbone = require("backbone");


var getValue = function(object, prop) {
    if (!(object && object[prop])) return null;
    return _.isFunction(object[prop]) ? object[prop]() : object[prop];
};

/**
 * @class XmlModel
 *
 * Utility class for Models that use XML to retrieve data.
 */

var XmlModel = Backbone.Model.extend({
    initialize: function(attributes) {
        if (attributes.urlRoot) {
            this.urlRoot = attributes.urlRoot;
            delete attributes.urlRoot;
        }
    },
    fetch: function(options) {
        options || (options = {});
        options.dataType = "xml";
        Backbone.Model.prototype.fetch.call(this, options);
    }
});

/**
 * @class XmlModel
 *
 * Utility class for Collections that use XML to retrieve data.
 */

var XmlCollection = Backbone.Collection.extend({
    fetch: function(options) {
        options || (options = {});
        options.dataType = "xml";
        Backbone.Collection.prototype.fetch.call(this, options);
    }
});

/**
 * @class Service
 *
 * This class provides access to service meta-data and contents
 *
 * @method fetchAdvertisedCoverages: return a WCS.Backbone.CoverageSet of
 *                                   all advertised coverages.
 */

var Service = XmlModel.extend({
    url: function() {
        return coreKVP.getCapabilitiesURL(getValue(this, "urlRoot"));
    },
    parse: function(response) {
        return WCS.Core.Parse.parse(response);
    },
    fetchAdvertisedCoverages: function(options) {
        var contents = this.get("contents");
        var ids = [];
        if (contents)
            ids = _.pluck(contents.coverages, "coverageId");
            
        var cset = new CoverageSet([], {
            urlRoot: this.urlRoot,
            coverageIds: ids
        });
        cset.fetch(options);
        return cset;
    }
});

/**
 * @class Coverage
 *
 * This class provides access to coverages
 *
 * @method getDownloadUrl: return a download URL for this coverage with
 *                         specified options
 */

var Coverage = XmlModel.extend({
    idAttribute: "coverageId",
    
    url: function() {
        var url = getValue(this, 'urlRoot') || getValue(this.collection, 'url');
        if (this.id)
            return coreKVP.describeCoverageURL(url, this.id);
        // TODO: raise Error?
    },
    parse: function(response) {
        if (_.has(response, "coverageId"))
            return response;
        return coreParse.parse(response).coverageDescriptions[0];
    },
    getRangeType: function() {
        return this.get("rangeType");
    },
    getDownloadUrl: function(options) {
        var url = getValue(this, 'urlRoot') || getValue(this.collection, 'urlRoot');
        return coreKVP.getCoverageURL(url, this.id, options);
    }
});

var CoverageSet = XmlCollection.extend({
    model: Coverage,
    initialize: function(models, options) {
        if (models.length == 0) {
            this._ids = options.coverageIds || [];
        }
        else {
            this._ids = _.pluck(models, id);
        }

        this.urlRoot = options.urlRoot || this.urlRoot;
    },
    url: function() {
        return coreKVP.describeCoverageURL(this.urlRoot, this._ids);
    },
    parse: function(response){
        return coreParse.parse(response).coverageDescriptions;
    }
});

var EOCoverageSet = XmlCollection.extend({
    initialize: function(models, options) {
        this.options = options || {};
        this.type = options.type || this.type;
        if(this.type) {
            delete options.type;
            if (this.type === "coverages")
                this.model = Coverage
            else if (this.type === "datasetSeries")
                this.model = DatasetSeries
        }
        this.urlRoot = options.urlRoot || this.urlRoot;
        this.eoid = options.eoid || this.eoid;
    },
    url: function() {
        return coreKVP.describeEOCoverageSetURL(
            this.urlRoot, this.eoid, this.options
        );
    },
    parse: function(response){
        var result = coreParse.parse(response);
        this.coverageDescriptions = result.coverageDescriptions;
        this.datasetSeriesDescriptions = result.datasetSeriesDescriptions;
        switch(this.type) {
            case "coverages": return result.coverageDescriptions;
            case "datasetSeries": return result.datasetSeriesDescriptions;
            default: return _.union(result.coverageDescriptions, result.datasetSeriesDescriptions);
        }
    }
});

module.exports = {
    Service: Service,
    Coverage: Coverage,
    CoverageSet: CoverageSet,
    EOCoverageSet: EOCoverageSet
};


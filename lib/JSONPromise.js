var q = require('Q');
var Promise = require('./QPromise');

function JSONPromise(json) {
	console.log('jsonpromise', json);
    if (json instanceof Array) {
        return q.all(json);
    }

	if (!json || q.isPromise(json)) {
		return json;
	}

	console.log('heyheyhey');
    var w = [], p = [];

    for(var name in json) {
        p.push(JSONPromise(json[name]));
        w.push(name);
    }

    return q.all(p).then(function (p) {
        var toReturn = {};

        for(var a = 0; a < p.length; a++) {
            toReturn[w[a]] = p[a];
        }

        return toReturn;
    });
};

module.exports = JSONPromise;

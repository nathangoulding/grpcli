var should = require('chai').should(),
    scapegoat = require('../index'),
    escape = scapegoat.escape,
    unescape = scapegoat.unescape;

describe('#escape', function() {
    it('converts & into &amp;', function () {
        escape('&').should.equal('&amp;');
    });
});
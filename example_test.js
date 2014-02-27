// unlimited stack traces through longjohn
var longjohn = require('longjohn');
longjohn.async_trace_limit = -1;

var assert = require('assert');

// These tests are designed to run concurrently
// this means that a test will run as soon as everything
// that it depends on has finished.
// to run a single test do: node test.js [name of test to run]
var test = require('./simple_tests');

var balanced = require('./example');

var fixtures = {
    card: {
        'number': '4111111111111111',
        'expiration_year': '2016',
        'expiration_month': '12'
    },
    bank_account: {
        name: "Miranda Benz",
        account_number: "9900826301",
        routing_number: "021000021",
        type: "checking",
        meta: {
            info: "created another test account",
            test: true
        }
    }
};

test('api_key', function () {
    return balanced.api_key.create().then(function(obj) {
		console.log('api key create', obj);
        balanced = balanced.configure(obj.secret);
        return obj;
    });
});

test('marketplace', function (api_key) {
    return balanced.marketplace;
});

test('customer_create', function(marketplace) {
    return marketplace.customers.create();
});

test('card_create', function (marketplace){
    return balanced.marketplace.cards.create(fixtures.card);
});

test('bank_account_create', function (marketplace) {
    return marketplace.bank_accounts.create(fixtures.bank_account);
});

test('update_customer', function (customer_create) {
    var cb = this;
    customer_create.name = "testing name";
    return customer_create.save().then(function (c) {
        cb.assert(c.name == 'testing name');
    });
});

test('add_card_to_customer', function(customer_create, card_create) {
    var cb = this;
    return card_create.associate_to_customer(customer_create).then(function () {
        cb.assert(card_create.links.customer === customer_create.id);
        return card_create;
    });
});



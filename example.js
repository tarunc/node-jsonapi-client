var JSONAPIClient = require('./lib/JSONAPIClient');
var _ = require('lodash/dist/lodash.underscore');

var defaultOptions = {

};

function createBaseAPIClient(apiKey, clientOpts) {
  var clientOptions = _.extend({}, clientOpts || {}, {
    requestOptions: {
      headers: {
        'Accept': 'application/vnd.balancedpayments+json; version=1.1, application/vnd.api+json',
        'User-Agent': 'balanced-node/1.1.0'
      }
    }
  });

  if (apiKey) {
    clientOptions.auth = {
      user: apiKey,
      pass: ''
    };
  }

  var balanced = new JSONAPIClient('https://api.balancedpayments.com', clientOptions);
  balanced.registerType('api_key');

  return balanced;
};

function Balanced(apiKey, options) {
  // Extend the default options
  var opts = _.defaults(options || {}, Balanced.defaultOptions);

  // Create the balanced api client
  var balanced = createBaseAPIClient(apiKey, opts.client);

  balanced.registerType('marketplace', {
    'debits': '_',
    'reversals': '_',
    'customers': '_',
    'credits': '_',
    'cards': '_',
    'card_holds': '_',
    'refunds': '_',
    'transactions': '_',
    'bank_accounts': '_',
    'callbacks': '_',
    'events': '_'
  });

  balanced.marketplace = balanced.get('marketplaces').then(function(marketplace) {
    if (!marketplace) {
      return balanced._objects.marketplace.create().then(function(mp) {
        balanced.marketplace = mp;
        return mp;
      });
    }

    balanced.marketplace = marketplace;
    return marketplace;
  });

  balanced.registerType('customer', {
    add_card: setCustomer,
    add_bank_account: setCustomer,

    debits: '_',
    credits: '_',
    cards: '_',
    bank_accounts: '_',
    reversals: '_',
    refunds: '_',
    orders: '_',

    // are we removing source and destination from a customer?
    source: '_',
    destination: '_'
  });

  balanced.registerType('card', {
    debit: createTransaction('debit'),
    hold: createTransaction('card_hold'),

    associate_to_customer: associateCustomer,
    associateToCustomer: associateCustomer,
    associateCustomer: associateCustomer,

    customer: '_',
    debits: '_',
    card_holds: '_'
  });

  balanced.registerType('bank_account', {
    debit: createTransaction('debit'),
    credit: createTransaction('credit'),

    associate_to_customer: associateCustomer,
    associateToCustomer: associateCustomer,
    associateCustomer: associateCustomer,

    verify: createTransaction('bank_account_verification'),
    confirm: function(amount_1, amount_2) {
      return this.bank_account_verifications.get(0).confirm(amount_1, amount_2).thenResolve(this).refresh();
    },

    bank_account_verifications: '_',
    credits: '_',
    debits: '_',
    customer: '_',
    bank_account_verification: '_',
  });

  balanced.registerType('card_hold', {
    capture: createTransaction('debit'),
    void: function() {
      return this.unstore()
    },

    card: '_',
  });

  balanced.registerType('bank_account_verification', {
    confirm: function(amount_1, amount_2) {
      this.amount_1 = amount_1;
      this.amount_2 = amount_2;
      return this.save();
    },

    bank_account: '_',
  });

  balanced.registerType('callback');

  balanced.registerType('dispute', {
    events: '_'
  });

  balanced.registerType('debit', {
    refund: createTransaction('refund'),

    customer: '_',
    refunds: '_',
    order: '_',
    source: '_',
    events: '_'
  });

  balanced.registerType('credits', {
    reversal: createTransaction('reversal'),

    customer: '_',
    order: '_',
    destination: '_',
    events: '_'
  });

  balanced.registerType('event');

  balanced.registerType('order', {
    debit_from: function(source, args) {
      if (typeof args == 'number') {
        args = {
          amount: args
        };
      }

      args.order = this.href;
      return source.debit(args);
    },

    credit_to: function(destination, args) {
      if (typeof args == 'number') {
        args = {
          amount: args
        };
      }

      args.order = this.href;
      return destination.credit(args);
    },

    debits: '_',
    refunds: '_',
    credits: '_',
    reversals: '_',
    buyers: '_',
    merchant: '_',
  });

  balanced.registerType('refund', {
    debit: '_',
    order: '_',
    events: '_'
  });

  balanced.registerType('reversal', {
    credit: '_',
    order: '_',
    events: '_'
  });

  function setCustomer(obj) {
    return (_.isString(obj) ? balanced.get(obj) : balanced._createPromise(obj)).set('links.customer', this.id).save().thenResolve(this);
  };

  // _.extend(this, balanced);

  return balanced;
};

Balanced.configure = function(apiKey, options) {
   var b = Balanced(apiKey, options);
   return b;
};

Balanced.api_key = {
  create: function() {
    var b = createBaseAPIClient();
    return b.api_key.create();
  }
};

Balanced.defaultOptions = defaultOptions;

module.exports = Balanced;

function createTransaction(type) {
  return function(args) {
    if (typeof args == 'number') {
      args = {
        amount: args
      };
    }

    return this.create(type, args);
  };
};

function associateCustomer(customer) {
  this.links.customer = customer.id;
  return this.save();
};

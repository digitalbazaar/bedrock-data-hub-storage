/*!
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const masterKey = {
  title: 'Wrapped Master Key',
  type: 'object',
  required: true,
  properties: {
    id: {
      type: 'string',
      required: true
    },
    jwe: {
      type: 'object',
      required: true,
      properties: {
        unprotected: {
          type: 'object',
          required: true,
          properties: {
            alg: {
              type: 'string',
              required: true
            },
            p2c: {
              type: 'integer',
              required: false
            },
            p2s: {
              type: 'string',
              required: false
            }
          },
          // allow other encryption mechanisms
          additionalProperties: true
        },
        encrypted_key: {
          type: 'string',
          required: true
        }
      }
    }
  }
};

const encryptedDocument = {
  title: 'Encrypted Document',
  type: 'object',
  required: true,
  properties: {
    id: {
      type: 'string',
      required: true
    },
    attributes: {
      type: 'array',
      required: false,
      items: [{
        type: 'object',
        properties: {
          name: {
            type: 'string',
            required: true
          },
          value: {
            type: 'string',
            required: true
          }
        }
      }]
    },
    jwe: {
      type: 'object',
      required: true,
      properties: {
        unprotected: {
          type: 'object',
          required: true,
          properties: {
            alg: {
              type: 'string',
              required: true
            },
            enc: {
              type: 'string',
              required: true
            }
          }
        },
        encrypted_key: {
          type: 'string',
          required: true
        },
        iv: {
          type: 'string',
          required: true
        },
        ciphertext: {
          type: 'string',
          required: true
        },
        tag: {
          type: 'string',
          required: true
        }
      }
    }
  }
};

const equalsQuery = {
  title: 'Encrypted Document Equals Query',
  type: 'object',
  required: true,
  properties: {
    equals: {
      type: 'array',
      required: true,
      items: [{
        type: 'object',
        required: true
        // items will be `key: value` pairs where values are strings but
        // keys are free-form
      }]
    }
  }
};

const hasQuery = {
  title: 'Encrypted Document Has Query',
  type: 'object',
  required: true,
  properties: {
    has: {
      type: 'array',
      required: true,
      items: [{
        type: 'string',
        required: true
      }]
    }
  }
};

const query = {
  title: 'Encrypted Document Query',
  type: [equalsQuery, hasQuery],
  required: true
};

module.exports.masterKey = () => masterKey;
module.exports.encryptedDocument = () => encryptedDocument;
module.exports.query = () => query;

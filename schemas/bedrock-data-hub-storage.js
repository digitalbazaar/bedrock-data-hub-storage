/*!
 * Copyright (c) 2018-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const dataHubConfig = {
  title: 'Data Hub Configuration',
  type: 'object',
  // TODO: do not require primary `kek` and `hmac` in the future
  required: ['sequence', 'controller', 'kek', 'hmac'],
  additionalProperties: false,
  properties: {
    id: {
      type: 'string'
    },
    controller: {
      type: 'string'
    },
    kek: {
      type: 'object',
      required: ['id', 'algorithm'],
      properties: {
        id: {
          type: 'string'
        },
        algorithm: {
          type: 'string'
        }
      }
    },
    hmac: {
      type: 'object',
      required: ['id', 'algorithm'],
      properties: {
        id: {
          type: 'string'
        },
        algorithm: {
          type: 'string'
        }
      }
    }
  }
};

const jwe = {
  title: 'JWE with at least one recipient',
  type: 'object',
  required: ['protected', 'recipients', 'iv', 'ciphertext', 'tag'],
  properties: {
    protected: {
      type: 'string'
    },
    recipients: {
      type: 'array',
      minItems: 1,
      items: [{
        type: 'object',
        required: ['alg', 'kid', 'encrypted_key'],
        properties: {
          alg: {
            type: 'string'
          },
          kid: {
            type: 'string'
          },
          encrypted_key: {
            type: 'string'
          }
        }
      }]
    },
    iv: {
      type: 'string'
    },
    ciphertext: {
      type: 'string'
    },
    tag: {
      type: 'string'
    }
  }
};

const indexedEntry = {
  title: 'Data Hub Indexed Entry',
  type: 'object',
  required: ['hmac', 'sequence', 'attributes'],
  properties: {
    hmac: {
      type: 'object',
      required: ['id', 'algorithm'],
      properties: {
        id: {
          type: 'string'
        },
        algorithm: {
          type: 'string'
        }
      }
    },
    sequence: {
      type: 'number'
    },
    attributes: {
      type: 'array',
      items: [{
        type: 'object',
        required: ['name', 'value'],
        properties: {
          name: {
            type: 'string'
          },
          value: {
            type: 'string'
          }
        }
      }]
    }
  }
};

const dataHubDocument = {
  title: 'Data Hub Document',
  type: 'object',
  required: ['id', 'sequence', 'jwe'],
  additionalProperties: false,
  properties: {
    id: {
      type: 'string'
    },
    sequence: {
      type: 'number'
    },
    indexed: {
      type: 'array',
      items: [indexedEntry]
    },
    jwe
  }
};

const query = {
  title: 'Data Hub Document Query',
  type: 'object',
  required: ['index'],
  anyOf: [
    {required: ['equals']},
    {required: ['has']}
  ],
  additionalProperties: false,
  properties: {
    index: {
      type: 'string'
    },
    equals: {
      type: 'array',
      minItems: 1,
      items: [{
        type: 'object',
        // items will be `key: value` pairs where values are strings but
        // keys are free-form
      }]
    },
    has: {
      type: 'array',
      minItems: 1,
      items: [{
        type: 'string'
      }]
    }
  }
};

module.exports.config = () => dataHubConfig;
module.exports.document = () => dataHubDocument;
module.exports.query = () => query;

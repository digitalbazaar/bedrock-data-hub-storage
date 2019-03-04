/*!
 * Copyright (c) 2018-2019 Digital Bazaar, Inc. All rights reserved.
 */
/* jshint node: true */

'use strict';

const helpers = require('./helpers');

const data = {};
module.exports = data;

const accounts = data.accounts = {};

// regular permissions
const email = 'alpha@example.com';
accounts[email] = {};
accounts[email].account = helpers.createAccount(email);
accounts[email].meta = {};
accounts[email].meta.sysResourceRole = [{
  sysRole: 'bedrock-account.regular',
  generateResource: 'id'
}];

data.config = {
  "id": "e77fff16-3e0e-11e9-ab58-10bf48838a41",
  "sequence": 0,
  "kek": {
    "id": "f3ce1a43-162f-43b2-80b4-b51abbeea46e",
    "algorithm": "A256KW"
  },
  "hmac": {
    "id": "13a91b49-3bd6-4e7a-aacd-4a1e0468bb2e",
    "algorithm": "HS256"
  },
  "primary": true
};

data.doc1 = {
  "id": "foo",
  "sequence": 0,
  "indexed": [
    {
      "hmac": {
        "id": "13a91b49-3bd6-4e7a-aacd-4a1e0468bb2e",
        "algorithm": "HS256"
      },
      "sequence": 0,
      "attributes": []
    }
  ],
  "jwe": {
    "protected": "eyJlbmMiOiJDMjBQIn0",
    "recipients": [
      {
        "header": {
          "alg": "A256KW",
          "kid": "f3ce1a43-162f-43b2-80b4-b51abbeea46e"
        },
        "encrypted_key":
          "HM00migkUSdZjvqmq4b7ixiXnfeLieA7QX2ew6OF4oPUA3HovaMnOw"
      }
    ],
    "iv": "S-bNe9DayHcXWhBH",
    "ciphertext": "bcZnPyreRmcLCngVbMHJTNeIIxkSJno",
    "tag": "R2xDL9AJo7IhZ7y_sebgJw"
  }
};

data.doc2 = {
  "id": "foo2",
  "sequence": 0,
  "indexed": [
    {
      "hmac": {
        "id": "13a91b49-3bd6-4e7a-aacd-4a1e0468bb2e",
        "algorithm": "HS256"
      },
      "sequence": 0,
      "attributes": []
    }
  ],
  "jwe": {
    "protected": "eyJlbmMiOiJDMjBQIn0",
    "recipients": [
      {
        "header": {
          "alg": "A256KW",
          "kid": "f3ce1a43-162f-43b2-80b4-b51abbeea46e"
        },
        "encrypted_key":
          "HM00migkUSdZjvqmq4b7ixiXnfeLieA7QX2ew6OF4oPUA3HovaMnOw"
      }
    ],
    "iv": "S-bNe9DayHcXWhBH",
    "ciphertext": "bcZnPyreRmcLCngVbMHJTNeIIxkSJno",
    "tag": "R2xDL9AJo7IhZ7y_sebgJw"
  }
};

data.docWithAttributes = {
  "id": "hasAttributes1",
  "sequence": 0,
  "indexed": [
    {
      "hmac": {
        "id": "13a91b49-3bd6-4e7a-aacd-4a1e0468bb2e",
        "algorithm": "HS256"
      },
      "sequence": 0,
      "attributes": [
        {
          "name": "CUQaxPtSLtd8L3WBAIkJ4DiVJeqoF6bdnhR7lSaPloY",
          "value": "QV58Va4904K-18_L5g_vfARXRWEB00knFSGPpukUBro"
        }
      ]
    }
  ],
  "jwe": {
    "protected": "eyJlbmMiOiJDMjBQIn0",
    "recipients": [
      {
        "header": {
          "alg": "A256KW",
          "kid": "f3ce1a43-162f-43b2-80b4-b51abbeea46e"
        },
        "encrypted_key":
          "OR1vdCNvf_B68mfUxFQVT-vyXVrBembuiM40mAAjDC1-Qu5iArDbug"
      }
    ],
    "iv": "i8Nins2vTI3PlrYW",
    "ciphertext": "Cb-963UCXblINT8F6MDHzMJN9EAhK3I",
    "tag": "pfZO0JulJcrc3trOZy8rjA"
  }
};

/*
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
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

data.masterKey = {
  unprotected: {
    alg: 'PBES2-HS512+A256KW',
    p2c: 4096,
    p2s: 'd7l6Ub5T0eZlpWjhSGI3Q19DtcogEkHg1hN8JzORj4U'
  },
  encrypted_key:
    'HrLOox-iCFlwCsQIWAWJ7UCuzjt2jdzOv92rEFNYymNX0XiIE_k8U-' +
    'z_Y3kCc_xqQ_wob904Q3XJxwzsO6xla7plr54MVh0N'
};

data.encryptedDocument = {
  id: 'lcm5RDZGuDmxlFZSc0k468LcfiY0viSxm7UIBFPKKVk',
  attributes: [],
  jwe: {
    unprotected: {
      alg: 'A256KW',
      enc: 'A256GCM'
    },
    encrypted_key: 'BZHh3ExmG56fJtGbb3L_tfJe9WNQHaDK1XmmO807pjoFuuDktdqfUQ',
    iv: 'PcpoGFRyHYBuPIu1',
    ciphertext: 'RR1VJiV16uxzjbyaprspvAuuso2J2AnB8GgbQvu07D56IA',
    tag: 'SHj-mrvbuLWLLTWW8EQ_8w'
  }
};

data.encryptedDocument2 = {
  id: 'lcm5RDZGuDmxlFZSc0k468LcfiY0viSxm7UIBFPKKVj',
  attributes: [],
  jwe: {
    unprotected: {
      alg: 'A256KW',
      enc: 'A256GCM'
    },
    encrypted_key: 'BZHh3ExmG56fJtGbb3L_tfJe9WNQHaDK1XmmO807pjoFuuDktdqfUQ',
    iv: 'PcpoGFRyHYBuPIu1',
    ciphertext: 'RR1VJiV16uxzjbyaprspvAuuso2J2AnB8GgbQvu07D56IA',
    tag: 'SHj-mrvbuLWLLTWW8EQ_8w'
  }
};

data.encryptedDocumentWithAttribute = {
  id: 'SAvbGbH82THrB4ZbJkPpg0hgAyqQ18OwVJ3PU7yy_pA',
  attributes: [{
    name: 'R-s3X4fp3zyXa_xUqoefYLl22xTpnEUa-vGps0SRZqc',
    value: 'telhiiyV0Cnf5tVeZQ7gQS4h6Lr60hBg1yx1DTT5ir4'
  }],
  jwe: {
    unprotected: {
      alg: 'A256KW',
      enc: 'A256GCM'
    },
    encrypted_key: '30Pri80iyLFvDNvhVbOAgxvYVRyRygc5VAiIFEcSiZ5EaavpuQzU6g',
    iv: '5IoIPcoZfWBOnguz',
    ciphertext: 'KHuPT57SzalurZ2X5Mq0n5G21NuygCsqQtIgCC8hTqdKRkKjjgLE6O9KtpJW',
    tag: 'BxzhA3kMExvNLI14rStPWQ'
  }
};

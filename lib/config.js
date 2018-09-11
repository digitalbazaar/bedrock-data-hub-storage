/*
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const bedrock = require('bedrock');
const {config} = bedrock;
const c = bedrock.util.config.main;
const cc = c.computer();
const path = require('path');
require('bedrock-permission');
require('bedrock-validation');

const namespace = 'private-remote-storage';
const cfg = config[namespace] = {};

const basePath = '/private-storage/:accountId';

cfg.routes = {
  basePath
};
const root = `${namespace}.routes.basePath`;
cc(`${namespace}.routes.documents`, `\$\{${root}\}/documents`);
cc(`${namespace}.routes.masterKey`, `\$\{${root}\}/master-key`);
cc(`${namespace}.routes.query`, `\$\{${root}\}/query`);

// permissions
const permissions = config.permission.permissions;
permissions.PRIVATE_REMOTE_STORAGE_ACCESS = {
  id: 'PRIVATE_REMOTE_STORAGE_ACCESS',
  label: 'Access Private Remote Storage',
  comment: 'Required to access private remote storage.'
};
permissions.PRIVATE_REMOTE_STORAGE_UPDATE = {
  id: 'PRIVATE_REMOTE_STORAGE_UPDATE',
  label: 'Update data',
  comment: 'Required to update data in private remote storage.'
};
permissions.PRIVATE_REMOTE_STORAGE_REMOVE = {
  id: 'PRIVATE_REMOTE_STORAGE_REMOVE',
  label: 'Remove data',
  comment: 'Required to remove data from private remote storage.'
};

// common validation schemas
config.validation.schema.paths.push(
  path.join(__dirname, '..', 'schemas'));

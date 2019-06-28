/*
 * Copyright (c) 2018-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const bedrock = require('bedrock');
const {config} = bedrock;
const path = require('path');
require('bedrock-permission');
require('bedrock-validation');

const namespace = 'data-hub-storage';
config[namespace] = {};

// permissions
const permissions = config.permission.permissions;
permissions.DATA_HUB_CONFIG_ACCESS = {
  id: 'DATA_HUB_CONFIG_ACCESS',
  label: 'Access a Data Hub Configuration',
  comment: 'Required to access a data hub configuration.'
};
permissions.DATA_HUB_CONFIG_UPDATE = {
  id: 'DATA_HUB_CONFIG_UPDATE',
  label: 'Update a Data Hub Configuration',
  comment: 'Required to update a data hub configuration.'
};
permissions.DATA_HUB_CONFIG_REMOVE = {
  id: 'DATA_HUB_CONFIG_REMOVE',
  label: 'Remove a Data Hub Configuration',
  comment: 'Required to remove a data hub configuration.'
};

// common validation schemas
config.validation.schema.paths.push(
  path.join(__dirname, '..', 'schemas'));

/*!
 * Copyright (c) 2018-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {config} = require('bedrock');
const path = require('path');
require('bedrock-permission');
require('bedrock-data-hub-storage');

const {permissions, roles} = config.permission;

config.mocha.tests.push(path.join(__dirname, 'mocha'));

// mongodb config
config.mongodb.name = 'bedrock_data_hub_storage_test';
config.mongodb.host = 'localhost';
config.mongodb.port = 27017;
config.mongodb.local.collection = 'bedrock_data_hub_storage_test';
// drop all collections on initialization
config.mongodb.dropCollections = {};
config.mongodb.dropCollections.onInit = true;
config.mongodb.dropCollections.collections = [];

roles['bedrock-account.regular'] = {
  id: 'bedrock-account.regular',
  label: 'Account Test Role',
  comment: 'Role for Test User',
  sysPermission: [
    permissions.ACCOUNT_ACCESS.id,
    permissions.ACCOUNT_UPDATE.id,
    permissions.ACCOUNT_INSERT.id,
    permissions.DATA_HUB_CONFIG_ACCESS.id,
    permissions.DATA_HUB_CONFIG_UPDATE.id,
    permissions.DATA_HUB_CONFIG_REMOVE.id,
    permissions.DATA_HUB_STORAGE_ACCESS.id,
    permissions.DATA_HUB_DOCUMENT_ACCESS.id,
    permissions.DATA_HUB_DOCUMENT_UPDATE.id,
    permissions.DATA_HUB_DOCUMENT_REMOVE.id
  ]
};

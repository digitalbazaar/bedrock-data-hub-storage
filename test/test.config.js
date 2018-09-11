/*
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {config} = require('bedrock');
const path = require('path');
require('bedrock-permission');
require('bedrock-private-remote-storage');

const {permissions, roles} = config.permission;

config.mocha.tests.push(path.join(__dirname, 'mocha'));

// mongodb config
config.mongodb.name = 'bedrock_private_remote_storage_test';
config.mongodb.host = 'localhost';
config.mongodb.port = 27017;
config.mongodb.local.collection = 'bedrock_private_remote_storage_test';
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
    permissions.PRIVATE_REMOTE_STORAGE_ACCESS.id,
    permissions.PRIVATE_REMOTE_STORAGE_UPDATE.id,
    permissions.PRIVATE_REMOTE_STORAGE_REMOVE.id
  ]
};

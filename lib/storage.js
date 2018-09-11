/*
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

require('bedrock-account');
const assert = require('assert-plus');
const bedrock = require('bedrock');
const {callbackify: brCallbackify} = bedrock.util;
const database = require('bedrock-mongodb');
const brPermission = require('bedrock-permission');
const {promisify} = require('util');
const brPermissionCheck = promisify(brPermission.checkPermission);
const {BedrockError} = bedrock.util;

// load config defaults
require('./config');

// module API
const api = {};
module.exports = api;

const PERMISSIONS = bedrock.config.permission.permissions;

bedrock.events.on('bedrock-mongodb.ready', async () => {
  await promisify(database.openCollections)(
    ['privateRemoteStorage', 'privateRemoteStorageKey']);

  await promisify(database.createIndexes)([{
    // cover queries by ID
    collection: 'privateRemoteStorage',
    fields: {accountId: 1, id: 1},
    options: {unique: true, background: false}
  }, {
    // cover attribute queries
    collection: 'privateRemoteStorage',
    fields: {accountId: 1, 'doc.attributes.name': 1, 'doc.attributes.value': 1},
    options: {
      partialFilterExpression: {
        'doc.attributes': {$exists: true}
      },
      unique: false,
      background: false
    }
  }, {
    // make master keys unique per account and cover queries
    collection: 'privateRemoteStorageKey',
    fields: {accountId: 1},
    options: {unique: true, background: false}
  }]);
});

/**
 * Inserts a new wrapped (password-encrypted) master key into the private
 * remote storage for the given account. Each account can only have one key.
 *
 * @param actor the actor or capabilities for performing the action.
 * @param accountId the ID of the account to store the document for.
 * @param key the wrapped master key as a JWE.
 *
 * @return a Promise that resolves to the database record.
 */
api.insertKey = brCallbackify(async ({actor, accountId, key}) => {
  assert.string(accountId, 'accountId');
  assert.object(key, 'key');

  // check permission against account ID
  await brPermissionCheck(
    actor, PERMISSIONS.PRIVATE_REMOTE_STORAGE_UPDATE,
    {resource: [accountId]});

  // insert the master key and get the updated record
  const now = Date.now();
  const meta = {created: now, updated: now};
  const record = {
    accountId: database.hash(accountId),
    meta,
    key
  };
  try {
    const result = await database.collections.privateRemoteStorageKey.insert(
      record, database.writeOptions);
    return result.ops[0];
  } catch(e) {
    if(!database.isDuplicateError(e)) {
      throw e;
    }
    throw new BedrockError(
      'Duplicate master key.',
      'DuplicateError', {
        public: true,
        httpStatusCode: 409
      }, e);
  }
});

/**
 * Gets a wrapped, password-encrypted, master key.
 *
 * @param actor the actor or capabilities for performing the action.
 * @param accountId the ID of the account that owns the master key.
 *
 * @return a Promise that resolves to `{key, meta}`.
 */
api.getKey = brCallbackify(async ({actor, accountId}) => {
  assert.string(accountId, 'accountId');

  // check permission against account ID only
  await brPermissionCheck(
    actor, PERMISSIONS.PRIVATE_REMOTE_STORAGE_ACCESS,
    {resource: [accountId]});

  const record = await database.collections.privateRemoteStorageKey.findOne(
    {accountId: database.hash(accountId)},
    {_id: 0, doc: 1, meta: 1});
  if(!record) {
    throw new BedrockError(
      'Master key not found.',
      'NotFoundError',
      {accountId, httpStatusCode: 404, public: true});
  }

  return record;
});

/**
 * Inserts an EncryptedDocument.
 *
 * @param actor the actor or capabilities for performing the action.
 * @param accountId the ID of the account to store the document for.
 * @param doc the EncryptedDocument to insert.
 *
 * @return a Promise that resolves to the database record.
 */
api.insert = brCallbackify(async ({actor, accountId, doc}) => {
  assert.string(accountId, 'accountId');
  assert.object(doc, 'doc');
  assert.string(doc.id, 'doc.id');
  assert.object(doc.jwe, 'doc.jwe');
  assert.optionalArray(doc.attributes, 'doc.attributes');

  // check permission against account ID only, doc ID is not global
  await brPermissionCheck(
    actor, PERMISSIONS.PRIVATE_REMOTE_STORAGE_UPDATE,
    {resource: [accountId]});

  // insert the doc and get the updated record
  const now = Date.now();
  const meta = {created: now, updated: now};
  const record = {
    accountId: database.hash(accountId),
    id: database.hash(doc.id),
    meta,
    doc
  };
  try {
    const result = await database.collections.privateRemoteStorage.insert(
      record, database.writeOptions);
    return result.ops[0];
  } catch(e) {
    if(!database.isDuplicateError(e)) {
      throw e;
    }
    throw new BedrockError(
      'Duplicate encrypted document.',
      'DuplicateError', {
        public: true,
        httpStatusCode: 409
      }, e);
  }
});

/**
 * Gets an EncryptedDocument.
 *
 * @param actor the actor or capabilities for performing the action.
 * @param accountId the ID of the account that owns the document.
 * @param id the ID of the document to retrieve.
 *
 * @return a Promise that resolves to `{doc, meta}`.
 */
api.get = brCallbackify(async ({actor, accountId, id}) => {
  assert.string(accountId, 'accountId');
  assert.string(id, 'id');

  // check permission against account ID only, doc ID is not global
  await brPermissionCheck(
    actor, PERMISSIONS.PRIVATE_REMOTE_STORAGE_ACCESS,
    {resource: [accountId]});

  const record = await database.collections.privateRemoteStorage.findOne(
    {accountId: database.hash(accountId), id: database.hash(id)},
    {_id: 0, doc: 1, meta: 1});
  if(!record) {
    throw new BedrockError(
      'Encrypted document not found.',
      'NotFoundError',
      {accountId, id, httpStatusCode: 404, public: true});
  }

  return record;
});

/**
 * Retrieves all EncryptedDocuments matching the given query.
 *
 * @param actor the actor or capabilities for performing the action.
 * @param accountId the ID of the account that owns the storage.
 * @param [query] the optional query to use (default: {}).
 * @param [fields] optional fields to include or exclude (default: {}).
 * @param [options] options (eg: 'sort', 'limit').
 *
 * @return a Promise that resolves to the records that matched the query.
 */
api.find = brCallbackify(async (
  {actor, accountId, query = {}, fields = {}, options = {}}) => {
  // check permission against account ID only, doc ID is not global
  await brPermissionCheck(
    actor, PERMISSIONS.PRIVATE_REMOTE_STORAGE_ACCESS,
    {resource: [accountId]});

  // force account ID
  query.accountId = database.hash(accountId);

  return database.collections.privateRemoteStorage.find(
    query, fields, options).toArray();
});

/**
 * Updates (replaces) an EncryptedDocument. If the document does not exist,
 * it will be inserted. See `insert`.
 *
 * @param actor the actor or capabilities to perform the action.
 * @param accountId the ID of the account that owns the document.
 * @param doc the EncryptedDocument to store.
 *
 * @return a Promise that resolves once the operation completes.
 */
api.update = brCallbackify(async ({actor, accountId, doc}) => {
  assert.string(accountId, 'accountId');
  assert.object(doc, 'doc');
  assert.string(doc.id, 'doc.id');
  assert.object(doc.jwe, 'doc.jwe');
  assert.optionalArray(doc.attributes, 'doc.attributes');

  // check permission against account ID only, doc ID is not global
  await brPermissionCheck(
    actor, PERMISSIONS.PRIVATE_REMOTE_STORAGE_UPDATE,
    {resource: [accountId]});

  const now = Date.now();
  const meta = {created: now, updated: now};
  const record = {
    accountId: database.hash(accountId),
    id: database.hash(doc.id),
    meta,
    doc
  };

  await database.collections.privateRemoteStorage.update({
    accountId: record.accountId,
    id: record.id
  }, {
    $set: {doc, 'meta.updated': now},
    $setOnInsert: {
      accountId: record.accountId, id: record.id, 'meta.created': now
    }
  }, Object.assign({}, database.writeOptions, {upsert: true}));
});

/**
 * Removes an EncryptedDocument.
 *
 * @param actor the actor or capabilities for performing the action.
 * @param accountId the ID of the account that owns the document.
 * @param id the ID of the document to remove.
 *
 * @return a Promise that resolves to `true` if a document was removed and
 *         `false` if not.
 */
api.remove = brCallbackify(async ({actor, accountId, id}) => {
  assert.string(accountId, 'accountId');
  assert.string(id, 'id');

  // check permission against account ID only, doc ID is not global
  await brPermissionCheck(
    actor, PERMISSIONS.PRIVATE_REMOTE_STORAGE_REMOVE,
    {resource: [accountId]});

  const result = await database.collections.privateRemoteStorage.remove(
    {accountId: database.hash(accountId), id: database.hash(id)});
  return result.result.n !== 0;
});

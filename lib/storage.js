/*!
 * Copyright (c) 2018-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

require('bedrock-account');
const assert = require('assert-plus');
const bedrock = require('bedrock');
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
  await promisify(database.openCollections)(['dataHubConfig', 'dataHubDoc']);

  await promisify(database.createIndexes)([{
    // cover queries by ID
    collection: 'dataHubConfig',
    fields: {id: 1},
    options: {unique: true, background: false}
  }, {
    // cover queries by controller
    collection: 'dataHubConfig',
    fields: {controller: 1},
    options: {unique: false, background: false}
  }, {
    // ensure only one primary data hub per controller
    collection: 'dataHubConfig',
    fields: {controller: 1, 'config.primary': 1},
    options: {
      partialFilterExpression: {
        'config.primary': true
      },
      unique: true,
      background: false
    }
  }, {
    // cover queries by data hub ID + document ID
    collection: 'dataHubDoc',
    fields: {dataHubId: 1, id: 1},
    options: {unique: true, background: false}
  }, {
    // cover attribute-based queries
    collection: 'dataHubDoc',
    fields: {
      dataHubId: 1,
      'doc.indexed.hmac.id': 1,
      'doc.indexed.attributes.name': 1,
      'doc.indexed.attributes.value': 1
    },
    options: {
      name: 'dataHubDoc.attributes',
      partialFilterExpression: {
        // FIXME: can/should this be consolidated?
        'doc.indexed': {$exists: true},
        'doc.indexed.hmac.id': {$exists: true},
        'doc.indexed.attributes.name': {$exists: true}
      },
      unique: false,
      background: false
    },
    // // cover unique attribute-based queries
    // collection: 'dataHubDoc',
    // fields: {
    //   dataHubId: 1,
    //   'doc.indexed.hmac.id': 1,
    //   'doc.indexed.attributes.name': 1,
    //   'doc.indexed.attributes.value': 1,
    // },
    // options: {
    //   name: 'dataHubDoc.attributes.unique',
    //   partialFilterExpression: {
    //     // FIXME: can/should this be consolidated?
    //     'doc.indexed': {$exists: true},
    //     'doc.indexed.hmac.id': {$exists: true},
    //     'doc.indexed.attributes.name': {$exists: true},
    //     'doc.indexed.attributes.unique': true
    //   },
    //   unique: true,
    //   background: false
    // }
  }]);
});

/**
 * Establishes a new data hub by inserting its configuration into storage.
 *
 * @param {Object} actor the actor or capabilities for performing the action.
 * @param {Object} config the data hub configuration.
 *
 * @return {Promise<Object>} resolves to the database record.
 */
api.insertConfig = async ({actor, config}) => {
  assert.object(config, 'key');
  assert.string(config.controller, 'config.controller');
  // TODO: enable optional primary `kek` and `hmac` in the future
  assert.object(config.kek, 'config.kek');
  assert.object(config.hmac, 'config.hmac');
  if(config.kek) {
    assert.string(config.kek.id, 'config.kek.id');
    assert.string(config.kek.algorithm, 'config.kek.algorithm');
  }
  if(config.hmac) {
    assert.string(config.hmac.id, 'config.hmac.id');
    assert.string(config.hmac.algorithm, 'config.hmac.algorithm');
  }

  // check permission against controller ID
  const {controller} = config;
  await brPermissionCheck(
    actor, PERMISSIONS.DATA_HUB_CONFIG_UPDATE,
    {resource: [controller]});

  // insert the configuration and get the updated record
  const now = Date.now();
  const meta = {created: now, updated: now};
  const record = {
    id: database.hash(config.id),
    controller: database.hash(controller),
    meta,
    config
  };
  try {
    const result = await database.collections.dataHubConfig.insert(
      record, database.writeOptions);
    return result.ops[0];
  } catch(e) {
    if(!database.isDuplicateError(e)) {
      throw e;
    }
    throw new BedrockError(
      'Duplicate data hub configuration.',
      'DuplicateError', {
        public: true,
        httpStatusCode: 409
      }, e);
  }
};

/**
 * Retrieves all data hub configs matching the given query.
 *
 * @param {Object} actor the actor or capabilities for performing the action.
 * @param {String} controller the controller for the data hubs to retrieve.
 * @param {Object} query the optional query to use (default: {}).
 * @param {Object} fields optional fields to include or exclude (default: {}).
 * @param {Object} options options (eg: 'sort', 'limit').
 *
 * @return {Promise<Array>} resolves to the records that matched the query.
 */
api.findConfig = async (
  {actor, controller, query = {}, fields = {}, options = {}}) => {
  // check permission against any data hub matching the controller
  await brPermissionCheck(
    actor, PERMISSIONS.DATA_HUB_CONFIG_ACCESS,
    {resource: [controller]});

  // force controller ID
  query.controller = database.hash(controller);
  return database.collections.dataHubConfig.find(
    query, fields, options).toArray();
};

// TODO: implement `updateConfig`

/**
 * Gets a data hub configuration.
 *
 * @param {Object} actor the actor or capabilities for performing the action.
 * @param {String} id the ID of the data hub.
 *
 * @return {Promise<Object>} resolves to `{config, meta}`.
 */
api.getConfig = async ({actor, id}) => {
  assert.string(id, 'id');

  const record = await database.collections.dataHubConfig.findOne(
    {id: database.hash(id)},
    {_id: 0, config: 1, meta: 1});
  if(!record) {
    throw new BedrockError(
      'Data hub configuration not found.',
      'NotFoundError',
      {dataHub: id, httpStatusCode: 404, public: true});
  }

  // check permission against data hub directly or its controller
  await brPermissionCheck(
    actor, PERMISSIONS.DATA_HUB_CONFIG_ACCESS,
    {resource: [record.config.id, record.config.controller]});

  return record;
};

/**
 * Inserts a data hub document.
 *
 * @param {Object} actor the actor or capabilities for performing the action.
 * @param {dataHubId} id the ID of the data hub to store the document in.
 * @param {Object} doc the document to insert.
 *
 * @return {Promise<Object>} resolves to the database record.
 */
api.insert = async ({actor, dataHubId, doc}) => {
  assert.string(dataHubId, 'dataHubId');
  assert.object(doc, 'doc');
  assert.string(doc.id, 'doc.id');
  assert.number(doc.sequence, 'doc.sequence');
  assert.object(doc.jwe, 'doc.jwe');
  assert.optionalArray(doc.indexed, 'doc.indexed');

  // Note: `doc.sequence === 0` is intentionally not enforced at this time
  // to allow for easier copying of documents from other data hubs, this
  // may change in the future
  if(doc.sequence < 0) {
    throw new TypeError('"doc.sequence" must be a non-negative integer.');
  }

  // actor must have capability to access data hub storage AND the capability
  // to update the document (or update any document in the data hub)
  const {id} = doc;
  await _checkRequiredDocumentCapabilities(
    {actor, dataHubId, permission: PERMISSIONS.DATA_HUB_DOCUMENT_UPDATE, id});

  // insert the doc and get the updated record
  const now = Date.now();
  const meta = {created: now, updated: now};
  const record = {
    dataHubId: database.hash(dataHubId),
    id: database.hash(doc.id),
    meta,
    doc
  };
  try {
    const result = await database.collections.dataHubDoc.insert(
      record, database.writeOptions);
    return result.ops[0];
  } catch(e) {
    if(!database.isDuplicateError(e)) {
      throw e;
    }
    throw new BedrockError(
      'Duplicate data hub document.',
      'DuplicateError', {
        public: true,
        httpStatusCode: 409
      }, e);
  }
};

/**
 * Gets a data hub document.
 *
 * @param {Object} actor the actor or capabilities for performing the action.
 * @param {String} dataHubId the ID of the data hub that the document is in.
 * @param {String} id the ID of the document to retrieve.
 *
 * @return {Promise<Object>} resolves to `{doc, meta}`.
 */
api.get = async ({actor, dataHubId, id}) => {
  assert.string(dataHubId, 'dataHubId');
  assert.string(id, 'id');

  // actor must have capability to access data hub storage AND the capability
  // to access the document (or access any document in the data hub)
  await _checkRequiredDocumentCapabilities(
    {actor, dataHubId, permission: PERMISSIONS.DATA_HUB_DOCUMENT_UPDATE, id});

  const record = await database.collections.dataHubDoc.findOne(
    {dataHubId: database.hash(dataHubId), id: database.hash(id)},
    {_id: 0, doc: 1, meta: 1});
  if(!record) {
    throw new BedrockError(
      'Data hub document not found.',
      'NotFoundError',
      {dataHub: dataHubId, doc: id, httpStatusCode: 404, public: true});
  }

  return record;
};

/**
 * Retrieves all data hub documents matching the given query.
 *
 * @param {Object} actor the actor or capabilities for performing the action.
 * @param {String} dataHubId the ID of the data hub to query.
 * @param {Object} query the optional query to use (default: {}).
 * @param {Object} fields optional fields to include or exclude (default: {}).
 * @param {Object} options options (eg: 'sort', 'limit').
 *
 * @return {Promise<Array>} resolves to the records that matched the query.
 */
api.find = async (
  {actor, dataHubId, query = {}, fields = {}, options = {}}) => {
  // actor must have capability to access data hub storage AND the capability
  // to access any document in the data hub
  await _checkRequiredDocumentCapabilities(
    {actor, dataHubId, permission: PERMISSIONS.DATA_HUB_DOCUMENT_ACCESS});

  // force data hub ID
  query.dataHubId = database.hash(dataHubId);

  return database.collections.dataHubDoc.find(
    query, fields, options).toArray();
};

/**
 * Updates (replaces) a data hub document. If the document does not exist,
 * it will be inserted. See `insert`.
 *
 * @param {Object} actor the actor or capabilities for performing the action.
 * @param {String} dataHubId the ID of the data hub the document is in.
 * @param {Object} doc the document to store.
 *
 * @return {Promise} resolves once the operation completes.
 */
api.update = async ({actor, dataHubId, doc}) => {
  assert.string(dataHubId, 'dataHubId');
  assert.object(doc, 'doc');
  assert.string(doc.id, 'doc.id');
  assert.number(doc.sequence, 'doc.sequence');
  assert.object(doc.jwe, 'doc.jwe');
  assert.optionalArray(doc.indexed, 'doc.indexed');

  if(doc.sequence < 0) {
    throw new TypeError('"doc.sequence" must be a non-negative integer.');
  }

  // actor must have capability to access data hub storage AND the capability
  // to update the document (or update any document in the data hub)
  const {id} = doc;
  await _checkRequiredDocumentCapabilities(
    {actor, dataHubId, permission: PERMISSIONS.DATA_HUB_DOCUMENT_UPDATE, id});

  const now = Date.now();
  const meta = {created: now, updated: now};
  const record = {
    dataHubId: database.hash(dataHubId),
    id: database.hash(id),
    meta,
    doc
  };

  const result = await database.collections.dataHubDoc.update({
    dataHubId: record.dataHubId,
    id: record.id,
    'doc.sequence': doc.sequence - 1
  }, {
    $set: {doc, 'meta.updated': now},
    $setOnInsert: {
      dataHubId: record.dataHubId, id: record.id, 'meta.created': now
    }
  }, {...database.writeOptions, upsert: true});

  if(result.result.n > 0) {
    // document upserted or modified: success
    return true;
  }

  throw new BedrockError(
    'Could not update document. Sequence does not match.',
    'InvalidStateError', {
      httpStatusCode: 409,
      public: true,
      expected: doc.sequence
    });
};

/**
 * Removes a data hub document.
 *
 * @param {Object} actor the actor or capabilities for performing the action.
 * @param {String} dataHubId the ID of the data hub the document is in.
 * @param {String} id the ID of the document to remove.
 *
 * @return {Promise<Boolean>} resolves to `true` if a document was removed and
 *   `false` if not.
 */
api.remove = async ({actor, dataHubId, id}) => {
  assert.string(dataHubId, 'dataHubId');
  assert.string(id, 'id');

  // actor must have capability to access data hub storage AND the capability
  // to remove the document (or remove any document in the data hub)
  await _checkRequiredDocumentCapabilities(
    {actor, dataHubId, permission: PERMISSIONS.DATA_HUB_DOCUMENT_REMOVE, id});

  const result = await database.collections.dataHubDoc.remove(
    {dataHubId: database.hash(dataHubId), id: database.hash(id)});
  return result.result.n !== 0;
};

/**
 * Checks for the required document and data hub storage capabilities.
 *
 * A note about permissions/capabilities and data hubs:
 *
 * Since multiple data hubs may have a copy of a document with the same ID, a
 * capability that allows an actor to access/update/remove a document with that
 * ID is insufficient on its own to access/modify a data hub's copy of that
 * document.
 *
 * In order for an actor to access/update/remove a document on a data hub, they
 * must possess BOTH the capability to access the particular data hub's storage
 * and whatever capability is required to access/update/remove the document
 * itself.
 *
 * The `controller` of a data hub should have the capability to access any of
 * their controlled data hubs and all capabilities to access/update/remove
 * any document in their controlled data hubs. To accomplish this without
 * assigning a capability for every single document in every controlled
 * data hub, an actor must simple have `DATA_HUB_STORAGE_ACCESS` for the
 * `controller` resource and `DATA_HUB_DOCUMENT_*` for the `controller`
 * resource.
 *
 * A non-controller (e.g. someone given access to some granular set of
 * documents in a given data hub) should have `DATA_HUB_STORAGE_ACCESS` for
 * the particular data hub and `DATA_HUB_DOCUMENT_*` for the particular
 * document.
 *
 * @param {Object} actor the actor or capabilities for performing the action.
 * @param {Object} permission the required data hub document permission.
 * @param {String|null} id the document ID to check (null for all documents).
 *
 * @return {Promise<Object>} resolves to the data hub config.
 */
async function _checkRequiredDocumentCapabilities(
  {actor, dataHubId, permission, id = null}) {
  // actor must have capability to access data hub storage AND the capability
  // to update the document (or update any document in the data hub)
  let controller;
  try {
    const {config} = await api.getConfig({actor: null, id: dataHubId});
    controller = config.controller;
  } catch(e) {
    if(e.name === 'NotFoundError') {
      throw new BedrockError(
        'Permission to interact with the given resource(s) has been denied.',
        'PermissionDenied', {
          sysPermission: PERMISSIONS.DATA_HUB_STORAGE_ACCESS.id,
          public: true,
          httpStatusCode: 403
        });
    }
    throw e;
  }
  const resource = [dataHubId, controller];
  await brPermissionCheck(
    actor, PERMISSIONS.DATA_HUB_STORAGE_ACCESS, {resource});
  if(id !== null) {
    // allow access if capability exists for the given document ID
    resource.push(id);
  }
  await brPermissionCheck(actor, permission, {resource});
}

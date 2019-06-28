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
  await promisify(database.openCollections)(
    ['dataHubConfig', 'dataHubDoc', 'dataHubCapability']);

  await promisify(database.createIndexes)([{
    // cover queries config by ID
    collection: 'dataHubConfig',
    fields: {id: 1},
    options: {unique: true, background: false}
  }, {
    // cover config queries by controller
    collection: 'dataHubConfig',
    fields: {controller: 1},
    options: {unique: false, background: false}
  }, {
    // ensure config uniqueness of reference ID per controller
    collection: 'dataHubConfig',
    fields: {controller: 1, 'config.referenceId': 1},
    options: {
      partialFilterExpression: {
        'config.referenceId': true
      },
      unique: true,
      background: false
    }
  }, {
    // cover document queries by data hub ID + document ID
    collection: 'dataHubDoc',
    fields: {dataHubId: 1, id: 1},
    options: {unique: true, background: false}
  }, {
    // cover document attribute-based queries
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
    // ensure document unique attributes are enforced
    collection: 'dataHubDoc',
    fields: {
      dataHubId: 1,
      uniqueAttributes: 1
    },
    options: {
      name: 'dataHubDoc.attributes.unique',
      partialFilterExpression: {
        uniqueAttributes: {$exists: true}
      },
      unique: true,
      background: false
    }
  }, {
    // cover capability queries by ID
    collection: 'dataHubCapability',
    fields: {id: 1},
    options: {unique: true, background: false}
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
  assert.object(config, 'config');
  assert.string(config.id, 'config.id');
  assert.string(config.controller, 'config.controller');
  // TODO: enable optional primary `kek` and `hmac` in the future
  assert.object(config.kek, 'config.kek');
  assert.object(config.hmac, 'config.hmac');
  if(config.kek) {
    assert.string(config.kek.id, 'config.kek.id');
    assert.string(config.kek.type, 'config.kek.type');
  }
  if(config.hmac) {
    assert.string(config.hmac.id, 'config.hmac.id');
    assert.string(config.hmac.type, 'config.hmac.type');
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
 * @param {string} controller the controller for the data hubs to retrieve.
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
 * @param {string} id the ID of the data hub.
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
 * @param {string} id the ID of the data hub to store the document in.
 * @param {Object} doc the document to insert.
 *
 * @return {Promise<Object>} resolves to the database record.
 */
api.insert = async ({dataHubId, doc}) => {
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

  // insert the doc and get the updated record
  const now = Date.now();
  const meta = {created: now, updated: now};
  const record = {
    dataHubId: database.hash(dataHubId),
    id: database.hash(doc.id),
    meta,
    doc
  };

  // build top-level unique index field
  const uniqueAttributes = _buildUniqueAttributesIndex(doc);
  if(uniqueAttributes.length > 0) {
    record.uniqueAttributes = uniqueAttributes;
  }

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
 * @param {string} dataHubId the ID of the data hub that the document is in.
 * @param {string} id the ID of the document to retrieve.
 *
 * @return {Promise<Object>} resolves to `{doc, meta}`.
 */
api.get = async ({dataHubId, id}) => {
  assert.string(dataHubId, 'dataHubId');
  assert.string(id, 'id');

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
 * @param {string} dataHubId the ID of the data hub to query.
 * @param {Object} query the optional query to use (default: {}).
 * @param {Object} fields optional fields to include or exclude (default: {}).
 * @param {Object} options options (eg: 'sort', 'limit').
 *
 * @return {Promise<Array>} resolves to the records that matched the query.
 */
api.find = async ({dataHubId, query = {}, fields = {}, options = {}}) => {
  // force data hub ID
  query.dataHubId = database.hash(dataHubId);
  return database.collections.dataHubDoc.find(query, fields, options).toArray();
};

/**
 * Updates (replaces) a data hub document. If the document does not exist,
 * it will be inserted. See `insert`.
 *
 * @param {string} dataHubId the ID of the data hub the document is in.
 * @param {Object} doc the document to store.
 *
 * @return {Promise} resolves once the operation completes.
 */
api.update = async ({dataHubId, doc}) => {
  assert.string(dataHubId, 'dataHubId');
  assert.object(doc, 'doc');
  assert.string(doc.id, 'doc.id');
  assert.number(doc.sequence, 'doc.sequence');
  assert.object(doc.jwe, 'doc.jwe');
  assert.optionalArray(doc.indexed, 'doc.indexed');

  if(doc.sequence < 0) {
    throw new TypeError('"doc.sequence" must be a non-negative integer.');
  }

  const {id} = doc;
  const now = Date.now();
  const meta = {created: now, updated: now};
  const record = {
    dataHubId: database.hash(dataHubId),
    id: database.hash(id),
    meta,
    doc
  };

  // build top-level unique index field
  const $set = {doc, 'meta.updated': now};
  const uniqueAttributes = _buildUniqueAttributesIndex(doc);
  if(uniqueAttributes.length > 0) {
    $set.uniqueAttributes = uniqueAttributes;
  }

  try {
    const result = await database.collections.dataHubDoc.update({
      dataHubId: record.dataHubId,
      id: record.id,
      'doc.sequence': doc.sequence - 1
    }, {
      $set,
      $setOnInsert: {
        dataHubId: record.dataHubId, id: record.id, 'meta.created': now
      }
    }, {...database.writeOptions, upsert: true});

    if(result.result.n > 0) {
      // document upserted or modified: success
      return true;
    }
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
 * @param {string} dataHubId the ID of the data hub the document is in.
 * @param {string} id the ID of the document to remove.
 *
 * @return {Promise<Boolean>} resolves to `true` if a document was removed and
 *   `false` if not.
 */
api.remove = async ({dataHubId, id}) => {
  assert.string(dataHubId, 'dataHubId');
  assert.string(id, 'id');

  const result = await database.collections.dataHubDoc.remove(
    {dataHubId: database.hash(dataHubId), id: database.hash(id)});
  return result.result.n !== 0;
};

function _buildUniqueAttributesIndex(doc) {
  const uniqueAttributes = [];

  // build top-level unique index field
  if(doc.indexed) {
    for(const entry of doc.indexed) {
      const hmacIdHash = database.hash(entry.hmac.id);
      const attributes = entry.attributes || [];
      for(const attribute of attributes) {
        if(attribute.unique) {
          // concat hash of hmac ID, name, and value for unique indexing
          uniqueAttributes.push(
            `${hmacIdHash}:${attribute.name}:${attribute.value}`);
        }
      }
    }
  }

  return uniqueAttributes;
}

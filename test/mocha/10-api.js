/*!
 * Copyright (c) 2018-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const brDataHubStorage = require('bedrock-data-hub-storage');
const database = require('bedrock-mongodb');
const helpers = require('./helpers');
const mockData = require('./mock.data');
let actors;
let accounts;
let dataHubId;

describe.only('bedrock-data-hub-storage', () => {
  before(async () => {
    await helpers.prepareDatabase(mockData);
    actors = await helpers.getActors(mockData);
    accounts = mockData.accounts;
  });

  describe('insertConfig', () => {
    it('should insert a data hub config', async () => {
      const actor = actors['alpha@example.com'];
      const account = accounts['alpha@example.com'].account;
      const config = {...mockData.config, controller: account.id};
      let record = await brDataHubStorage.insertConfig({actor, config});
      should.exist(record);
      record.controller.should.equal(database.hash(account.id));
      record.id.should.equal(database.hash(record.config.id));
      dataHubId = record.config.id;
      record.config.should.deep.equal(config);
      record = await database.collections.dataHubConfig.findOne({
        id: database.hash(config.id)
      });
      record.controller.should.equal(database.hash(account.id));
      record.config.should.deep.equal(config);
    });
    it('should fail for another data hub', async () => {
      const actor = actors['alpha@example.com'];
      let err;
      let record;
      try {
        const config = {
          ...mockData.config,
          controller: 'urn:uuid:something-else'
        };
        record = await brDataHubStorage.insertConfig({actor, config});
      } catch(e) {
        err = e;
      }
      should.exist(err);
      should.not.exist(record);
      err.name.should.equal('PermissionDenied');
    });
  }); // end `insertConfig`

  describe('insert', () => {
    it('should insert a document', async () => {
      const actor = actors['alpha@example.com'];
      let record = await brDataHubStorage.insert({
        actor,
        dataHubId,
        doc: mockData.doc1
      });
      should.exist(record);
      record.dataHubId.should.equal(database.hash(dataHubId));
      record.id.should.equal(database.hash(mockData.doc1.id));
      record.doc.should.deep.equal(mockData.doc1);
      record = await database.collections.dataHubDoc.findOne({
        dataHubId: database.hash(dataHubId),
        id: database.hash(mockData.doc1.id)
      });
      record.dataHubId.should.equal(database.hash(dataHubId));
      record.id.should.equal(database.hash(mockData.doc1.id));
      record.doc.should.deep.equal(mockData.doc1);
    });
    it('should insert a document with an attribute', async () => {
      const actor = actors['alpha@example.com'];
      let record = await brDataHubStorage.insert({
        actor,
        dataHubId,
        doc: mockData.docWithAttributes
      });
      should.exist(record);
      record.dataHubId.should.equal(database.hash(dataHubId));
      record.id.should.equal(database.hash(mockData.docWithAttributes.id));
      record.doc.should.deep.equal(mockData.docWithAttributes);
      record = await database.collections.dataHubDoc.findOne({
        dataHubId: database.hash(dataHubId),
        id: database.hash(mockData.docWithAttributes.id)
      });
      record.dataHubId.should.equal(database.hash(dataHubId));
      record.id.should.equal(database.hash(mockData.docWithAttributes.id));
      record.doc.should.deep.equal(mockData.docWithAttributes);
    });
    it('should return error on duplicate document', async () => {
      const actor = actors['alpha@example.com'];
      // attempt to insert the same document again
      let err;
      try {
        await brDataHubStorage.insert({
          actor,
          dataHubId,
          doc: mockData.doc1
        });
      } catch(e) {
        err = e;
      }
      should.exist(err);
      err.name.should.equal('DuplicateError');
    });
    it('should fail for another data hub', async () => {
      const actor = actors['alpha@example.com'];
      let err;
      let record;
      try {
        record = await brDataHubStorage.insert({
          actor,
          dataHubId: 'urn:uuid:something-else',
          doc: mockData.doc1
        });
      } catch(e) {
        err = e;
      }
      should.exist(err);
      should.not.exist(record);
      err.name.should.equal('PermissionDenied');
    });
  }); // end `insert`

  describe('update', () => {
    it('should upsert a document', async () => {
      const actor = actors['alpha@example.com'];
      await brDataHubStorage.update({actor, dataHubId, doc: mockData.doc2});
      const record = await database.collections.dataHubDoc.findOne({
        dataHubId: database.hash(dataHubId),
        id: database.hash(mockData.doc2.id)
      });
      should.exist(record);
      record.dataHubId.should.equal(database.hash(dataHubId));
      record.id.should.equal(database.hash(mockData.doc2.id));
      record.doc.should.deep.equal(mockData.doc2);
    });
    it('should update a document', async () => {
      const actor = actors['alpha@example.com'];
      const doc = {...mockData.doc1, sequence: 1};
      await brDataHubStorage.update({actor, dataHubId, doc});
      const record = await database.collections.dataHubDoc.findOne({
        dataHubId: database.hash(dataHubId),
        id: database.hash(mockData.doc1.id)
      });
      record.dataHubId.should.equal(database.hash(dataHubId));
      record.id.should.equal(database.hash(mockData.doc1.id));
      record.doc.should.deep.equal(doc);
    });
    it('should fail for another data hub', async () => {
      const actor = actors['alpha@example.com'];
      let err;
      let record;
      try {
        record = await brDataHubStorage.update({
          actor,
          dataHubId: 'urn:uuid:something-else',
          doc: mockData.doc1
        });
      } catch(e) {
        err = e;
      }
      should.exist(err);
      should.not.exist(record);
      err.name.should.equal('PermissionDenied');
    });
  }); // end `update`

  describe('get', () => {
    it('should get a document', async () => {
      const actor = actors['alpha@example.com'];
      const record = await brDataHubStorage.get({
        actor,
        dataHubId,
        id: mockData.doc1.id
      });
      should.exist(record);
      record.doc.should.deep.equal({...mockData.doc1, sequence: 1});
    });
    it('should fail for another data hub', async () => {
      const actor = actors['alpha@example.com'];
      let err;
      let record;
      try {
        record = await brDataHubStorage.get({
          actor,
          dataHubId: 'urn:uuid:something-else',
          id: mockData.doc1.id
        });
      } catch(e) {
        err = e;
      }
      should.exist(err);
      should.not.exist(record);
      err.name.should.equal('PermissionDenied');
    });
    it('should get not found error', async () => {
      const actor = actors['alpha@example.com'];
      let err;
      let record;
      try {
        record = await brDataHubStorage.get({
          actor,
          dataHubId,
          id: 'urn:does-not-exist'
        });
      } catch(e) {
        err = e;
      }
      should.exist(err);
      should.not.exist(record);
      err.name.should.equal('NotFoundError');
    });
  }); // end `get`

  describe('find', () => {
    it('should get a document by attribute', async () => {
      const actor = actors['alpha@example.com'];
      const entry = mockData.docWithAttributes.indexed[0];
      const [attribute] = entry.attributes;
      const records = await brDataHubStorage.find({
        actor,
        dataHubId,
        query: {
          'doc.indexed.hmac.id': entry.hmac.id,
          'doc.indexed.attributes.name': {
            $all: [attribute.name]
          }
        }
      });
      should.exist(records);
      records.length.should.equal(1);
      const [record] = records;
      record.dataHubId.should.equal(database.hash(dataHubId));
      record.doc.should.deep.equal(mockData.docWithAttributes);
    });
    it('should get a document by attribute and value', async () => {
      const actor = actors['alpha@example.com'];
      const entry = mockData.docWithAttributes.indexed[0];
      const [attribute] = entry.attributes;
      const records = await brDataHubStorage.find({
        actor,
        dataHubId,
        query: {
          'doc.indexed.hmac.id': entry.hmac.id,
          'doc.indexed.attributes': {
            $all: [{$elemMatch: attribute}]
          }
        }
      });
      should.exist(records);
      records.length.should.equal(1);
      const [record] = records;
      record.dataHubId.should.equal(database.hash(dataHubId));
      record.doc.should.deep.equal(mockData.docWithAttributes);
    });
    it('should find no results', async () => {
      const actor = actors['alpha@example.com'];
      const entry = mockData.docWithAttributes.indexed[0];
      const records = await brDataHubStorage.find({
        actor,
        dataHubId,
        query: {
          'doc.indexed.hmac.id': entry.hmac.id,
          'doc.indexed.attributes': {
            $all: [{$elemMatch: {name: 'foo', value: 'does-not-exist'}}]
          }
        }
      });
      should.exist(records);
      records.length.should.equal(0);
    });
    it('should fail for another data hub', async () => {
      const actor = actors['alpha@example.com'];
      const entry = mockData.docWithAttributes.indexed[0];
      let err;
      let records;
      try {
        records = await brDataHubStorage.find({
          actor,
          dataHubId: 'urn:uuid:something-else',
          query: {
            'doc.indexed.hmac.id': entry.hmac.id,
            'doc.indexed.attributes': {
              $all: [{$elemMatch: {name: 'foo', value: 'does-not-exist'}}]
            }
          }
        });
      } catch(e) {
        err = e;
      }
      should.exist(err);
      should.not.exist(records);
      err.name.should.equal('PermissionDenied');
    });
  }); // end `find`

  describe('remove', () => {
    it('should remove a document', async () => {
      const actor = actors['alpha@example.com'];
      const result = await brDataHubStorage.remove({
        actor,
        dataHubId,
        id: mockData.doc1.id
      });
      should.exist(result);
      result.should.equal(true);
      const record = await database.collections.dataHubDoc.findOne({
        dataHubId: database.hash(dataHubId),
        id: database.hash(mockData.doc1.id)
      });
      should.not.exist(record);
    });
    it('should return `false` for a missing document', async () => {
      const actor = actors['alpha@example.com'];
      const result = await brDataHubStorage.remove({
        actor,
        dataHubId,
        id: mockData.doc1.id
      });
      should.exist(result);
      result.should.equal(false);
      const record = await database.collections.dataHubDoc.findOne({
        dataHubId: database.hash(dataHubId),
        id: database.hash(mockData.doc1.id)
      });
      should.not.exist(record);
    });
    it('should fail for another account', async () => {
      const actor = actors['alpha@example.com'];
      let err;
      let records;
      try {
        records = await brDataHubStorage.remove({
          actor,
          dataHubId: 'urn:uuid:something-else',
          id: mockData.doc1.id
        });
      } catch(e) {
        err = e;
      }
      should.exist(err);
      should.not.exist(records);
      err.name.should.equal('PermissionDenied');
    });
  }); // end `remove`
}); // end bedrock-data-hub-storage

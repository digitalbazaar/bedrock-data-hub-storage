/*
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const brPrivateRemoteStorage = require('bedrock-private-remote-storage');
const database = require('bedrock-mongodb');
const helpers = require('./helpers');
const mockData = require('./mock.data');
let actors;
let accounts;

describe('bedrock-private-remote-storage', () => {
  before(async () => {
    await helpers.prepareDatabase(mockData);
    actors = await helpers.getActors(mockData);
    accounts = mockData.accounts;
  });

  describe('insertKey', () => {
    it('should insert a master key', async () => {
      const actor = actors['alpha@example.com'];
      const account = accounts['alpha@example.com'].account;
      let record = await brPrivateRemoteStorage.insertKey({
        actor,
        accountId: account.id,
        key: mockData.masterKey
      });
      should.exist(record);
      record.accountId.should.equal(database.hash(account.id));
      record.key.should.deep.equal(mockData.masterKey);
      record = await database.collections.privateRemoteStorageKey.findOne({
        accountId: database.hash(account.id)
      });
      record.accountId.should.equal(database.hash(account.id));
      record.key.should.deep.equal(mockData.masterKey);
    });
    it('should fail for another account', async () => {
      const actor = actors['alpha@example.com'];
      let err;
      let record;
      try {
        record = await brPrivateRemoteStorage.insertKey({
          actor,
          accountId: 'urn:uuid:something-else',
          key: mockData.masterKey
        });
      } catch(e) {
        err = e;
      }
      should.exist(err);
      should.not.exist(record);
      err.name.should.equal('PermissionDenied');
    });
  }); // end `insertKey`

  describe('insert', () => {
    it('should insert an encrypted document', async () => {
      const actor = actors['alpha@example.com'];
      const account = accounts['alpha@example.com'].account;
      let record = await brPrivateRemoteStorage.insert({
        actor,
        accountId: account.id,
        doc: mockData.encryptedDocument
      });
      should.exist(record);
      record.accountId.should.equal(database.hash(account.id));
      record.doc.should.deep.equal(mockData.encryptedDocument);
      record = await database.collections.privateRemoteStorage.findOne({
        accountId: database.hash(account.id),
        id: database.hash(mockData.encryptedDocument.id)
      });
      record.accountId.should.equal(database.hash(account.id));
      record.doc.should.deep.equal(mockData.encryptedDocument);
    });
    it('should insert an encrypted document with attribute', async () => {
      const actor = actors['alpha@example.com'];
      const account = accounts['alpha@example.com'].account;
      let record = await brPrivateRemoteStorage.insert({
        actor,
        accountId: account.id,
        doc: mockData.encryptedDocumentWithAttribute
      });
      should.exist(record);
      record.accountId.should.equal(database.hash(account.id));
      record.doc.should.deep.equal(mockData.encryptedDocumentWithAttribute);
      record = await database.collections.privateRemoteStorage.findOne({
        accountId: database.hash(account.id),
        id: database.hash(mockData.encryptedDocumentWithAttribute.id)
      });
      record.accountId.should.equal(database.hash(account.id));
      record.doc.should.deep.equal(mockData.encryptedDocumentWithAttribute);
    });
    it('should return error on duplicate encrypted document', async () => {
      const actor = actors['alpha@example.com'];
      const account = accounts['alpha@example.com'].account;
      // attempt to insert the same account again
      let err;
      try {
        await brPrivateRemoteStorage.insert({
          actor,
          accountId: account.id,
          doc: mockData.encryptedDocument
        });
      } catch(e) {
        err = e;
      }
      should.exist(err);
      err.name.should.equal('DuplicateError');
    });
    it('should fail for another account', async () => {
      const actor = actors['alpha@example.com'];
      let err;
      let record;
      try {
        record = await brPrivateRemoteStorage.insert({
          actor,
          accountId: 'urn:uuid:something-else',
          doc: mockData.encryptedDocument
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
    it('should upsert an encrypted document', async () => {
      const actor = actors['alpha@example.com'];
      const account = accounts['alpha@example.com'].account;
      await brPrivateRemoteStorage.update({
        actor,
        accountId: account.id,
        doc: mockData.encryptedDocument2
      });
      const record = await database.collections.privateRemoteStorage.findOne({
        accountId: database.hash(account.id),
        id: database.hash(mockData.encryptedDocument2.id)
      });
      should.exist(record);
      record.accountId.should.equal(database.hash(account.id));
      record.doc.should.deep.equal(mockData.encryptedDocument2);
    });
    it('should update an encrypted document', async () => {
      const actor = actors['alpha@example.com'];
      const account = accounts['alpha@example.com'].account;
      await brPrivateRemoteStorage.update({
        actor,
        accountId: account.id,
        doc: mockData.encryptedDocument
      });
      const record = await database.collections.privateRemoteStorage.findOne({
        accountId: database.hash(account.id),
        id: database.hash(mockData.encryptedDocument.id)
      });
      record.accountId.should.equal(database.hash(account.id));
      record.doc.should.deep.equal(mockData.encryptedDocument);
    });
    it('should fail for another account', async () => {
      const actor = actors['alpha@example.com'];
      let err;
      let record;
      try {
        record = await brPrivateRemoteStorage.update({
          actor,
          accountId: 'urn:uuid:something-else',
          doc: mockData.encryptedDocument
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
    it('should get an encrypted document', async () => {
      const actor = actors['alpha@example.com'];
      const account = accounts['alpha@example.com'].account;
      const record = await brPrivateRemoteStorage.get({
        actor,
        accountId: account.id,
        id: mockData.encryptedDocument.id
      });
      should.exist(record);
      record.doc.should.deep.equal(mockData.encryptedDocument);
    });
    it('should fail for another account', async () => {
      const actor = actors['alpha@example.com'];
      let err;
      let record;
      try {
        record = await brPrivateRemoteStorage.get({
          actor,
          accountId: 'urn:uuid:something-else',
          id: mockData.encryptedDocument.id
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
      const account = accounts['alpha@example.com'].account;
      let err;
      let record;
      try {
        record = await brPrivateRemoteStorage.get({
          actor,
          accountId: account.id,
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
    it('should get an encrypted document by attribute', async () => {
      const actor = actors['alpha@example.com'];
      const account = accounts['alpha@example.com'].account;
      const [attribute] = mockData.encryptedDocumentWithAttribute.attributes;
      const records = await brPrivateRemoteStorage.find({
        actor,
        accountId: account.id,
        query: {
          'doc.attributes.name': {
            $all: [attribute.name]
          }
        }
      });
      should.exist(records);
      records.length.should.equal(1);
      const [record] = records;
      record.accountId.should.equal(database.hash(account.id));
      record.doc.should.deep.equal(mockData.encryptedDocumentWithAttribute);
    });
    it('should get an encrypted document by attribute and value', async () => {
      const actor = actors['alpha@example.com'];
      const account = accounts['alpha@example.com'].account;
      const [attribute] = mockData.encryptedDocumentWithAttribute.attributes;
      const records = await brPrivateRemoteStorage.find({
        actor,
        accountId: account.id,
        query: {
          'doc.attributes': {
            $all: [{$elemMatch: attribute}]
          }
        }
      });
      should.exist(records);
      records.length.should.equal(1);
      const [record] = records;
      record.accountId.should.equal(database.hash(account.id));
      record.doc.should.deep.equal(mockData.encryptedDocumentWithAttribute);
    });
    it('should find no results', async () => {
      const actor = actors['alpha@example.com'];
      const account = accounts['alpha@example.com'].account;
      const records = await brPrivateRemoteStorage.find({
        actor,
        accountId: account.id,
        query: {
          'doc.attributes': {
            $all: [{$elemMatch: {name: 'foo', value: 'does-not-exist'}}]
          }
        }
      });
      should.exist(records);
      records.length.should.equal(0);
    });
    it('should fail for another account', async () => {
      const actor = actors['alpha@example.com'];
      let err;
      let records;
      try {
        records = await brPrivateRemoteStorage.find({
          actor,
          accountId: 'urn:uuid:something-else',
          query: {
            'doc.attributes': {
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
    it('should remove an encrypted document', async () => {
      const actor = actors['alpha@example.com'];
      const account = accounts['alpha@example.com'].account;
      const result = await brPrivateRemoteStorage.remove({
        actor,
        accountId: account.id,
        id: mockData.encryptedDocument.id
      });
      should.exist(result);
      result.should.equal(true);
      const record = await database.collections.privateRemoteStorage.findOne({
        accountId: database.hash(account.id),
        id: database.hash(mockData.encryptedDocument.id)
      });
      should.not.exist(record);
    });
    it('should return `false` for a missing document', async () => {
      const actor = actors['alpha@example.com'];
      const account = accounts['alpha@example.com'].account;
      const result = await brPrivateRemoteStorage.remove({
        actor,
        accountId: account.id,
        id: mockData.encryptedDocument.id
      });
      should.exist(result);
      result.should.equal(false);
      const record = await database.collections.privateRemoteStorage.findOne({
        accountId: database.hash(account.id),
        id: database.hash(mockData.encryptedDocument.id)
      });
      should.not.exist(record);
    });
    it('should fail for another account', async () => {
      const actor = actors['alpha@example.com'];
      let err;
      let records;
      try {
        records = await brPrivateRemoteStorage.remove({
          actor,
          accountId: 'urn:uuid:something-else',
          id: mockData.encryptedDocument.id
        });
      } catch(e) {
        err = e;
      }
      should.exist(err);
      should.not.exist(records);
      err.name.should.equal('PermissionDenied');
    });
  }); // end `remove`
}); // end bedrock-private-remote-storage

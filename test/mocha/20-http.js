/*
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

require('bedrock-data-hub-storage');
const https = require('https');
// allow self-signed cert for tests
const axios = require('axios').create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  })
});
const {config} = require('bedrock');
const helpers = require('./helpers');
const mockData = require('./mock.data');
let actors;
let accounts;
let urls;

// auto-pass authentication checks
const brPassport = require('bedrock-passport');
brPassport.authenticateAll = ({req}) => {
  const email = req.get('x-test-account');
  return {
    user: {
      actor: actors[email],
      account: accounts[email].account
    }
  };
};

describe('bedrock-data-hub-storage HTTP API', () => {
  before(async () => {
    await helpers.prepareDatabase(mockData);
    actors = await helpers.getActors(mockData);
    accounts = mockData.accounts;

    // common URLs
    const account = accounts['alpha@example.com'].account;
    const {baseUri} = config.server;
    const root = `${baseUri}/data-hub/${encodeURIComponent(account.id)}`;
    const invalid = `${baseUri}/data-hub/invalid`;
    urls = {
      documents: `${root}/documents`,
      masterKey: `${root}/master-key`,
      query: `${root}/query`,
      invalidDocuments: `${invalid}/documents`,
      invalidMasterKey: `${invalid}/master-key`,
      invalidQuery: `${invalid}/query`
    };
  });

  describe('insertKey', () => {
    it('should fail without `If-None-Match`', async () => {
      let err;
      try {
        await axios.put(
          urls.masterKey, mockData.masterKey,
          {headers: {'x-test-account': 'alpha@example.com'}});
      } catch(e) {
        err = e;
      }
      should.exist(err);
      should.exist(err.response);
      err.response.status.should.equal(400);
    });
    it('should create a master key', async () => {
      const response = await axios.put(
        urls.masterKey, mockData.masterKey,
        {headers: {
          'x-test-account': 'alpha@example.com',
          'if-none-match': '*'
        }});
      response.status.should.equal(204);
    });
    it('should return not modified', async () => {
      let err;
      try {
        await axios.put(
          urls.masterKey, mockData.masterKey,
          {headers: {
            'x-test-account': 'alpha@example.com',
            'if-none-match': '*'
          }});
      } catch(e) {
        err = e;
      }
      should.exist(err);
      should.exist(err.response);
      err.response.status.should.equal(304);
    });
    it('should fail for another account', async () => {
      let err;
      try {
        await axios.put(
          urls.invalidMasterKey, mockData.masterKey,
          {headers: {
            'x-test-account': 'alpha@example.com',
            'if-none-match': '*'
          }});
      } catch(e) {
        err = e;
      }
      should.exist(err);
      should.exist(err.response);
      err.response.status.should.equal(403);
      err.response.data.type.should.equal('PermissionDenied');
    });
  }); // end `insertKey`

  describe('insert', () => {
    it('should insert an encrypted document', async () => {
      const response = await axios.post(
        urls.documents, mockData.encryptedDocument,
        {headers: {'x-test-account': 'alpha@example.com'}});
      response.status.should.equal(201);
      response.headers.location.should.equal(
        urls.documents + '/' +
        encodeURIComponent(mockData.encryptedDocument.id));
    });
    it('should insert an encrypted document with attribute', async () => {
      const response = await axios.post(
        urls.documents, mockData.encryptedDocumentWithAttribute,
        {headers: {'x-test-account': 'alpha@example.com'}});
      response.status.should.equal(201);
      response.headers.location.should.equal(
        urls.documents + '/' +
        encodeURIComponent(mockData.encryptedDocumentWithAttribute.id));
    });
    it('should return error on duplicate encrypted document', async () => {
      // attempt to insert the same account again
      let err;
      try {
        await axios.post(
          urls.documents, mockData.encryptedDocument,
          {headers: {'x-test-account': 'alpha@example.com'}});
      } catch(e) {
        err = e;
      }
      should.exist(err);
      should.exist(err.response);
      err.response.status.should.equal(409);
      err.response.data.type.should.equal('DuplicateError');
    });
    it('should not insert for another account', async () => {
      let err;
      try {
        await axios.post(
          urls.invalidDocuments, mockData.encryptedDocument,
          {headers: {'x-test-account': 'alpha@example.com'}});
      } catch(e) {
        err = e;
      }
      should.exist(err);
      should.exist(err.response);
      err.response.status.should.equal(403);
      err.response.data.type.should.equal('PermissionDenied');
    });
  }); // end `insert`

  describe('update', () => {
    it('should upsert an encrypted document', async () => {
      const url =
        urls.documents + '/' +
        encodeURIComponent(mockData.encryptedDocument2.id);
      const response = await axios.put(
        url, mockData.encryptedDocument2,
        {headers: {'x-test-account': 'alpha@example.com'}});
      response.status.should.equal(204);
    });
    it('should update an encrypted document', async () => {
      const url =
        urls.documents + '/' +
        encodeURIComponent(mockData.encryptedDocument.id);
      const response = await axios.put(
        url, mockData.encryptedDocument,
        {headers: {'x-test-account': 'alpha@example.com'}});
      response.status.should.equal(204);
    });
    it('should fail for another account', async () => {
      const url =
        urls.invalidDocuments + '/' +
        encodeURIComponent(mockData.encryptedDocument.id);
      let err;
      try {
        await axios.put(
          url, mockData.encryptedDocument,
          {headers: {'x-test-account': 'alpha@example.com'}});
      } catch(e) {
        err = e;
      }
      should.exist(err);
      should.exist(err.response);
      err.response.status.should.equal(403);
      err.response.data.type.should.equal('PermissionDenied');
    });
  }); // end `update`

  describe('get', () => {
    it('should get an encrypted document', async () => {
      const url =
        urls.documents + '/' +
        encodeURIComponent(mockData.encryptedDocument.id);
      const response = await axios.get(
        url, {headers: {'x-test-account': 'alpha@example.com'}});
      response.status.should.equal(200);
      response.data.should.deep.equal(mockData.encryptedDocument);
    });
    it('should fail for another account', async () => {
      const url =
        urls.invalidDocuments + '/' +
        encodeURIComponent(mockData.encryptedDocument.id);
      let err;
      try {
        await axios.get(
          url, {headers: {'x-test-account': 'alpha@example.com'}});
      } catch(e) {
        err = e;
      }
      should.exist(err);
      should.exist(err.response);
      err.response.status.should.equal(403);
      err.response.data.type.should.equal('PermissionDenied');
    });
    it('should get not found error', async () => {
      const url = urls.documents + '/does-not-exist';
      let err;
      try {
        await axios.get(
          url, {headers: {'x-test-account': 'alpha@example.com'}});
      } catch(e) {
        err = e;
      }
      should.exist(err);
      should.exist(err.response);
      err.response.status.should.equal(404);
      err.response.data.type.should.equal('NotFoundError');
    });
  }); // end `get`

  describe('find', () => {
    it('should get an encrypted document by attribute', async () => {
      const [attribute] = mockData.encryptedDocumentWithAttribute.attributes;
      const query = {
        has: [attribute.name]
      };
      const response = await axios.post(
        urls.query, query, {headers: {'x-test-account': 'alpha@example.com'}});
      response.status.should.equal(200);
      response.data.should.be.an('array');
      response.data.length.should.equal(1);
      response.data[0].should.deep.equal(
        mockData.encryptedDocumentWithAttribute);
    });
    it('should get an encrypted document by attribute and value', async () => {
      const [attribute] = mockData.encryptedDocumentWithAttribute.attributes;
      const query = {
        equals: [{[attribute.name]: attribute.value}]
      };
      const response = await axios.post(
        urls.query, query, {headers: {'x-test-account': 'alpha@example.com'}});
      response.status.should.equal(200);
      response.data.should.be.an('array');
      response.data.length.should.equal(1);
      response.data[0].should.deep.equal(
        mockData.encryptedDocumentWithAttribute);
    });
    it('should find no results', async () => {
      const query = {
        equals: [{foo: 'does-not-exist'}]
      };
      const response = await axios.post(
        urls.query, query, {headers: {'x-test-account': 'alpha@example.com'}});
      response.status.should.equal(200);
      response.data.should.be.an('array');
      response.data.length.should.equal(0);
    });
    it('should fail for another account', async () => {
      const query = {
        equals: [{foo: 'does-not-exist'}]
      };
      let err;
      try {
        await axios.post(
          urls.invalidQuery, query,
          {headers: {'x-test-account': 'alpha@example.com'}});
      } catch(e) {
        err = e;
      }
      should.exist(err);
      should.exist(err.response);
      err.response.status.should.equal(403);
      err.response.data.type.should.equal('PermissionDenied');
    });
  }); // end `find`

  describe('delete', () => {
    it('should delete an encrypted document', async () => {
      const url =
        urls.documents + '/' +
        encodeURIComponent(mockData.encryptedDocument.id);
      const response = await axios.delete(
        url, {headers: {'x-test-account': 'alpha@example.com'}});
      response.status.should.equal(204);
    });
    it('should return 404 for a missing document', async () => {
      const url =
        urls.documents + '/' +
        encodeURIComponent(mockData.encryptedDocument.id);
      let err;
      try {
        await axios.delete(
          url, {headers: {'x-test-account': 'alpha@example.com'}});
      } catch(e) {
        err = e;
      }
      should.exist(err);
      should.exist(err.response);
      err.response.status.should.equal(404);
    });
    it('should fail for another account', async () => {
      const url =
        urls.invalidDocuments + '/' +
        encodeURIComponent(mockData.encryptedDocument.id);
      let err;
      try {
        await axios.delete(
          url, {headers: {'x-test-account': 'alpha@example.com'}});
      } catch(e) {
        err = e;
      }
      should.exist(err);
      should.exist(err.response);
      err.response.status.should.equal(403);
      err.response.data.type.should.equal('PermissionDenied');
    });
  }); // end `delete`
}); // end bedrock-data-hub-storage

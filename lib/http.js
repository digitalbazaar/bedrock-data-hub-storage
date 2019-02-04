/*
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const asyncHandler = require('express-async-handler');
const bedrock = require('bedrock');
const brPassport = require('bedrock-passport');
const {config} = bedrock;
const storage = require('./storage');
const {validate} = require('bedrock-validation');
require('bedrock-express');
const {
  ensureAuthenticated
} = brPassport;
const {BedrockError} = bedrock.util;

// load config defaults
require('./config');

// module API
const api = {};
module.exports = api;

bedrock.events.on('bedrock-express.configure.routes', app => {
  const {baseUri} = config.server;
  const cfg = config['data-hub-storage'];
  const {routes} = cfg;
  const baseStorageUrl = `${baseUri}${routes.basePath}`;

  // create a master key
  app.put(
    routes.masterKey,
    ensureAuthenticated,
    validate('bedrock-data-hub-storage.masterKey'),
    asyncHandler(async (req, res) => {
      const {accountId} = req.params;
      const {actor} = (req.user || {});
      const ifNoneMatch = req.get('if-none-match');
      if(ifNoneMatch !== '*') {
        // replacing master key not implemented
        throw new BedrockError(
          'Replacing master key is not allowed; use "If-None-Match: *".',
          'NotAllowedError', {public: true, httpStatusCode: 400});
      }
      try {
        await storage.insertKey({actor, accountId, key: req.body});
      } catch(e) {
        if(e.name === 'DuplicateError') {
          res.status(304).end();
          return;
        }
        throw e;
      }
      res.status(204).end();
    }));

  // get a wrapped master key
  app.get(
    routes.masterKey,
    asyncHandler(async (req, res) => {
      const {accountId} = req.params;
      const {actor} = (req.user || {});
      const {key} = await storage.getKey({actor, accountId});
      res.json(key);
    }));

  // insert a document
  app.post(
    routes.documents,
    ensureAuthenticated,
    validate('bedrock-data-hub-storage.encryptedDocument'),
    asyncHandler(async (req, res) => {
      const {accountId} = req.params;
      const {actor} = (req.user || {});
      const {doc} = await storage.insert({actor, accountId, doc: req.body});
      const location =
        `${baseStorageUrl}/${encodeURIComponent(accountId)}/` +
        `documents/${encodeURIComponent(doc.id)}`;
      res.status(201).location(location).end();
    }));

  // update a document
  app.put(
    routes.documents + '/:docId',
    ensureAuthenticated,
    validate('bedrock-data-hub-storage.encryptedDocument'),
    asyncHandler(async (req, res) => {
      const {accountId, docId: id} = req.params;
      const {actor} = (req.user || {});
      if(req.body.id !== id) {
        throw new BedrockError(
          'Could not update encrypted document; ID does not match.',
          'DataError', {public: true, httpStatusCode: 400});
      }
      await storage.update({actor, accountId, doc: req.body});
      res.status(204).end();
    }));

  // get a document
  app.get(
    routes.documents + '/:docId',
    ensureAuthenticated,
    asyncHandler(async (req, res) => {
      const {accountId, docId: id} = req.params;
      const {actor} = (req.user || {});
      const {doc} = await storage.get({actor, accountId, id});
      res.json(doc);
    }));

  // delete a document
  app.delete(
    routes.documents + '/:docId',
    ensureAuthenticated,
    asyncHandler(async (req, res) => {
      const {accountId, docId: id} = req.params;
      const {actor} = (req.user || {});
      const removed = await storage.remove({actor, accountId, id});
      if(removed) {
        res.status(204).end();
      } else {
        res.status(404).end();
      }
    }));

  // query for documents
  app.post(
    routes.query,
    ensureAuthenticated,
    asyncHandler(async (req, res) => {
      const {accountId} = req.params;
      const {actor} = (req.user || {});
      const {equals, has} = req.body;
      const query = {accountId};
      if(equals) {
        const $all = [];
        query['doc.attributes'] = {$all};
        const allStrings = equals.every(e => {
          for(const key in e) {
            if(typeof e[key] !== 'string') {
              return false;
            }
            $all.push({$elemMatch: {name: key, value: e[key]}});
          }
          return true;
        });
        if(!allStrings) {
          throw new BedrockError(
            'Invalid "equals" query; each array element must be an object ' +
            'with keys whose values are strings.',
            'DataError', {public: true, httpStatusCode: 400});
        }
      } else {
        // `has` query
        query['doc.attributes.name'] = {$all: has};
      }
      const results = await storage.find(
        {actor, accountId, query, fields: {_id: 0, doc: 1}});
      res.json(results.map(r => r.doc));
    }));
});

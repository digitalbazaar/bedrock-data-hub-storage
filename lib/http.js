/*!
 * Copyright (c) 2018-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const asyncHandler = require('express-async-handler');
const bedrock = require('bedrock');
const brPassport = require('bedrock-passport');
const {config} = bedrock;
const cors = require('cors');
const storage = require('./storage');
const {validate} = require('bedrock-validation');
const uuid = require('uuid-random');
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
  const baseStorageUrl = `${baseUri}${routes.dataHubs}`;

  function _getDataHubId(dataHubIdParam) {
    return `${baseStorageUrl}/${encodeURIComponent(dataHubIdParam)}`;
  }

  // create a new data hub
  app.post(
    routes.dataHubs,
    //ensureAuthenticated,
    validate('bedrock-data-hub-storage.config'),
    asyncHandler(async (req, res) => {
      const {actor = null} = (req.user || {});
      delete req.body.id;
      const id = _getDataHubId(uuid());
      const {config} = await storage.insertConfig(
        {actor, config: {id, ...req.body}});
      res.status(201).location(id).json(config);
    }));

  // get data hubs by query
  app.get(
    routes.dataHubs,
    //ensureAuthenticated,
    cors(),
    // TODO: implement query validator
    //validate('bedrock-data-hub-storage.foo'),
    asyncHandler(async (req, res) => {
      const {actor = null} = (req.user || {});
      const {controller, referenceId} = req.query;
      if(!controller) {
        throw new BedrockError(
          'Query not supported; a "controller" must be specified.',
          'NotSupportedError', {public: true, httpStatusCode: 400});
      }
      if(!referenceId) {
        // query for all data hubs controlled by controller not implemented yet
        // TODO: implement
        throw new BedrockError(
          'Query not supported; a "referenceId" must be specified.',
          'NotSupportedError', {public: true, httpStatusCode: 400});
      }
      const query = {'config.referenceId': referenceId};
      const results = await storage.findConfig(
        {actor, controller, query, fields: {_id: 0, config: 1}});
      res.json(results.map(r => r.config));
    }));

  // TODO: implement update a data hub config

  // get a data hub config
  app.get(
    routes.dataHub,
    //ensureAuthenticated,
    cors(),
    asyncHandler(async (req, res) => {
      const {actor = null} = (req.user || {});
      const id = _getDataHubId(req.params.dataHubId);
      const {config} = await storage.getConfig({actor, id});
      res.json(config);
    }));

  // insert a document
  app.options(routes.documents, cors());
  app.post(
    routes.documents,
    //ensureAuthenticated,
    // TODO: ensure CSRF isn't an issue or require backend datahub clients
    cors(),
    validate('bedrock-data-hub-storage.document'),
    asyncHandler(async (req, res) => {
      const {actor = null} = (req.user || {});
      const dataHubId = _getDataHubId(req.params.dataHubId);
      const {doc} = await storage.insert({actor, dataHubId, doc: req.body});
      const location = `${dataHubId}/documents/${encodeURIComponent(doc.id)}`;
      res.status(201).location(location).end();
    }));

  // update a document
  app.options(routes.documents + '/:docId', cors());
  app.post(
    routes.documents + '/:docId',
    //ensureAuthenticated,
    // TODO: ensure CSRF isn't an issue or require backend datahub clients
    cors(),
    validate('bedrock-data-hub-storage.document'),
    asyncHandler(async (req, res) => {
      const {actor = null} = (req.user || {});
      const {docId: id} = req.params;
      if(req.body.id !== id) {
        throw new BedrockError(
          'Could not update document; ID does not match.',
          'DataError', {public: true, httpStatusCode: 400});
      }
      const dataHubId = _getDataHubId(req.params.dataHubId);
      await storage.update({actor, dataHubId, doc: req.body});
      res.status(204).end();
    }));

  // get a document
  app.get(
    routes.documents + '/:docId',
    //ensureAuthenticated,
    cors(),
    asyncHandler(async (req, res) => {
      const {actor = null} = (req.user || {});
      const {docId: id} = req.params;
      const dataHubId = _getDataHubId(req.params.dataHubId);
      const {doc} = await storage.get({actor, dataHubId, id});
      res.json(doc);
    }));

  // delete a document
  app.delete(
    routes.documents + '/:docId',
    //ensureAuthenticated,
    // TODO: ensure CSRF isn't an issue or require backend datahub clients
    cors(),
    asyncHandler(async (req, res) => {
      const {actor = null} = (req.user || {});
      const {docId: id} = req.params;
      const dataHubId = _getDataHubId(req.params.dataHubId);
      const removed = await storage.remove({actor, dataHubId, id});
      if(removed) {
        res.status(204).end();
      } else {
        res.status(404).end();
      }
    }));

  // query for documents
  app.post(
    routes.query,
    //ensureAuthenticated,
    cors(),
    asyncHandler(async (req, res) => {
      const {actor = null} = (req.user || {});
      const dataHubId = _getDataHubId(req.params.dataHubId);
      const {index, equals, has} = req.body;
      // TODO: database.hash() hmac IDs here and in `storage`?
      let query = {'doc.indexed.hmac.id': index};
      if(equals) {
        const $or = [];
        const allStrings = equals.every(e => {
          const $elemMatch = {};
          for(const key in e) {
            if(typeof e[key] !== 'string') {
              return false;
            }
            $elemMatch.name = key;
            $elemMatch.value = e[key];
          }
          $or.push({
            ...query,
            'doc.indexed.attributes': {
              $elemMatch
            }
          });
          return true;
        });
        query = {$or};
        if(!allStrings) {
          throw new BedrockError(
            'Invalid "equals" query; each array element must be an object ' +
            'with keys that have values that are strings.',
            'DataError', {public: true, httpStatusCode: 400});
        }
      } else {
        // `has` query
        query['doc.indexed.attributes.name'] = {$all: has};
      }
      const results = await storage.find(
        {actor, dataHubId, query, fields: {_id: 0, doc: 1}});
      res.json(results.map(r => r.doc));
    }));
});

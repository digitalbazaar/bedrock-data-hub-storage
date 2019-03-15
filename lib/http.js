/*!
 * Copyright (c) 2018-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const asyncHandler = require('express-async-handler');
const bedrock = require('bedrock');
const brPassport = require('bedrock-passport');
const {config} = bedrock;
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

  // create a new data hub
  app.post(
    routes.dataHubs,
    ensureAuthenticated,
    validate('bedrock-data-hub-storage.config'),
    asyncHandler(async (req, res) => {
      const {actor} = (req.user || {});
      delete req.body.id;
      const {config} = await storage.insertConfig(
        {actor, config: {id: uuid(), ...req.body}});
      const location = `${baseStorageUrl}/${encodeURIComponent(config.id)}`;
      res.status(201).location(location).json(config);
    }));

  // get data hubs by query
  app.get(
    routes.dataHubs,
    ensureAuthenticated,
    // TODO: implement query validator
    //validate('bedrock-data-hub-storage.foo'),
    asyncHandler(async (req, res) => {
      const {actor} = (req.user || {});
      const {controller, primary} = req.query;
      if(!controller) {
        throw new BedrockError(
          'Query not supported; a "controller" must be specified.',
          'NotSupportedError', {public: true, httpStatusCode: 400});
      }
      if(primary !== 'true') {
        // query for all data hubs controlled by controller not implemented yet
        // TODO: implement
        throw new BedrockError(
          'Query not supported; a "controller" must be specified.',
          'NotSupportedError', {public: true, httpStatusCode: 400});
      }
      const query = {'config.primary': true};
      const results = await storage.findConfig(
        {actor, controller, query, fields: {_id: 0, config: 1}});
      res.json(results.map(r => r.config));
    }));

  // TODO: implement update a data hub config

  // get a data hub config
  app.get(
    routes.dataHub,
    ensureAuthenticated,
    asyncHandler(async (req, res) => {
      const {actor} = (req.user || {});
      const {dataHubId: id} = req.params;
      const {config} = await storage.getConfig({actor, id});
      res.json(config);
    }));

  // insert a document
  app.post(
    routes.documents,
    ensureAuthenticated,
    validate('bedrock-data-hub-storage.document'),
    asyncHandler(async (req, res) => {
      const {actor} = (req.user || {});
      const {dataHubId} = req.params;
      const {doc} = await storage.insert({actor, dataHubId, doc: req.body});
      const location =
        `${baseStorageUrl}/${encodeURIComponent(dataHubId)}/` +
        `documents/${encodeURIComponent(doc.id)}`;
      res.status(201).location(location).end();
    }));

  // update a document
  app.post(
    routes.documents + '/:docId',
    ensureAuthenticated,
    validate('bedrock-data-hub-storage.document'),
    asyncHandler(async (req, res) => {
      const {actor} = (req.user || {});
      const {dataHubId, docId: id} = req.params;
      if(req.body.id !== id) {
        throw new BedrockError(
          'Could not update document; ID does not match.',
          'DataError', {public: true, httpStatusCode: 400});
      }
      await storage.update({actor, dataHubId, doc: req.body});
      res.status(204).end();
    }));

  // get a document
  app.get(
    routes.documents + '/:docId',
    ensureAuthenticated,
    asyncHandler(async (req, res) => {
      const {actor} = (req.user || {});
      const {dataHubId, docId: id} = req.params;
      const {doc} = await storage.get({actor, dataHubId, id});
      res.json(doc);
    }));

  // delete a document
  app.delete(
    routes.documents + '/:docId',
    ensureAuthenticated,
    asyncHandler(async (req, res) => {
      const {actor} = (req.user || {});
      const {dataHubId, docId: id} = req.params;
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
    ensureAuthenticated,
    asyncHandler(async (req, res) => {
      const {actor} = (req.user || {});
      const {dataHubId} = req.params;
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

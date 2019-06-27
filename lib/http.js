/*!
 * Copyright (c) 2018-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const asyncHandler = require('express-async-handler');
const base58 = require('bs58');
const bedrock = require('bedrock');
const brPassport = require('bedrock-passport');
const brZCapStorage = require('bedrock-zcap-storage');
const {config} = bedrock;
const cors = require('cors');
const jsigs = require('jsonld-signatures');
const httpSignatureHeader = require('http-signature-header');
const storage = require('./storage');
const {validate} = require('bedrock-validation');
const uuid = require('uuid-random');
const {LDKeyPair} = require('crypto-ld');
const {extendContextLoader, SECURITY_CONTEXT_V2_URL} = jsigs;
const {RsaSignature2018, Ed25519Signature2018} = jsigs.suites;
const {CapabilityInvocation} = require('ocapld');
const {TextDecoder, TextEncoder} = require('util');
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

  // TODO: endpoints for creating and deleting data hubs will only use
  // session-based auth and check a simple permission on the account...
  // the data hub configs should have a controller that is the account ID
  // but they also contain an invoker and delegator field that includes either
  // the account's did:key or a profile DID... the reasoning for this should
  // be explained: creating a data hub requires SPAM prevention, which account
  // creation provides for; just using a DID that exists in the wild
  // doesn't necessarily do that. ... need to determine if this is a viable
  // pattern that should be repeated going forward. (APIs and protocols for
  // creating/deleting data hubs may not be part of the standard, only
  // creating/deleting docs and files)

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

  // TODO: implement `update` for data hub config

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
    // CORs is safe because authorization uses HTTP signatures + capabilities,
    // not cookies
    cors(),
    validate('bedrock-data-hub-storage.document'),
    asyncHandler(async (req, res) => {
      // check authorization
      const expectedTarget = `${baseUri}${req.originalUrl}`;
      const dataHubId = _getDataHubId(req.params.dataHubId);
      await _authorize(
        {dataHubId, req, expectedTarget, expectedAction: 'read'});

      // TODO: remove `req.user` and `actor` from `storage.insert` and
      // instead use capabilities only

      const {actor = null} = (req.user || {});
      const {doc} = await storage.insert({actor, dataHubId, doc: req.body});
      const location = `${dataHubId}/documents/${encodeURIComponent(doc.id)}`;
      res.status(201).location(location).end();
    }));

  // update a document
  app.options(routes.documents + '/:docId', cors());
  app.post(
    routes.documents + '/:docId',
    // CORs is safe because authorization uses HTTP signatures + capabilities,
    // not cookies
    cors(),
    validate('bedrock-data-hub-storage.document'),
    asyncHandler(async (req, res) => {
      // check authorization
      const expectedTarget = `${baseUri}${req.originalUrl}`;
      const dataHubId = _getDataHubId(req.params.dataHubId);
      await _authorize(
        {dataHubId, req, expectedTarget, expectedAction: 'read'});

      // TODO: remove `req.user` and `actor` from `storage.update` and
      // instead use capabilities only

      const {actor = null} = (req.user || {});
      const {docId: id} = req.params;
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
    cors(),
    asyncHandler(async (req, res) => {
      // check authorization
      const expectedTarget = `${baseUri}${req.originalUrl}`;
      const dataHubId = _getDataHubId(req.params.dataHubId);
      await _authorize(
        {dataHubId, req, expectedTarget, expectedAction: 'read'});

      // TODO: remove `req.user` and `actor` from `storage.get` and
      // instead use capabilities only; still need to determine how to
      // determine which recipients to include in the JWE (use specified
      // recipient key in the JWE or invoker ID somehow)

      const {actor = null} = (req.user || {});
      const {docId: id} = req.params;
      const {doc} = await storage.get({actor, dataHubId, id});
      res.json(doc);
    }));

  // delete a document
  app.delete(
    routes.documents + '/:docId',
    // CORs is safe because authorization uses HTTP signatures + capabilities,
    // not cookies
    cors(),
    asyncHandler(async (req, res) => {
      // check authorization
      const expectedTarget = `${baseUri}${req.originalUrl}`;
      const dataHubId = _getDataHubId(req.params.dataHubId);
      await _authorize(
        {dataHubId, req, expectedTarget, expectedAction: 'read'});

      // TODO: remove `req.user` and `actor` from `storage.remove` and
      // instead use capabilities only

      const {actor = null} = (req.user || {});
      const {docId: id} = req.params;
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
    cors(),
    asyncHandler(async (req, res) => {
      // check authorization
      const expectedTarget = `${baseUri}${req.originalUrl}`;
      const dataHubId = _getDataHubId(req.params.dataHubId);
      await _authorize(
        {dataHubId, req, expectedTarget, expectedAction: 'read'});

      // TODO: remove `req.user` and `actor` from `storage.find` and
      // instead use capabilities only; still need to determine how to
      // determine which recipients to include in the JWE (use specified
      // recipient key in the JWE or invoker ID somehow)

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
      const {actor = null} = (req.user || {});
      const results = await storage.find(
        {actor, dataHubId, query, fields: {_id: 0, doc: 1}});
      res.json(results.map(r => r.doc));
    }));

  // TODO: add http API for adding/deleting capabilities
});

// TODO: Most of the following code is a target for reusability in other
// modules such as Web KMS

// Note: for dereferencing `did:key` URLs
const DOCUMENT_LOADER = async url => {
  // TODO: move to did-key lib
  if(url.startsWith('did:key:')) {
    const publicKeyBase58 = _parsePublicKeyBase58(url);
    return {
      contextUrl: null,
      documentUrl: url,
      document: {
        '@context': 'https://w3id.org/security/v2',
        id: url,
        publicKey: [{
          id: url,
          // TODO: determine from parsing multibase key
          type: 'Ed25519VerificationKey2018',
          controller: url,
          publicKeyBase58
        }],
        authentication: [url],
        assertionMethod: [url],
        capabilityDelegation: [url],
        capabilityInvocation: [url]
      }
    };
  }
  const error = new Error(`Dereferencing url "${url}" is prohibited.`);
  error.name = 'NotAllowedError';
  error.httpStatusCode = 400;
  throw error;
};

async function _authorize({dataHubId, req, expectedTarget, expectedAction}) {
  // parse http header for signature
  const headers = [
    '(key-id)', '(created)', '(expires)', '(request-target)',
    'host', 'authorization-capability', 'authorization-capability-action'
  ];
  if(req.get('content-type')) {
    headers.push('content-type');
    headers.push('digest');
  }
  let parsed;
  try {
    parsed = httpSignatureHeader.parseRequest(req, {headers});
  } catch(e) {
    _throwNotAllowed(e);
  }

  // verify that `host` matches server host
  const host = req.get('host');
  if(host !== config.server.host) {
    throw new BedrockError(
      'Host header contains an invalid host name.',
      'NotAllowedError', {
        public: true,
        httpStatusCode: 400,
        host,
        expectedHost: config.server.host
      });
  }

  /* Note: The order in which we run these checks can introduce side channels
  that leak information (e.g., timing). However, we are not presently concerned
  about leaking information about existing capabilities as such leaks do not
  pose any security risk -- and any privacy correlation risk is low if the
  capability identifiers are infeasible to guess. */

  // get parsed parameters from from HTTP header and generate signing string
  const {keyId, signingString, params: {signature: b64Signature}} = parsed;

  // fetch verification method from `keyId` and import as a crypto-ld key
  const verificationMethod = await _getVerificationMethod(keyId);
  const key = await LDKeyPair.from(verificationMethod);

  // verify HTTP signature
  const verifier = key.verifier();
  const encoder = new TextEncoder();
  const data = encoder.encode(signingString);
  const signature = Buffer.from(b64Signature, 'base64');
  const verified = await verifier.verify({data, signature});
  if(!verified) {
    _throwNotAllowed(new BedrockError(
      'Signature not verified.',
      'DataError', {
        public: true,
        httpStatusCode: 400
      }));
  }

  // dereference the capability if it doesn't match the expected target (i.e.,
  // it is not the root capability); it must exist in local zcap storage as a
  // delegated capability
  let capability = req.get('authorization-capability');
  if(capability !== expectedTarget) {
    try {
      capability = await brZCapStorage.delegated.get({
        id: capability,
        invocationTarget: expectedTarget
      });
    } catch(e) {
      if(e.name === 'NotFoundError') {
        _throwNotAllowed(e);
      }
      throw e;
    }
  }

  // check capability invocation
  // TODO: add parameters to check any other caveats in the capability as
  // appropriate... noting that caveats like "file size" can't be checked
  // until the file received hits the limit, so that won't happen here
  const purpose = new CapabilityInvocation({expectedTarget, expectedAction});
  const proof = {
    capability,
    capabilityAction: req.get('authorization-capability-action'),
    verificationMethod: keyId
  };
  const documentLoader = extendContextLoader(async url => {
    if(url === expectedTarget) {
      // dynamically generate zcap for root capability
      const {config} = await storage.getConfig({actor: null, id: dataHubId});
      return {
        contextUrl: null,
        documentUrl: url,
        document: {
          '@context': 'https://w3id.org/security/v2',
          id: url,
          controller: config.controller,
          invoker: config.invoker,
          delegator: config.delegator
        }
      };
    }
    return DOCUMENT_LOADER(url);
  });
  const {valid} = await purpose.validate(proof, {
    verificationMethod,
    documentLoader
  });
  if(!valid) {
    // TODO: destructure `error` from `purpose.validate` and include it?
    _throwNotAllowed();
  }

  return {invoker: key.controller || key.id};
}

function _throwNotAllowed(cause) {
  throw new BedrockError(
    'Permission denied.', 'NotAllowedError', {
      httpStatusCode: 400,
      public: true
    }, cause);
}

async function _getVerificationMethod(keyId) {
  // Note: `expansionMap` is intentionally not passed; we can safely drop
  // properties here and must allow for it
  const documentLoader = extendContextLoader(DOCUMENT_LOADER);
  const {'@graph': [framed]} = await bedrock.jsonld.frame(keyId, {
    '@context': SECURITY_CONTEXT_V2_URL,
    '@embed': '@always',
    id: keyId
  }, {documentLoader, compactToRelative: false});
  if(!framed) {
    throw new Error(`Verification method ${keyId} not found.`);
  }

  // ensure verification method has not been revoked
  if(framed.revoked !== undefined) {
    throw new Error('The verification method has been revoked.');
  }

  return framed;
}

function _parsePublicKeyBase58(didKeyUrl) {
  const fingerprint = didKeyUrl.substr('did:key:'.length);
  // skip leading `z` that indicates base58 encoding
  const buffer = base58.decode(fingerprint.substr(1));
  // assume buffer is: 0xed 0x01 <public key bytes>
  return base58.encode(buffer.slice(2));
}

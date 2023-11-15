//
// mdn-bcd-collector: test-builder/api.ts
// Functions directly related to building all of the web API tests
//
// © Gooborg Studios, Google LLC, Mozilla Corporation, Apple Inc
// See the LICENSE file for copyright details
//

import * as WebIDL2 from "webidl2";

import type {RawTestCodeExpr, Exposure, IDLFiles} from "../types/types.js";

import {getCustomTest, compileTest} from "./common.js";

const mergeMembers = (target, source) => {
  // Check for duplicate members across partials/mixins.
  const targetMembers = new Set(target.members.map((m) => m.name));
  const sourceMembers = new Set();
  for (const member of source.members) {
    if (targetMembers.has(member.name)) {
      const targetMember = target.members.find((m) => m.name);
      // Static members may have the same name as a non-static member.
      // If target has static member with same name, remove from target.
      // If source has static member with same name, don't merge into target.
      if (targetMember.special === "static") {
        target.members = target.members.filter((m) => m.name !== member.name);
        sourceMembers.add(member);
      } else if (member.special !== "static") {
        throw new Error(
          `Duplicate definition of ${target.name}.${member.name}`,
        );
      }
    } else {
      sourceMembers.add(member);
    }
  }
  // Now merge members.
  target.members.push(...sourceMembers);
};

const flattenIDL = (specIDLs: IDLFiles, customIDLs: IDLFiles) => {
  let ast: WebIDL2.IDLRootType[] = [];

  for (const idl of Object.values(specIDLs)) {
    ast.push(...idl);
  }

  for (const idl of Object.values(customIDLs)) {
    ast.push(...idl);
  }

  // merge partials (O^2 but still fast)
  ast = ast.filter((dfn) => {
    if (!("partial" in dfn && dfn.partial)) {
      return true;
    }

    const target = ast.find(
      (it) =>
        !("partial" in it && it.partial) &&
        it.type === dfn.type &&
        it.name === dfn.name,
    );
    if (!target) {
      throw new Error(
        `Original definition not found for partial ${dfn.type} ${dfn.name}`,
      );
    }

    // merge members to target interface/dictionary/etc. and drop partial
    mergeMembers(target, dfn);

    return false;
  });

  // mix in the mixins
  for (const dfn of ast) {
    if (dfn.type === "includes") {
      if (dfn.includes === "WindowOrWorkerGlobalScope") {
        // WindowOrWorkerGlobalScope is mapped differently in BCD
        continue;
      }
      const mixin = ast.find(
        (it) =>
          !("partial" in it && it.partial) &&
          it.type === "interface mixin" &&
          it.name === dfn.includes,
      );
      if (!mixin) {
        throw new Error(
          `Interface mixin ${dfn.includes} not found for target ${dfn.target}`,
        );
      }
      const target = ast.find(
        (it) =>
          !("partial" in it && it.partial) &&
          it.type === "interface" &&
          it.name === dfn.target,
      );
      if (!target) {
        throw new Error(
          `Target ${dfn.target} not found for interface mixin ${dfn.includes}`,
        );
      }

      // merge members to target interface
      mergeMembers(target, mixin);
    }
  }

  const globals = ast.filter(
    (dfn) => "name" in dfn && dfn.name === "WindowOrWorkerGlobalScope",
  );

  // drop includes and mixins
  ast = ast.filter(
    (dfn) => dfn.type !== "includes" && dfn.type !== "interface mixin",
  );

  // Get all possible scopes
  const scopes = new Set();
  for (const dfn of ast) {
    // Special case RTCIdentityProviderGlobalScope since it doesn't use the
    // Global extended attribute correctly:
    // https://github.com/w3c/webrtc-identity/pull/36
    if ("name" in dfn && dfn.name === "RTCIdentityProviderGlobalScope") {
      scopes.add("RTCIdentityProvider");
      continue;
    }

    const attr = getExtAttrSet(dfn, "Global");
    if (attr) {
      for (const s of attr) {
        scopes.add(s);
      }
    }
  }

  return {ast, globals, scopes};
};

const flattenMembers = (iface) => {
  const members = iface.members
    .filter((member) => member.name && member.type !== "const")
    // Ignore alternate names for standard features within the standard IDL
    .filter(
      (member) =>
        !(
          (iface.name === "Document" &&
            ["charset", "inputEncoding"].includes(member.name)) ||
          (iface.name === "Window" && member.name === "clientInformation") ||
          (iface.name === "Element" && member.name === "webkitMatchesSelector")
        ),
    );
  for (const member of iface.members.filter((member) => !member.name)) {
    switch (member.type) {
      case "constructor":
        // Don't generate tests for [HTMLConstructor]. These are for custom
        // elements, not for constructor the elements themselves:
        // https://html.spec.whatwg.org/multipage/dom.html#html-element-constructors
        if (!getExtAttr(member, "HTMLConstructor")) {
          // Test generation doesn't use constructor arguments, so they aren't
          // copied
          members.push({name: iface.name, type: "constructor"});
        }
        break;
      case "iterable":
        if (member.async) {
          // https://webidl.spec.whatwg.org/#idl-async-iterable
          members.push(
            {name: "@@asyncIterator", type: "symbol"},
            {name: "values", type: "operation"},
          );
          if (member.idlType.length === 2) {
            // https://webidl.spec.whatwg.org/#pair-asynchronously-iterable-declaration
            members.push(
              {name: "entries", type: "operation"},
              {name: "keys", type: "operation"},
            );
          }
        } else {
          // https://webidl.spec.whatwg.org/#idl-iterable
          members.push(
            {name: "@@iterator", type: "symbol"},
            {name: "entries", type: "operation"},
            {name: "forEach", type: "operation"},
            {name: "keys", type: "operation"},
            {name: "values", type: "operation"},
          );
        }
        break;
      case "maplike":
        // https://webidl.spec.whatwg.org/#idl-maplike
        members.push(
          {name: "@@iterator", type: "symbol"},
          {name: "entries", type: "operation"},
          {name: "forEach", type: "operation"},
          {name: "get", type: "operation"},
          {name: "has", type: "operation"},
          {name: "keys", type: "operation"},
          {name: "size", type: "attribute"},
          {name: "values", type: "operation"},
        );
        if (!member.readonly) {
          members.push(
            {name: "clear", type: "operation"},
            {name: "delete", type: "operation"},
            {name: "set", type: "operation"},
          );
        }
        break;
      case "setlike":
        // https://webidl.spec.whatwg.org/#idl-setlike
        members.push(
          {name: "@@iterator", type: "symbol"},
          {name: "entries", type: "operation"},
          {name: "forEach", type: "operation"},
          {name: "has", type: "operation"},
          {name: "keys", type: "operation"},
          {name: "size", type: "attribute"},
          {name: "values", type: "operation"},
        );
        if (!member.readonly) {
          members.push(
            {name: "add", type: "operation"},
            {name: "clear", type: "operation"},
            {name: "delete", type: "operation"},
          );
        }
        break;
      case "operation":
        switch (member.special) {
          case "stringifier":
            // Catch unnamed stringifiers
            // https://webidl.spec.whatwg.org/#es-stringifier
            members.push({name: "toString", type: "operation"});
            break;
        }
        break;
    }
  }

  // Catch named stringifiers
  // https://webidl.spec.whatwg.org/#es-stringifier
  if (members.some((member) => member.special === "stringifier")) {
    members.push({name: "toString", type: "operation"});
  }

  // Add members from ExtAttrs
  const legacyFactoryFunction = getExtAttr(iface, "LegacyFactoryFunction");
  if (legacyFactoryFunction) {
    members.push({
      name: legacyFactoryFunction.rhs.value,
      type: "constructor",
    });
  }

  return members.sort((a, b) => a.name.localeCompare(b.name));
};

const getExtAttr = (node, name: string) => {
  return node.extAttrs && node.extAttrs.find((i) => i.name === name);
};

const getExtAttrSet = (node, name: string) => {
  const attr = getExtAttr(node, name);
  if (!attr) {
    return null;
  }

  const set: Set<string> = new Set();
  switch (attr.rhs.type) {
    case "identifier":
      set.add(attr.rhs.value);
      break;
    case "identifier-list":
      for (const {value} of attr.rhs.value) {
        set.add(value);
      }
      break;
    case "*":
      set.add("*");
      break;
    default:
      throw new Error(
        `Unexpected RHS "${attr.rhs.type}" for ${name} extended attribute`,
      );
  }

  return set;
};

// https://webidl.spec.whatwg.org/#Exposed
const getExposureSet = (node, scopes): Set<Exposure> => {
  // step 6-8 of https://webidl.spec.whatwg.org/#dfn-exposure-set
  const exposure = getExtAttrSet(node, "Exposed");
  if (!exposure) {
    throw new Error(
      `Exposed extended attribute not found on ${node.type} ${node.name}`,
    );
  }

  // Handle wildcard exposures
  if (exposure.has("*")) {
    exposure.delete("*");
    for (const value of scopes) {
      exposure.add(value);
    }
  }

  // Special case RTCIdentityProviderGlobalScope since it doesn't use the
  // Exposed extended attribute correctly:
  // https://github.com/w3c/webrtc-identity/pull/36
  if (exposure.has("RTCIdentityProviderGlobalScope")) {
    exposure.delete("RTCIdentityProviderGlobalScope");
    exposure.add("RTCIdentityProvider");
  }

  // Some specs use "DedicatedWorker" for the exposure while others use
  // "Worker". We spawn a dedicated worker for the "Worker" exposure.
  // This code ensures we generate tests for either exposure.
  if (exposure.has("DedicatedWorker")) {
    exposure.delete("DedicatedWorker");
    exposure.add("Worker");
  }

  for (const e of exposure) {
    if (!scopes.has(e)) {
      throw new Error(
        `${node.type} ${node.name} is exposed on ${e} but ${e} is not a valid scope`,
      );
    }
  }

  return exposure as Set<Exposure>;
};

const validateIDL = (ast) => {
  const validations = WebIDL2.validate(ast).filter((v) => {
    // Ignore the [LegacyNoInterfaceObject] rule.
    // XXX Also temporarily ignore the "[AllowShared] BufferSource -> AllowSharedBufferSource" rule until specs are fixed.
    return !["no-nointerfaceobject", "migrate-allowshared"].includes(
      v.ruleName,
    );
  });
  if (validations.length) {
    const message = validations
      .map((v) => {
        return `${v.message} [${v.ruleName}]`;
      })
      .join("\n\n");
    throw new Error(`Web IDL validation failed:\n${message}`);
  }

  // Validate that there are no unknown types. There are types in lots of
  // places in the AST (interface members, arguments, return types) and rather
  // than trying to cover them all, walk the whole AST looking for "idlType".
  const usedTypes: Set<string> = new Set();
  // Serialize and reparse the ast to not have to worry about own properties
  // vs enumerable properties on the prototypes, etc.
  const pending = [JSON.parse(JSON.stringify(ast))];
  while (pending.length) {
    const node = pending.pop();
    for (const [key, value] of Object.entries(node)) {
      if (key === "idlType" && typeof value === "string") {
        usedTypes.add(value);
      } else if (typeof value === "object" && value !== null) {
        pending.push(value);
      }
    }
  }
  // These are the types defined by Web IDL itself.
  const knownTypes = new Set([
    "any", // https://webidl.spec.whatwg.org/#idl-any
    "ArrayBuffer", // https://webidl.spec.whatwg.org/#idl-ArrayBuffer
    "bigint", // https://webidl.spec.whatwg.org/#idl-bigint
    "BigInt64Array", // https://webidl.spec.whatwg.org/#idl-BigInt64Array
    "BigUint64Array", // https://webidl.spec.whatwg.org/#idl-BigUint64Array
    "boolean", // https://webidl.spec.whatwg.org/#idl-boolean
    "byte", // https://webidl.spec.whatwg.org/#idl-byte
    "ByteString", // https://webidl.spec.whatwg.org/#idl-ByteString
    "DataView", // https://webidl.spec.whatwg.org/#idl-DataView
    "DOMString", // https://webidl.spec.whatwg.org/#idl-DOMString
    "double", // https://webidl.spec.whatwg.org/#idl-double
    "float", // https://webidl.spec.whatwg.org/#idl-float
    "Float32Array", // https://webidl.spec.whatwg.org/#idl-Float32Array
    "Float64Array", // https://webidl.spec.whatwg.org/#idl-Float64Array
    "Int16Array", // https://webidl.spec.whatwg.org/#idl-Int16Array
    "Int32Array", // https://webidl.spec.whatwg.org/#idl-Int32Array
    "Int8Array", // https://webidl.spec.whatwg.org/#idl-Int8Array
    "long long", // https://webidl.spec.whatwg.org/#idl-long-long
    "long", // https://webidl.spec.whatwg.org/#idl-long
    "object", // https://webidl.spec.whatwg.org/#idl-object
    "octet", // https://webidl.spec.whatwg.org/#idl-octet
    "SharedArrayBuffer", // https://webidl.spec.whatwg.org/#idl-SharedArrayBuffer
    "short", // https://webidl.spec.whatwg.org/#idl-short
    "symbol", // https://webidl.spec.whatwg.org/#idl-symbol
    "Uint16Array", // https://webidl.spec.whatwg.org/#idl-Uint16Array
    "Uint32Array", // https://webidl.spec.whatwg.org/#idl-Uint32Array
    "Uint8Array", // https://webidl.spec.whatwg.org/#idl-Uint8Array
    "Uint8ClampedArray", // https://webidl.spec.whatwg.org/#idl-Uint8ClampedArray
    "unrestricted double", // https://webidl.spec.whatwg.org/#idl-unrestricted-double
    "unrestricted float", // https://webidl.spec.whatwg.org/#idl-unrestricted-float
    "unsigned long long", // https://webidl.spec.whatwg.org/#idl-unsigned-long-long
    "unsigned long", // https://webidl.spec.whatwg.org/#idl-unsigned-long
    "unsigned short", // https://webidl.spec.whatwg.org/#idl-unsigned-short
    "USVString", // https://webidl.spec.whatwg.org/#idl-USVString
    "undefined", // https://webidl.spec.whatwg.org/#idl-undefined
  ]);
  // Add any types defined by the (flattened) spec and custom IDL.
  for (const dfn of ast) {
    knownTypes.add(dfn.name);
  }
  // Ignore some types that aren't defined. Most of these should be fixed.
  const ignoreTypes = new Set([
    "Animatable", // TODO: this is a mixin used as a union type
    "CSSOMString", // https://drafts.csswg.org/cssom/#cssomstring-type
    "Region", // https://github.com/w3c/csswg-drafts/issues/5519
    "WindowProxy", // https://html.spec.whatwg.org/multipage/window-object.html#windowproxy
  ]);
  for (const usedType of usedTypes) {
    if (!knownTypes.has(usedType) && !ignoreTypes.has(usedType)) {
      throw new Error(`Unknown type ${usedType}`);
    }
  }
};

const buildIDLMemberTests = async (
  members,
  iface,
  exposureSet,
  resources,
  settings,
) => {
  const tests = {};
  // Avoid generating duplicate tests for operations.
  const handledMemberNames = new Set();

  for (const member of members) {
    const isStatic = member.special === "static" || iface.type === "namespace";
    // XXX console shouldn't be special-cased, needs to be fixed in BCD
    const name =
      member.name + (iface.name !== "console" && isStatic ? "_static" : "");

    if (handledMemberNames.has(name)) {
      continue;
    }

    const isEventHandler =
      member.idlType?.type === "attribute-type" &&
      typeof member.idlType?.idlType === "string" &&
      member.idlType?.idlType.endsWith("EventHandler");

    if (isEventHandler) {
      // XXX Tests for events will be added with another package, see
      // https://github.com/openwebdocs/mdn-bcd-collector/issues/133 for
      // details. In the meantime, ignore event handlers.
      continue;
    }

    let expr: string | RawTestCodeExpr | RawTestCodeExpr[] = "";

    // Constructors, constants, and static attributes should not have
    // auto-generated custom tests
    const customTestExactMatchNeeded =
      isStatic || ["toString", "toJSON"].includes(member.name as string);

    const customTestMember = await getCustomTest(
      `${settings.path}.${name}`,
      "api",
      customTestExactMatchNeeded,
    );

    if (customTestMember.test) {
      expr = customTestMember.test;
    } else if (settings.legacyNamespace) {
      expr = [{property: iface.name, owner: settings.legacyNamespace}];
      switch (member.type) {
        case "attribute":
        case "operation":
        case "field":
          if (isStatic) {
            expr.push({
              property: member.name,
              owner: `${settings.legacyNamespace}.${iface.name}`,
              skipOwnerCheck: true,
            });
          } else {
            expr.push({
              property: member.name,
              owner: `${settings.legacyNamespace}.${iface.name}.prototype`,
              inherit: member.special === "inherit",
              skipOwnerCheck: true,
            });
          }
          break;
        case "constructor":
          expr = `bcd.testConstructor('${settings.legacyNamespace}.${member.name}')`;
          break;
      }
    } else {
      switch (member.type) {
        case "attribute":
        case "operation":
        case "field":
          if (settings.isGlobal) {
            expr = {property: member.name, owner: "self"};
          } else if (isStatic) {
            expr = {property: member.name, owner: iface.name};
          } else {
            expr = {
              property: member.name,
              owner: `${iface.name}.prototype`,
              inherit: member.special === "inherit",
            };
          }
          break;
        case "constructor":
          expr = `bcd.testConstructor('${member.name}')`;
          break;
        case "symbol":
          // eslint-disable-next-line no-case-declarations
          const symbol = member.name.replace("@@", "");
          expr = {
            property: `Symbol.${symbol}`,
            owner: `${iface.name}.prototype`,
          };
          break;
      }
    }

    // const name = isEventHandler
    //   ? `${member.name.replace(/^on/, '')}_event`
    //   : member.name;

    tests[name] = compileTest({
      raw: {
        code: expr,
      },
      exposure: Array.from(exposureSet),
      resources: [...resources, ...customTestMember.resources],
    });
    handledMemberNames.add(name);

    for (const [subtestName, subtestData] of Object.entries(
      customTestMember.additional,
    )) {
      tests[`${name}.${subtestName}`] = compileTest({
        raw: {code: subtestData},
        exposure: Array.from(exposureSet),
        resources: [...resources, ...customTestMember.resources],
      });
    }
  }

  return tests;
};

const buildIDLTests = async (ast, globals, scopes) => {
  const tests = {};

  const interfaces = ast.filter((dfn) => {
    return dfn.type === "interface" || dfn.type === "namespace";
  });
  interfaces.sort((a, b) => a.name.localeCompare(b.name));

  for (const iface of interfaces) {
    let path = `api.${iface.name}`;
    const legacyNamespace = getExtAttr(iface, "LegacyNamespace")?.rhs.value;
    if (legacyNamespace) {
      path = `api.${legacyNamespace}.${iface.name}`;
    }

    // Remap WebAssembly API to webassembly.api
    path = path.replace("api.WebAssembly", "webassembly.api");

    const members = flattenMembers(iface);
    if (iface.type === "namespace" && members.length === 0) {
      // We should not generate tests for namespaces with no properties/methods
      continue;
    }

    const exposureSet = getExposureSet(iface, scopes);
    const isGlobal = !!getExtAttr(iface, "Global");
    const {
      test: customTest,
      resources,
      additional: subtests,
    } = await getCustomTest(path, "api");

    tests[path] = compileTest({
      raw: {
        code:
          customTest ||
          (legacyNamespace
            ? [
                {property: legacyNamespace, owner: "self"},
                {
                  property: iface.name,
                  owner: legacyNamespace,
                  skipOwnerCheck: true,
                },
              ]
            : {property: iface.name, owner: "self"}),
      },
      exposure: Array.from(exposureSet),
      resources,
    });

    const memberTests = await buildIDLMemberTests(
      members,
      iface,
      exposureSet,
      resources,
      {
        path,
        isGlobal,
        legacyNamespace,
      },
    );
    for (const [k, v] of Object.entries(memberTests)) {
      tests[`${path}.${k}`] = v;
    }

    for (const [subtestName, subtestData] of Object.entries(subtests)) {
      tests[`${path}.${subtestName}`] = compileTest({
        raw: {code: subtestData},
        exposure: Array.from(exposureSet),
        resources,
      });
    }
  }

  for (const iface of globals) {
    // Remap globals tests and exposure
    const fakeIface = {name: "_globals"};
    const exposureSet = new Set(["Window", "Worker"]);

    const members = flattenMembers(iface);
    const memberTests = await buildIDLMemberTests(
      members,
      fakeIface,
      exposureSet,
      [],
      {
        path: "api",
        isGlobal: true,
      },
    );
    for (const [k, v] of Object.entries(memberTests)) {
      tests[`api.${k}`] = v;
    }
  }

  return tests;
};

const build = async (specIDLs: IDLFiles, customIDLs: IDLFiles) => {
  const {ast, globals, scopes} = flattenIDL(specIDLs, customIDLs);
  validateIDL(ast);
  return await buildIDLTests(ast, globals, scopes);
};

export {flattenIDL, getExposureSet, buildIDLTests, build, validateIDL};
